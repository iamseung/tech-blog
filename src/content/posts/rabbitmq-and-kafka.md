---
title: 'RabbitMQ와 Kafka: 배달부와 장부'
description: 'RabbitMQ와 Kafka를 각각의 설계 철학부터 이해하고, 재시도·커밋·긴 작업 처리를 코드 예시로 정리합니다.'
slug: rabbitmq-and-kafka
publishedAt: '2026-10-09'
tags: [RabbitMQ, Kafka, 메시징, 분산시스템]
draft: false
---

"RabbitMQ랑 Kafka 중에 뭘 써야 하나요?"라는 질문을 받으면 보통 처리량 비교표부터 꺼냅니다. 그런데 둘은 같은 문제를 다른 속도로 푸는 도구가 아닙니다. 애초에 다른 질문에 답하려고 만들어졌습니다.

- **RabbitMQ는 배달부입니다.** "이 메시지를 어디로 보낼까?"를 묻습니다. 주소를 보고 사서함에 넣고, 받는 사람이 확인하면 지웁니다.
- **Kafka는 장부입니다.** "이 기록을 누가 언제 읽을까?"를 묻습니다. 일어난 일을 순서대로 적어 두기만 하고, 어디까지 읽었는지는 읽는 사람이 기억합니다.

이 글은 두 시스템을 이 관점에서 개념부터 차근차근 설명합니다. 코드는 개념을 보여 주는 최소한의 형태로 붙였고, 마지막 절에서 쇼핑몰 주문 처리 같은 흔한 시나리오를 놓고 어느 쪽이 어울리는지 정리합니다.

![RabbitMQ는 exchange가 메시지를 큐로 라우팅하고 소비자가 ack하면 지워지며, Kafka는 파티션 로그 끝에 기록을 붙이고 컨슈머 그룹마다 다른 offset에서 읽는다는 비교 도식](/images/posts/rabbitmq-and-kafka/overview.svg)

## 1. RabbitMQ: 브로커가 똑똑한 배달 시스템

### AMQP는 와이어 프로토콜이다

RabbitMQ는 AMQP 0-9-1이라는 프로토콜을 구현합니다. 이 프로토콜의 성격을 알면 RabbitMQ를 여러 언어에서 섞어 쓸 수 있는 이유가 보입니다.

> **와이어 프로토콜 (wire protocol)**
>
> 네트워크 선(wire) 위로 오가는 바이트의 형식과 순서를 정한 규칙. 양쪽이 어떤 언어로 만들어졌든 약속된 바이트만 주고받으면 대화가 된다.

HTTP를 떠올리면 쉽습니다. 브라우저가 무엇으로 만들어졌든, 서버가 어떤 언어로 짜였든 `GET /index.html HTTP/1.1`이라는 약속된 바이트만 주고받으면 대화가 됩니다.

이와 대비되는 것이 **라이브러리 API**입니다. API는 "이 함수를 이런 인자로 부르라"는 코드 수준의 약속이라 같은 언어, 같은 라이브러리 안에서만 의미가 있습니다. 와이어 프로토콜은 그보다 한 층 아래에서 "선 위에 이런 바이트를 이 순서로 흘려라"를 약속합니다.

AMQP에서는 모든 것이 **프레임**이라는 단위로 오갑니다. 메시지 하나를 발행하면 실제로는 프레임 세 개가 나갑니다.

```text
┌ method 프레임 ─ basic.publish(exchange="orders", routing_key="order.paid", mandatory=true)
├ header 프레임 ─ 본문 크기, content-type, delivery_mode=2(persistent), headers ...
└ body 프레임   ─ {"orderId": 1042, "amount": 39000}   (클 경우 여러 개로 나뉨)

모든 프레임 = [타입 1B][채널 번호 2B][크기 4B][내용 ...][끝 표시 0xCE]
```

이 형식이 바이트 단위로 정해져 있기 때문에 Java로 짠 주문 서비스가 Spring의 `RabbitTemplate`으로 보낸 메시지를 Python 워커가 `pika`로, Go 서비스가 `amqp091-go`로 그대로 읽을 수 있습니다. 여러 팀이 같은 라이브러리를 쓰기로 합의한 것이 아니라 같은 프로토콜을 쓰기로 합의한 것입니다.

이 글의 코드도 발행 쪽은 Spring, 받는 쪽은 Python으로 일부러 섞었습니다.

참고로 이름이 비슷한 AMQP 1.0은 exchange도 큐 개념도 없는 전혀 다른 프로토콜입니다. "AMQP를 지원한다"는 말을 보면 어느 버전인지 확인해야 합니다.

### 부품 다섯 개

| 부품 | 하는 일 | 기억할 성질 |
| --- | --- | --- |
| Exchange | routing key와 binding을 보고 메시지를 큐로 복사 | 메시지를 **저장하지 않는다** |
| Binding | exchange → queue 연결 규칙 | 메시지가 binding 여러 개에 맞으면 큐마다 한 부씩 복제된다 |
| Queue | 메시지를 실제로 보관하는 FIFO 버퍼 | 선언은 멱등하지만 **인자는 바꿀 수 없다** |
| Channel | 커넥션 위의 가벼운 논리 세션 | 스레드끼리 공유하면 안 된다 |
| Consumer | 큐를 구독하고 ack/nack으로 응답 | 브로커가 push한다 |

발행자는 큐를 모릅니다. exchange에 routing key만 붙여서 던지고, 어느 큐로 몇 부가 갈지는 binding이 정합니다. 그래서 발행 코드를 고치지 않고도 소비자를 늘리거나 바꿀 수 있습니다.

exchange는 routing key를 어떻게 해석하느냐에 따라 네 종류로 나뉩니다.

| 타입 | 라우팅 규칙 | 예시 |
| --- | --- | --- |
| direct | routing key가 binding key와 **글자 그대로 같을 때** | `order.paid` → 결제 완료 처리 큐 |
| topic | 점(`.`)으로 나눈 패턴. `*`는 단어 하나, `#`는 0개 이상 | `order.*.kr` → 국내 주문 이벤트만 받는 큐 |
| fanout | routing key를 무시하고 바인딩된 **모든 큐**에 복제 | 상품 정보가 바뀌면 모든 서버의 캐시 무효화 |
| headers | routing key 대신 헤더 값으로 매칭 | 드물게 쓴다 |

이름이 빈 문자열(`""`)인 **default exchange**도 있습니다. 모든 큐가 "자기 이름 = routing key"인 binding을 자동으로 갖고 있어서, 큐 이름을 routing key로 주면 그 큐에 바로 넣을 수 있습니다. 뒤의 재시도 코드에서 이 길을 씁니다.

스케일아웃할 때는 다음 한 문장만 기억하면 됩니다. **한 큐에 소비자가 여럿 붙으면 메시지를 나눠 갖고, 큐가 여럿이면 큐마다 한 부씩 받습니다.**

워커를 늘려도 작업이 중복 실행되지 않는 것은 앞의 성질 때문입니다(경쟁 소비).

반대로 캐시 무효화처럼 모든 서버가 받아야 하는 메시지는 서버마다 큐를 따로 만들어 뒤의 성질로 받습니다(브로드캐스트).

### 잃지 않으려면 다섯 군데를 막아야 한다

RabbitMQ에는 "메시지를 잃지 않는다"를 한 번에 켜는 스위치가 없습니다. 구간마다 따로 장치가 있고, 하나라도 빠지면 그 구간에서 메시지가 샙니다.

![Producer, Exchange, Queue, Consumer, 처리 완료로 이어지는 경로에서 publisher confirm, mandatory, durable과 persistent, prefetch, manual ack가 각각 지키는 구간을 표시한 도식](/images/posts/rabbitmq-and-kafka/reliability-chain.svg)

| 구간 | 장치 | 빠지면 생기는 일 |
| --- | --- | --- |
| 발행 → 브로커 | publisher confirm | 네트워크가 끊긴 순간 보낸 메시지가 도착했는지 알 수 없다 |
| exchange → 큐 | `mandatory` | 맞는 binding이 없으면 조용히 버려진다. confirm은 **성공**으로 온다 |
| 큐 보관 | durable 큐 + persistent 메시지 | 브로커가 재시작하면 큐나 메시지가 사라진다 |
| 큐 → 소비자 | prefetch | 소비자 하나가 메시지를 몰아 받아 다른 소비자가 논다 |
| 소비자 처리 | manual ack | 받자마자 지워져서, 처리 중에 죽으면 메시지가 사라진다 |

앞의 세 구간은 발행하는 쪽이, 뒤의 두 구간은 받는 쪽이 챙겨야 합니다.

#### publisher confirm과 mandatory

> **publisher confirm**
>
> 브로커가 발행자에게 "이 메시지를 받아서 보관했다"고 알려 주는 응답(`basic.ack`). 켜지 않으면 발행자는 네트워크가 끊긴 순간 보낸 메시지가 도착했는지 알 방법이 없다.


그런데 confirm만으로는 부족합니다. confirm은 "브로커가 받았다"는 뜻이지 "큐에 들어갔다"는 뜻이 아니기 때문입니다.

routing key에 오타가 있거나 아직 큐가 binding되지 않았다면 exchange는 메시지를 보낼 곳을 찾지 못합니다. 기본 동작은 **그 자리에서 조용히 버리는 것**이고, 발행자에게는 여전히 confirm이 성공으로 옵니다.

이 구멍을 막는 것이 `mandatory`입니다.

> **mandatory**
>
> `basic.publish`에 붙이는 플래그. 메시지가 어느 큐에도 라우팅되지 못하면 브로커가 버리지 않고 `basic.return`에 담아 발행자에게 돌려보낸다.


```text
mandatory 없음:  publish ──▶ exchange (맞는 binding 없음) ──▶ 버림
                 ◀── confirm: ack   ← 발행자는 성공한 줄 안다

mandatory 있음:  publish ──▶ exchange (맞는 binding 없음)
                 ◀── basic.return (reply 312 NO_ROUTE + 메시지 원본)
                 ◀── confirm: ack   ← return이 먼저 온다
```

순서에 주의해야 합니다. return이 먼저 오고 confirm(ack)이 나중에 옵니다. confirm만 보고 성공으로 처리하면 되돌아온 메시지를 놓칩니다.

라우팅 실패를 발행자가 아니라 브로커 안에서 받아 두고 싶다면, exchange에 `alternate-exchange` 인자를 걸어 갈 곳 없는 메시지를 다른 exchange로 보내는 방법도 있습니다.

**발행 쪽 (예: Spring).** Spring Boot에서는 커넥션 설정으로 두 기능을 켜고, `RabbitTemplate`에 콜백을 답니다.

```yaml
spring:
  rabbitmq:
    publisher-confirm-type: correlated # 브로커의 confirm을 콜백으로 받는다
    publisher-returns: true            # basic.return을 받을 수 있게 한다
```

```java
@Bean
RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory) {
    RabbitTemplate template = new RabbitTemplate(connectionFactory);
    template.setMandatory(true);
    template.setReturnsCallback(returned ->
        log.error("라우팅 실패 exchange={} routingKey={} reply={}",
            returned.getExchange(), returned.getRoutingKey(), returned.getReplyText()));
    template.setConfirmCallback((correlation, ack, cause) -> {
        if (!ack) log.error("브로커가 메시지를 거부했다: {}", cause);
    });
    return template;
}
```

큐는 durable로 선언하고, `RabbitTemplate`은 기본적으로 메시지를 persistent(`delivery_mode=2`)로 보냅니다.

#### prefetch와 manual ack

> **prefetch**
>
> 소비자가 ack하지 않은 메시지를 동시에 몇 개까지 쥐고 있을 수 있는지 정하는 상한(`basic.qos`).

> **manual ack**
>
> 소비자가 처리를 끝낸 뒤 직접 `basic.ack`를 보내야 큐에서 메시지가 지워지는 방식. ack 전에 커넥션이 끊기면 브로커가 메시지를 큐로 되돌려 다른 소비자에게 준다.

**받는 쪽 (예: Python `pika`).** 소비자는 한 번에 받을 메시지 수를 정하고, 처리가 끝난 뒤에 직접 ack합니다.

```python
import json

import pika

conn = pika.BlockingConnection(pika.ConnectionParameters("localhost"))
consume_ch = conn.channel()
consume_ch.basic_qos(prefetch_count=4)  # ack 안 한 메시지는 4개까지만 받는다 (처리 스레드 수와 맞춘다)


def on_message(ch, method, props, body):
    handle(json.loads(body))
    ch.basic_ack(method.delivery_tag)  # 처리가 끝난 뒤에야 큐에서 지워진다


consume_ch.basic_consume("order.email", on_message, auto_ack=False)
consume_ch.start_consuming()
```

`auto_ack=True`로 두면 브로커는 메시지를 보내자마자 지웁니다. 그 상태에서 소비자가 처리 도중에 죽으면 메시지가 그대로 사라집니다.

prefetch 값은 처리 스레드 수에 맞춥니다. 그보다 작으면 스레드가 놀고, 너무 크면 한 소비자가 처리하지도 못할 메시지를 쥐고 있는 동안 옆의 소비자가 놉니다.

이렇게 다섯 군데를 다 막아도 RabbitMQ가 약속하는 것은 at-least-once까지입니다.

> **at-least-once**
>
> 메시지가 최소 한 번은 처리된다는 보증. 유실은 없지만 같은 메시지가 두 번 이상 처리될 수 있다. 반대로 at-most-once는 중복은 없지만 유실될 수 있다.
confirm을 기다리다 타임아웃이 나면 메시지가 실제로 들어갔는지 알 수 없습니다. 그래서 다시 보내고, 결국 같은 메시지가 두 번 존재할 수 있습니다.

중복은 소비자가 멱등하게 흡수해야 합니다. 예를 들어 주문 확인 메일을 보내는 소비자라면 "주문 1042번 메일 발송 완료"를 DB에 기록해 두고, 같은 주문의 메시지가 다시 오면 보내지 않고 ack만 합니다.

### 재시도 사다리: 코드에 sleep 없이 기다리기

RabbitMQ의 장점은 실패 경로를 브로커가 들고 있다는 점입니다. 핵심 기능은 dead-letter입니다.

> **dead-letter**
>
> 큐가 더 이상 보관하지 않기로 한 메시지(거부됨, TTL 만료, 길이 초과)를 버리지 않고 지정한 exchange로 다시 보내는 기능. 그 exchange를 DLX(dead-letter exchange)라고 부른다.

큐에 TTL을 걸고, 만료된 메시지가 원래 exchange로 dead-letter되게 엮으면 **타이머 없는 지연 재시도**가 됩니다.

![메인 큐에서 처리에 실패한 메시지가 2초, 8초, 30초 TTL을 가진 retry 큐로 가고, 만료되면 dead-letter로 원래 exchange에 돌아오며, 영구 실패나 재시도 소진은 DLQ로 가는 흐름도](/images/posts/rabbitmq-and-kafka/retry-ladder.svg)

토폴로지 선언은 다음과 같습니다. retry 큐에는 소비자가 없습니다. 메시지는 TTL만큼 기다렸다가 브로커가 알아서 메인 exchange로 돌려보냅니다.

```python
EXCHANGE = "orders"
QUEUE = "order.email"
ROUTING_KEY = "order.paid"
RETRY_TIERS = (2, 8, 30)  # 초


def declare_topology(ch) -> None:
    ch.exchange_declare(EXCHANGE, exchange_type="topic", durable=True)
    ch.queue_declare(QUEUE, durable=True)
    ch.queue_bind(QUEUE, EXCHANGE, routing_key=ROUTING_KEY)

    for seconds in RETRY_TIERS:
        ch.queue_declare(
            f"{QUEUE}.retry-{seconds}s",
            durable=True,
            arguments={
                "x-message-ttl": seconds * 1000,
                "x-dead-letter-exchange": EXCHANGE,      # 만료되면 원래 exchange로
                "x-dead-letter-routing-key": ROUTING_KEY,
            },
        )
    ch.queue_declare(f"{QUEUE}.dlq", durable=True)
```

실패한 메시지를 retry 큐나 DLQ로 옮기는 순간 **소비자가 발행자가 됩니다.** 그러면 앞에서 발행 쪽에 걸었던 confirm과 `mandatory`를 소비자 쪽에도 똑같이 걸어야 합니다. 옮기다가 메시지를 잃으면 재시도 사다리를 만든 의미가 없기 때문입니다.

`pika`의 `BlockingChannel`은 confirm 모드에서 라우팅 실패와 브로커 거부를 예외로 알려 줍니다.

```python
publish_ch = conn.channel()   # confirm 대기와 consume ack가 섞이지 않게 채널을 나눈다
publish_ch.confirm_delivery()


def publish_to_queue(queue: str, body: bytes, headers: dict) -> None:
    # default exchange("")는 큐 이름을 routing key로 받아 그 큐에 바로 넣는다
    publish_ch.basic_publish(
        exchange="",
        routing_key=queue,
        body=body,
        properties=pika.BasicProperties(delivery_mode=2, headers=headers),  # persistent
        mandatory=True,
    )
    # 라우팅 실패면 UnroutableError, 브로커가 거부하면 NackError가 난다
```

재시도 횟수는 따로 세지 않아도 됩니다. 메시지가 dead-letter될 때마다 브로커가 `x-death` 헤더에 어느 큐에서 몇 번 죽었는지 쌓아 주기 때문입니다.

```python
import json


class PermanentError(Exception):
    """다시 시도해도 결과가 같은 실패 (스키마 오류, 검증 실패 등)"""


def retry_count(props) -> int:
    deaths = (props.headers or {}).get("x-death", [])
    return sum(d["count"] for d in deaths if ".retry-" in d["queue"])


def route_failure(body: bytes, props, exc: Exception) -> None:
    headers = {"x-exception-class": type(exc).__name__}
    if isinstance(exc, (PermanentError, json.JSONDecodeError)):
        publish_to_queue(f"{QUEUE}.dlq", body, headers)  # 재시도해도 소용없다
        return
    n = retry_count(props)
    if n < len(RETRY_TIERS):
        publish_to_queue(f"{QUEUE}.retry-{RETRY_TIERS[n]}s", body, headers)
    else:
        publish_to_queue(f"{QUEUE}.dlq", body, {**headers, "x-retry-count": n})


def on_message(ch, method, props, body):
    try:
        handle(json.loads(body))
    except Exception as exc:
        try:
            route_failure(body, props, exc)
        except (pika.exceptions.UnroutableError, pika.exceptions.NackError):
            # 재시도 큐로 옮기는 데 실패했다. 잃느니 중복을 택한다
            ch.basic_nack(method.delivery_tag, requeue=True)
            return
    ch.basic_ack(method.delivery_tag)


consume_ch.basic_consume(QUEUE, on_message, auto_ack=False)
consume_ch.start_consuming()
```

몇 가지 결정에는 이유가 있습니다.

- **tier마다 큐를 따로 둡니다.** 메시지별 TTL(`expiration` 속성)은 메시지가 큐 맨 앞에 와야 만료 처리됩니다. 30초짜리 뒤에 2초짜리가 서 있으면 2초짜리도 30초를 기다립니다(head-of-line blocking). 큐마다 TTL을 고정하면 이런 역전이 생기지 않습니다. 대가로 재시도 간격에 지터(jitter)를 넣을 수 없습니다.
- **DLQ로 보낼 때 nack 대신 명시적으로 publish합니다.** 메인 큐에 DLX가 없으면 `nack(requeue=False)`는 메시지를 그냥 버립니다. 직접 publish하면 예외 클래스나 재시도 횟수 같은 헤더도 함께 실을 수 있습니다.
- **실패를 먼저 분류합니다.** 스키마 오류처럼 다시 해도 같은 결과가 나오는 실패를 재시도로 보내면 retry 큐가 영구 실패로 가득 찹니다. 일시적인 실패(타임아웃, 429)만 재시도합니다.
- **큐 인자를 바꾸는 배포는 따로 다룹니다.** 같은 이름의 큐를 다른 인자로 다시 선언하면 브로커가 `PRECONDITION_FAILED`로 채널을 닫습니다. 운영 중인 큐에 TTL이나 DLX를 나중에 추가할 때 흔히 만나는 문제입니다. 기존 큐를 비우고 지운 다음 배포하거나, 인자 대신 나중에 바꿀 수 있는 policy로 설정합니다.

처리 시간이 길면 핸들러를 별도 스레드에서 실행합니다. `pika`의 채널은 스레드 안전하지 않으므로, ack는 IO loop 스레드에서 실행되도록 예약해야 합니다.

```python
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=4)


def on_message(ch, method, props, body):
    def work():
        handle(json.loads(body))
        # 처리 스레드에서 직접 basic_ack를 부르면 안 된다
        conn.add_callback_threadsafe(lambda: ch.basic_ack(method.delivery_tag))

    executor.submit(work)
```

### 30분이 넘는 작업: ack의 의미를 바꾸다

AMQP의 정석은 "처리가 끝나면 ack"입니다. 그런데 RabbitMQ에는 ack를 무한정 기다리지 않는 장치가 있습니다.

> **consumer_timeout**
>
> 브로커가 메시지를 배달한 뒤 ack를 기다리는 최대 시간(기본 30분). 넘기면 브로커가 채널을 강제로 닫고 메시지를 큐로 되돌린다.

동영상 인코딩, 대용량 정산 리포트 생성, 외부 API를 수천 번 호출하는 일괄 작업처럼 30분을 넘길 수 있는 작업이라면 문제가 됩니다. 작업은 멀쩡히 돌고 있는데 채널이 닫히고, 같은 작업이 다른 소비자에게서 처음부터 다시 시작됩니다.

![끝나고 ack하는 방식은 30분 consumer timeout에 걸려 채널이 닫히고 다른 소비자가 같은 작업을 다시 실행하지만, claim 후 바로 ack하는 방식은 timeout과 무관하게 실행되고 진행 상태를 DB가 추적한다는 타임라인 비교](/images/posts/rabbitmq-and-kafka/early-ack.svg)

timeout 값을 늘리는 방법도 있습니다. 하지만 그렇게 하면 "작업 시간에 상한이 없다"는 문제를 브로커 설정으로 덮을 뿐입니다.

다른 방법은 **ack의 의미를 "처리 완료"에서 "책임 이관 완료"로** 바꾸는 것입니다.

작업 상태를 DB가 관리하는 시스템이라면, 소비자가 DB에서 작업을 claim(`PENDING → RUNNING`으로 원자적으로 바꾸기)하는 순간 ack를 보냅니다. 그 뒤로 작업의 생존은 브로커가 아니라 DB의 상태 기계가 책임집니다.

```python
import threading

run_slots = threading.Semaphore(4)


def on_message(ch, method, props, body):
    job = json.loads(body)

    if not run_slots.acquire(blocking=False):
        # ack를 일찍 보내면 prefetch가 동시 실행 수를 막아 주지 못한다.
        # 슬롯이 없으면 30초 TTL 큐로 미뤘다가 다시 받는다.
        # (retry 큐와 같은 방식으로 TTL + 메인 exchange DLX를 걸어 선언해 둔다)
        publish_to_queue(f"{QUEUE}.backpressure-30s", body, {})
        ch.basic_ack(method.delivery_tag)
        return

    if not jobs.claim(job["jobId"]):  # CAS: PENDING → RUNNING
        run_slots.release()
        ch.basic_ack(method.delivery_tag)  # 이미 누가 가져간 중복 메시지
        return

    ch.basic_ack(method.delivery_tag)  # 여기서부터는 DB의 작업 상태가 책임진다

    def work():
        try:
            run_long_job(job)  # 수십 분이 걸려도 consumer_timeout과 무관하다
            jobs.complete(job["jobId"])
        except Exception as exc:
            jobs.fail(job["jobId"], str(exc))
        finally:
            run_slots.release()

    executor.submit(work)
```

이 방식은 공짜가 아닙니다. 소비자가 실행 중에 죽어도 브로커는 메시지를 다시 주지 않습니다. 그래서 오랫동안 `RUNNING`에 머문 작업을 찾아 되살리는 복구 로직이 따로 있어야 합니다. 이 조건이 갖춰진 긴 작업에만 쓰고, 30분 안에 끝나는 짧은 작업은 여전히 처리가 끝난 뒤 ack하는 것이 안전합니다.

### 어떤 패턴을 고를까

RabbitMQ의 부품으로 만드는 패턴은 결국 **실패를 누가 책임지느냐**로 갈립니다.

| 상황 | 패턴 | 실패 책임 |
| --- | --- | --- |
| 메일 발송, 이미지 변환처럼 처리하면 끝나는 작업 | 공유 큐 + 경쟁 소비 + retry/DLQ | 브로커 |
| 호출한 쪽이 수 초 안에 결과를 받아야 함 | RPC (`reply_to` + `correlation_id`) | 발행자의 응답 타임아웃 |
| 모든 서버가 받아야 하는 캐시 무효화 같은 신호 | 서버별 익명 큐 + fanout | 놓쳐도 다음 신호로 복구 |

## 2. Kafka: 모든 것은 추가 전용 로그다

### 토픽, 파티션, 오프셋

Kafka에서 메시지를 담는 이름 붙은 묶음을 토픽이라고 합니다. 토픽은 다시 파티션으로 나뉩니다.

> **파티션 (partition)**
>
> 토픽을 나눈 단위이자, 끝에만 기록이 붙는 로그 하나. 순서 보장, 병렬 처리, 복제가 모두 파티션 단위로 일어난다.

> **offset**
>
> 파티션 안에서 기록이 붙은 순서대로 받는 번호. 0부터 늘어나며 다시 쓰이지 않는다.

이 구조에서 다음 성질이 나옵니다.

- **읽어도 지워지지 않습니다.** 보존 기간(retention, 기본 7일)이 지나야 지워집니다.
- **브로커는 누가 무엇을 읽었는지 기록마다 추적하지 않습니다.** 컨슈머 그룹이 "이 파티션은 어디까지 읽었다"는 offset 하나만 기록합니다. 그래서 소비자가 늘어나도 브로커가 할 일은 거의 늘지 않습니다.
- **같은 key는 항상 같은 파티션으로 갑니다.** 순서는 파티션 안에서만 보장됩니다. 그래서 무엇을 key로 삼을지가 Kafka 설계 결정의 절반입니다.
- **그룹 안에서 파티션 하나는 컨슈머 하나만 맡습니다.** 파티션 수가 곧 그룹의 최대 병렬도입니다.

> **컨슈머 그룹 (consumer group)**
>
> 읽은 위치(offset)를 공유하는 소비자 묶음. 그룹 안에서는 파티션을 나눠 갖고, 그룹끼리는 서로 영향이 없다.

RabbitMQ에서 큐를 나누고 binding을 걸어 만들던 "경쟁 소비"와 "브로드캐스트"가 Kafka에서는 그룹 이름 하나로 갈립니다. 같은 그룹이면 파티션을 나눠 갖고, 다른 그룹이면 각자 처음부터 끝까지 따로 읽습니다.

### 이런 요구가 생기면 Kafka를 꺼낸다

쇼핑몰에 다음과 같은 요구가 생겼다고 가정해 보겠습니다.

> 주문 상태가 바뀔 때마다(생성 → 결제 → 배송 → 완료) 이벤트를 남긴다. 정산팀은 판매자 정산에, 추천팀은 구매 이력 학습에, 데이터팀은 매출 대시보드에 쓴다. 정산 로직에 버그가 있었다면 고친 뒤 지난주 이벤트부터 다시 정산해야 한다.

RabbitMQ로도 큐 세 개에 복제하면 만들 수는 있습니다. 하지만 소비하면 사라지므로 "지난주부터 다시"가 불가능하고, 새 팀이 붙을 때마다 발행 토폴로지를 바꿔야 합니다. Kafka에서는 토픽 하나에 그룹 세 개를 붙이면 됩니다. 재처리는 그 그룹의 offset을 되감는 일로 끝납니다.

### 프로듀서: key가 순서를 정한다

```java
Properties p = new Properties();
p.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
p.put(ProducerConfig.ACKS_CONFIG, "all");               // ISR 전원이 기록한 뒤 응답
p.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, true);  // 재전송 중복을 브로커가 걸러 낸다
p.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
p.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class);

try (var producer = new KafkaProducer<String, String>(p)) {
    // key = orderId → 한 주문의 이벤트(생성→결제→배송)는 같은 파티션에서 순서대로 처리된다
    producer.send(new ProducerRecord<>("orders", orderId, eventJson), (meta, ex) -> {
        if (ex != null) log.error("주문 이벤트 발행 실패 orderId={}", orderId, ex);
    });
} // close()가 버퍼에 남은 레코드를 flush한다
```

`send()`는 레코드를 보내지 않고 버퍼에 넣기만 합니다. 실제 전송은 별도 I/O 스레드가 파티션별 배치로 처리합니다. 그래서 배치 작업이 `close()`나 `flush()` 없이 종료하면 마지막 레코드 몇 개가 사라집니다.

복제 설정은 토픽 쪽에서 맞춥니다. 운영의 표준 조합은 복제본 3개(`replication.factor=3`), `min.insync.replicas=2`, 프로듀서 `acks=all`입니다.

`min.insync.replicas` 기본값은 1입니다. 이 값을 그대로 두면 `acks=all`이어도 leader 혼자 가진 데이터가 생길 수 있습니다.

### 컨슈머: 커밋 순서가 곧 전달 보증이다

Kafka의 컨슈머는 메시지 하나하나를 ack하지 않습니다. **"여기까지 처리했다"는 위치**를 커밋합니다. 그래서 처리와 커밋 중 무엇을 먼저 하느냐가 그대로 전달 보증이 됩니다.

![커밋을 처리 전에 하면 장애 시 일부 레코드를 건너뛰는 at-most-once가 되고, 처리 후에 하면 일부를 두 번 처리하는 at-least-once가 된다는 두 타임라인 비교](/images/posts/rabbitmq-and-kafka/offset-commit.svg)

대부분의 시스템은 RabbitMQ와 마찬가지로 at-least-once에 멱등 처리를 붙이는 쪽을 택합니다.

```java
Properties p = new Properties();
p.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
p.put(ConsumerConfig.GROUP_ID_CONFIG, "settlement");
p.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, false);   // 커밋 시점을 직접 통제한다
p.put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "earliest"); // 새 그룹은 처음부터 읽는다
p.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 100);
p.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);
p.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer.class);

try (var consumer = new KafkaConsumer<String, String>(p)) {
    consumer.subscribe(List.of("orders"));
    while (running) {
        ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
        for (ConsumerRecord<String, String> r : records) {
            settlement.apply(r.key(), r.value()); // 같은 이벤트가 두 번 와도 결과가 같아야 한다
        }
        consumer.commitSync(); // 처리한 뒤에 커밋한다
    }
}
```

자주 겪는 함정이 세 가지 있습니다.

- **`auto.offset.reset` 기본값은 `latest`입니다.** 그래서 새 그룹을 띄우면 기존 데이터를 하나도 읽지 않습니다. 과거부터 읽어야 하면 `earliest`로 바꿉니다.
- **`max.poll.interval.ms`(기본 5분)를 넘기면 그룹에서 쫓겨납니다.** heartbeat는 백그라운드 스레드가 보내므로 프로세스는 살아 있는 것으로 보입니다. 하지만 poll 간격이 너무 길면 처리 루프가 죽은 것으로 판단해 리밸런스가 일어나고, 같은 레코드를 다른 멤버가 다시 처리합니다. `max.poll.records × 레코드당 최대 처리 시간`이 이 값 안에 들어오는지 계산해 둡니다. RabbitMQ의 `consumer_timeout`과 비슷한 문제가 형태만 바꿔 나타난 것입니다.
- **자동 커밋과 비동기 처리를 섞지 않습니다.** poll한 레코드를 다른 스레드로 넘기면 처리가 끝나기 전에 다음 poll에서 자동 커밋이 일어납니다.

정산 버그를 고친 뒤 지난주부터 다시 정산할 때는 그룹을 멈추고 offset을 되감습니다.

```sh
# 먼저 --dry-run으로 어디로 옮겨지는지 확인한다
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --group settlement \
  --topic orders --reset-offsets --to-datetime 2026-10-01T00:00:00.000 --dry-run

# 확인했으면 --execute로 실행한다
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --group settlement \
  --topic orders --reset-offsets --to-datetime 2026-10-01T00:00:00.000 --execute
```

추천 그룹과 대시보드 그룹의 위치는 그대로입니다. 읽는 위치를 그룹마다 따로 기록하기 때문입니다.

### 실패 처리는 애플리케이션 몫이다

RabbitMQ에서 브로커가 해 주던 nack, 재배달 횟수 세기, dead-letter가 Kafka 브로커에는 없습니다. 레코드 하나만 실패로 표시할 방법이 없고, offset을 그 앞에 두거나 넘기는 것만 가능합니다. 실패 처리는 모두 애플리케이션 쪽 패턴으로 만들어야 합니다.

| 패턴 | 동작 | 맞는 경우 |
| --- | --- | --- |
| blocking retry | 같은 레코드를 그 자리에서 백오프하며 재시도 | 순서가 중요하고 실패가 잠깐일 때. 그동안 파티션 전체가 멈춘다 |
| retry topic | `orders-retry-1m` 같은 토픽으로 빼고 원래 파티션은 진행 | 처리량이 중요할 때. 순서를 포기한다 |
| dead letter topic | 포기한 레코드를 원본 위치·예외 정보와 함께 기록 | 사람이 보고 나중에 재주입 |

Spring for Apache Kafka를 쓴다면 이 패턴들을 직접 짤 필요가 없습니다.

```java
@Bean
DefaultErrorHandler errorHandler(KafkaTemplate<Object, Object> template) {
    // 재시도를 다 쓰면 <원본 토픽>.DLT 의 같은 파티션으로 보낸다
    var recoverer = new DeadLetterPublishingRecoverer(template);

    var backOff = new ExponentialBackOff(1_000L, 2.0);
    backOff.setMaxElapsedTime(10_000L);

    var handler = new DefaultErrorHandler(recoverer, backOff);
    // 다시 해도 결과가 같은 실패는 재시도하지 않고 바로 DLT로 보낸다
    handler.addNotRetryableExceptions(IllegalArgumentException.class);
    return handler;
}
```

> **poison pill**
>
> 처리할 때마다 같은 이유로 실패해서, 그 뒤의 메시지까지 진행을 막는 메시지.

대표적인 예가 역직렬화 단계에서 실패하는 레코드입니다. 처리 코드에 닿기도 전에 예외를 냅니다. 대응하지 않으면 컨슈머는 같은 offset에서 같은 예외를 영원히 반복하고, 그 파티션 하나만 lag이 끝없이 늘어납니다. `ErrorHandlingDeserializer`로 감싸서 이런 레코드도 DLT로 보내야 합니다.

실패를 분류하는 기준은 RabbitMQ 때와 같습니다. 다시 해도 결과가 같은 실패는 바로 DLT로, 시간이 지나면 풀리는 실패만 재시도로 보냅니다.

## 3. 그래서 무엇을 고를까

![처리하고 나면 필요 없는 작업 지시서는 RabbitMQ, 여러 곳에서 다시 읽는 사실의 기록은 Kafka로 나누는 선택 기준 도식](/images/posts/rabbitmq-and-kafka/choose.svg)

| | RabbitMQ | Kafka |
| --- | --- | --- |
| 본질 | 메시지 브로커 (배달을 중개) | 복제되는 분산 로그 (기록을 보관) |
| 소비 후 | ack하면 지워진다 | retention까지 남는다 |
| 재처리 | 불가 (stream 큐 제외) | offset을 되감아 언제든 |
| 확인 단위 | 메시지별 ack / nack | 위치 커밋 ("여기까지") |
| 실패 처리 | 브로커 기능 (DLX, TTL) | 애플리케이션 패턴 (retry topic, DLT) |
| 순서 | 큐 안에서, 소비자가 하나일 때만 | 파티션 안에서 강하게 |
| 병렬성 | 큐에 붙는 소비자 수 (상한 없음) | 파티션 수가 그룹의 상한 |
| RPC | `reply_to`로 자연스럽다 | 어색하다 |
| 운영 시작점 | 단일 노드로 가능 | 브로커 3대 + 컨트롤러 쿼럼 |

제가 쓰는 기준은 하나입니다. **이 메시지가 처리되고 나면 필요 없는가?**

- 필요 없다면 그것은 **작업 지시서**이고, RabbitMQ가 맞습니다. 메시지마다 재시도를 다르게 하고, 실패한 것만 따로 빼고, 소비자를 늘려 나눠 처리하는 일은 RabbitMQ가 잘합니다.
- 계속 필요하다면 그것은 **사실의 기록**이고, Kafka가 맞습니다. 여러 팀이 각자 읽고, 과거를 다시 처리하고, 엔티티별 순서가 중요하다면 로그가 답입니다.

### 시나리오로 보기: 쇼핑몰 주문 처리

고객이 주문 버튼을 누른 뒤에 뒤에서 일어나는 일을 하나씩 나눠 보겠습니다.

| 할 일 | 고를 것 | 이유 |
| --- | --- | --- |
| 주문 확인 메일·알림톡 발송 | RabbitMQ | 한 번 보내면 끝나는 작업이다. 메일 서버가 잠깐 죽으면 지연 재시도하고, 주소가 잘못됐으면 DLQ로 뺀다 |
| 영수증 PDF·상품 썸네일 생성 | RabbitMQ | 무거운 작업을 워커 N대가 나눠 처리한다. 몰리면 워커만 늘리면 된다 |
| 배송사 API로 송장 등록 | RabbitMQ | 상대가 429를 돌려주면 2초·8초·30초 뒤에 다시 시도한다. 메시지마다 실패를 다르게 다루는 일이다 |
| 결제 직전 재고 확인 | RabbitMQ (RPC) | 호출한 쪽이 몇 초 안에 답을 받아야 한다. `reply_to`로 답장 주소를 실어 보낸다 |
| 상품 가격이 바뀌면 모든 서버의 캐시 비우기 | RabbitMQ (fanout) | 서버마다 한 부씩 받아야 하고, 놓쳐도 다음 변경 때 다시 맞춰진다 |
| 주문 상태 변경 이력 (생성 → 결제 → 배송 → 완료) | Kafka | 한 주문의 이벤트가 순서대로 처리돼야 한다. orderId를 key로 쓰면 같은 파티션에 들어간다 |
| 정산·추천·매출 대시보드가 같은 주문 이벤트를 읽음 | Kafka | 토픽 하나에 컨슈머 그룹 셋. 새 팀이 붙어도 발행 쪽은 바뀌지 않는다 |
| 정산 버그 수정 후 지난주 주문부터 재계산 | Kafka | 그 그룹의 offset만 되감으면 된다. 다른 그룹은 영향이 없다 |
| 주문 DB 변경을 검색 인덱스·데이터 웨어하우스에 동기화 (CDC) | Kafka | DB 변경 로그를 그대로 흘려보내는 일이다. Debezium 같은 Kafka Connect 커넥터가 표준이다 |
| 상품 상세 페이지 클릭 로그 | Kafka | 초당 수만 건이 들어오고, 여러 분석 시스템이 각자 속도로 읽는다 |

실제 시스템에서는 둘을 함께 쓰는 경우가 많습니다. 사실은 Kafka에 기록하고, 그 사실 때문에 해야 할 일은 RabbitMQ로 넘기는 식입니다.

![주문 서비스가 결제 완료 사실을 Kafka orders 토픽에 기록하고, 정산·추천·알림 컨슈머 그룹이 각각 읽으며, 알림 그룹은 확인 메일 발송 작업을 RabbitMQ 큐에 넣어 메일 워커들이 재시도와 DLQ를 거쳐 처리하는 구성도](/images/posts/rabbitmq-and-kafka/together.svg)

"주문 1042가 결제됐다"는 사실은 여러 팀이 오래 두고 읽어야 하므로 장부(Kafka)에 남깁니다. "주문 1042의 확인 메일을 보내라"는 지시는 한 번 처리하면 끝나고 실패하면 재시도해야 하므로 배달부(RabbitMQ)에게 맡깁니다.

다른 도메인에서도 같은 기준이 통합니다.

- **은행 계좌 거래 내역, IoT 센서 측정값, 게임 서버의 플레이 로그**는 사실의 기록입니다. 나중에 다시 읽고 여러 곳에서 집계하므로 Kafka 쪽입니다.
- **회원가입 인증 메일, 업로드된 동영상 인코딩, 매일 새벽 정산 리포트 생성**은 작업 지시입니다. 처리하고 나면 메시지가 필요 없고, 실패한 것만 따로 다뤄야 하므로 RabbitMQ 쪽입니다.

두 시스템의 경계는 좁아지고 있습니다. RabbitMQ는 stream 큐로 로그 모델을, Kafka는 공유 그룹(share group)으로 레코드 단위 확인이 되는 큐 모델을 들여왔습니다. 그래도 각자의 기본값과 운영 경험은 여전히 원래 철학을 따릅니다. 처음 고를 때는 위의 질문 하나로 충분합니다.

## 정리: 처음 붙일 때의 체크리스트

**RabbitMQ**

- confirm, `mandatory`, durable + persistent, prefetch, manual ack를 모두 켰는가
- 재시도할 실패와 바로 DLQ로 보낼 실패를 나눴는가
- 30분을 넘길 수 있는 작업인가? 그렇다면 ack 시점을 다시 설계했는가
- 중복 메시지가 와도 결과가 같은가

**Kafka**

- 무엇을 key로 삼을지, 파티션을 몇 개로 할지 정했는가 (파티션은 늘릴 수만 있고, 늘리면 key 매핑이 바뀐다)
- RF 3, `min.insync.replicas=2`, `acks=all`인가
- 수동 커밋을 쓰고, 처리한 뒤에 커밋하는가
- poison pill과 DLT 경로를 준비했는가
- 그룹별 consumer lag 알림을 걸었는가

두 시스템 모두 "정확히 한 번"은 공짜로 주지 않습니다. Kafka 트랜잭션도 Kafka에서 읽고 Kafka에 쓰는 범위 안에서만 성립합니다. 결국 어느 쪽을 고르든 마지막 방어선은 **멱등한 소비자**입니다.

설정 기본값은 버전마다 바뀌어 왔습니다. 이 글의 값은 RabbitMQ 4.x와 Apache Kafka 4.x 기준이니, 쓰는 버전의 공식 문서([RabbitMQ](https://www.rabbitmq.com/docs), [Apache Kafka](https://kafka.apache.org/documentation/))에서 다시 확인하길 권합니다.
