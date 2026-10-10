---
title: 'Python A to Z (3): 기다림과 계산을 나누고 운영까지'
description: 'JVM 스레드·가상 스레드와 CPython GIL·asyncio를 비교하고, 테스트·로깅·성능·배포까지 연결합니다.'
slug: python-a-to-z-3
publishedAt: '2026-10-10'
tags: [Python, 동시성, 테스트, 운영]
series: python-a-to-z
seriesOrder: 3
draft: false
---

주문 하나를 처리하는 함수는 만들었습니다. 이제 주문이 수천 건 들어옵니다. 스레드를 늘리면 될까요? 모든 함수를 `async def`로 바꾸면 빨라질까요?

먼저 할 질문은 따로 있습니다. **이 프로그램은 계산하느라 바쁜가, 응답을 기다리느라 멈춰 있는가?** 계산과 기다림은 다른 자원을 사용하므로 해결책도 달라집니다.

[1편](/posts/python-a-to-z-1/)은 언어의 실행 모델을, [2편](/posts/python-a-to-z-2/)은 코드의 경계를 다뤘습니다.

마지막 편은 Python 3.13의 일반 CPython 빌드를 기준으로 동시성과 운영을 정리합니다. free-threaded 빌드의 차이도 구분합니다.

## 1. 동시성과 병렬성: 여러 냄비와 여러 요리사

> **동시성**은 여러 작업의 진행 시간을 겹치는 것입니다. **병렬성**은 여러 작업을 실제로 같은 순간에 실행하는 것입니다.

요리사 한 명도 물이 끓는 동안 다른 재료를 손질할 수 있습니다. 이것이 기다림을 겹치는 동시성입니다. 칼질 자체를 동시에 더 많이 하려면 요리사가 여러 명 필요합니다. 이것이 병렬성입니다.

| 병목 | 먼저 검토할 방식 | 비용과 제약 |
| --- | --- | --- |
| 동기 라이브러리로 네트워크·파일 I/O 대기 | 스레드 풀 | 공유 상태, 연결 수, 타임아웃 관리 |
| async 지원 라이브러리로 많은 I/O 대기 | `asyncio` | 이벤트 루프를 막는 호출에 주의 |
| 순수 Python의 무거운 계산 | 프로세스 풀 | 프로세스 시작, 직렬화, 메모리 비용 |
| 네이티브 라이브러리 내부 계산 | 라이브러리 특성 확인 | GIL 해제와 자체 병렬화 여부가 다름 |

작업이 작다면 순차 실행이 더 단순하고 더 빠를 수도 있습니다. 병렬화에는 전달과 조율 비용이 붙습니다.

### GIL이 지키는 범위를 정확히 알기

일반 CPython 빌드의 GIL은 한 인터프리터에서 Python 코드를 실행하는 스레드를 제한합니다. 그래서 순수 Python CPU 연산을 스레드 여러 개로 나눈다고 여러 코어를 그대로 활용하지는 못합니다.

I/O 대기나 GIL을 해제하는 확장 모듈의 계산은 상황이 다릅니다.

**GIL은 업무 데이터의 락이 아닙니다.** "재고를 읽고, 충분한지 확인하고, 차감한다"처럼 여러 단계로 된 규칙을 보호하지 않습니다. 스레드가 공유하는 상태에는 적절한 락이, 여러 프로세스나 서버가 공유하는 데이터에는 DB의 원자 연산이나 트랜잭션 같은 별도 장치가 필요합니다.

Python 3.13에는 GIL을 끌 수 있는 실험적 free-threaded 빌드가 있습니다. 일반 빌드와 구분해야 하고, 확장 모듈의 지원 여부도 확인해야 합니다.

"Python은 언제나 GIL 때문에 병렬 실행이 불가능하다"와 "이제 모든 환경에서 GIL이 없어졌다"는 둘 다 부정확합니다. [Python 3.13 free-threading 공식 안내](https://docs.python.org/3.13/howto/free-threading-python.html)

### JVM에서는: CPU 계산도 여러 스레드로 병렬 실행할 수 있다

HotSpot JVM에는 일반 CPython의 GIL처럼 Java 코드 실행을 한 스레드로 제한하는 전역 락이 없습니다. 따라서 독립적인 CPU 계산을 플랫폼 스레드 풀에 나누면 여러 코어에서 실행할 수 있습니다. 코어 수와 작업 크기, 공유 락 경합에 따라 실제 효과는 달라집니다.

| 상황 | Java 21 / HotSpot | Python 3.13 / 일반 CPython |
| --- | --- | --- |
| 언어 코드로 된 CPU 계산 | 스레드 풀로 여러 코어 활용 가능 | 스레드는 GIL 제약, 프로세스 풀 검토 |
| I/O 대기 | 플랫폼·가상 스레드 또는 비동기 I/O | 스레드 또는 asyncio |
| 공유 상태 수정 | 락·원자 연산 등 필요 | GIL이 있어도 락·원자성 설계 필요 |

Java의 스레드 풀 크기 조정 경험을 Python CPU 작업에 그대로 적용하면 기대한 처리량이 나오지 않을 수 있습니다.

반대로 C 확장 내부에서 GIL을 해제하는 작업이라면 Python 스레드도 병렬 계산에 도움이 될 수 있습니다. 실행하는 코드가 어디에 있는지까지 봐야 합니다. [Java 플랫폼 스레드](https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html)

## 2. 스레드와 프로세스: 같은 집과 별도 작업장

스레드는 메모리를 함께 쓰기 쉬운 대신 상태 충돌을 조심해야 합니다. 프로세스는 실행 공간을 나누는 대신 데이터를 주고받는 비용을 부담합니다.

### 스레드 풀: 기다림을 겹친다

다음은 외부 API 대기를 `sleep`으로 대신한 실행 가능한 예제입니다. 실제 네트워크를 호출하지 않습니다.

```python
from concurrent.futures import ThreadPoolExecutor
from time import sleep


def check_delivery(order_id: int) -> str:
    sleep(0.05)  # 동기 I/O 대기를 흉내 낸다
    return f"{order_id}: 배송 준비"


with ThreadPoolExecutor(max_workers=3) as pool:
    for result in pool.map(check_delivery, [1042, 1043, 1044]):
        print(result)
```

`map`의 결과는 입력 순서로 읽습니다. 완료되는 순서로 처리해야 한다면 `submit`과 `as_completed`를 검토합니다.

작업 함수에서 발생한 예외는 결과를 꺼낼 때 전달됩니다.

실제 HTTP 호출에는 클라이언트의 타임아웃을 설정해야 합니다. Future 결과를 기다리는 시간을 제한했다고 실행 중인 스레드의 네트워크 작업까지 자동 종료되는 것은 아닙니다.

### 프로세스 풀: 계산을 여러 실행 공간에 나눈다

아래는 `cpu_example.py` 같은 파일로 저장해서 실행합니다.

```python
from concurrent.futures import ProcessPoolExecutor


def sum_squares(limit: int) -> int:
    return sum(number * number for number in range(limit))


def main() -> None:
    with ProcessPoolExecutor(max_workers=2) as pool:
        print(list(pool.map(sum_squares, [10, 20])))  # [285, 2470]


if __name__ == "__main__":
    main()
```

예제의 작은 계산은 동작 설명용이며 속도 향상을 기대하는 크기가 아닙니다.

작업 함수는 모듈 최상위에 정의하고, 전달할 인자와 결과는 직렬화할 수 있어야 합니다.

`__main__` 가드는 자식 프로세스가 모듈을 불러올 때 풀을 다시 만드는 일을 막습니다. REPL이나 노트북에서는 그대로 동작하지 않을 수 있습니다.

스레드 풀과 프로세스 풀의 계약은 [concurrent.futures 공식 문서](https://docs.python.org/3.13/library/concurrent.futures.html)에 정리되어 있습니다.

## 3. asyncio: 기다릴 때 차례를 양보한다

`async def`로 정의한 함수를 호출하면 코루틴 객체를 얻습니다. 호출만으로 작업이 끝나거나 자동 병렬 실행되는 것은 아닙니다.

```text
작업 A: 요청 ── await 대기 ─────────▶ 응답 처리
작업 B:         요청 ── await 대기 ───────▶ 응답 처리
이벤트 루프: 실행 가능한 작업을 번갈아 진행
```

`await`는 대기 대상이 완료되지 않았을 때 다른 작업이 진행할 기회를 줍니다. 이미 완료된 대상을 await하면 실제로 차례를 양보하지 않을 수도 있습니다.

다음 예제는 대기를 모사하며, `TaskGroup`과 `asyncio.timeout`은 Python 3.11 이상에서 사용할 수 있습니다.

```python
import asyncio


async def check_delivery(order_id: int, limit: asyncio.Semaphore) -> str:
    async with limit:
        await asyncio.sleep(0.05)
        return f"{order_id}: 배송 준비"


async def main() -> None:
    limit = asyncio.Semaphore(2)
    async with asyncio.timeout(2):
        async with asyncio.TaskGroup() as group:
            tasks = [
                group.create_task(check_delivery(order_id, limit))
                for order_id in [1042, 1043, 1044]
            ]
    print([task.result() for task in tasks])


if __name__ == "__main__":
    asyncio.run(main())
```

`TaskGroup`은 묶인 작업의 종료를 기다리고, 일반적인 작업 실패 시 나머지를 취소하며 오류를 전달합니다.

세마포어는 동시에 해당 구간에 들어가는 작업을 두 개로 제한합니다.

타임아웃은 전체 대기 구간의 시간을 제한하며, 취소에 협조하는 코드라는 전제가 있습니다.

실제 호출은 async 지원 클라이언트를 사용해야 합니다. 비동기 함수 안에서 `time.sleep()`이나 동기 HTTP 요청을 직접 실행하면 이벤트 루프가 멈춥니다.

기존 동기 I/O 함수를 연결할 때는 `asyncio.to_thread()`를 검토할 수 있지만, 취소해도 이미 실행 중인 스레드 작업이 강제로 중단되지는 않습니다. [asyncio 작업과 취소 공식 문서](https://docs.python.org/3.13/library/asyncio-task.html)

### JVM에서는: 가상 스레드와 asyncio는 같은 구현이 아니다

Java 21의 가상 스레드는 동기 호출 형태를 유지하면서 많은 대기 작업을 처리하도록 돕습니다. 지원되는 블로킹 I/O에서 가상 스레드가 대기하면, 이를 실행하던 플랫폼 스레드를 다른 가상 스레드에 사용할 수 있습니다.

Python asyncio는 `async`/`await`와 비동기 라이브러리로 양보 지점을 표현합니다.

| 구분 | Java 가상 스레드 | Python asyncio 태스크 |
| --- | --- | --- |
| 코드 표현 | 일반적인 동기 호출 형태 | 코루틴과 `await` |
| 실행 단위 | JVM이 스케줄링하는 `Thread` | 이벤트 루프가 진행하는 태스크 |
| 무거운 CPU 계산 | 코어가 늘어나는 것은 아님 | 이벤트 루프에서 직접 실행하면 다른 태스크 지연 |
| 외부 자원 제한 | 연결 풀·세마포어 등 별도 필요 | 연결 풀·세마포어 등 별도 필요 |

가상 스레드는 더 빠른 CPU 스레드가 아니며, asyncio도 함수를 자동 병렬화하지 않습니다. 둘 다 대기를 효율적으로 다룰 수 있지만, 같은 메커니즘으로 이해하면 블로킹 호출과 취소 동작을 잘못 옮기기 쉽습니다.

가상 스레드의 세부 제약은 JDK 버전에 따라서도 다릅니다. [Java 21 가상 스레드 안내](https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html)

### 동시 실행 수와 대기열 크기는 별개다

위 예제는 주문 세 건이라 모든 태스크를 만들어도 작습니다. 주문 백만 건을 같은 방식으로 태스크로 만들면 세마포어가 있어도 대기 중인 객체가 쌓입니다.

지속적으로 들어오는 작업은 크기가 제한된 `asyncio.Queue`와 고정된 워커 수를 고려합니다. 큐가 가득 차면 생산자도 기다리게 하여 입력 속도를 조절하는 것이 **백프레셔**입니다.

프로세스가 죽어도 남아야 하는 작업은 메모리 큐만으로 보관할 수 없습니다. 앞서 정리한 [RabbitMQ와 Kafka 글](/posts/rabbitmq-and-kafka/)의 전달 보증과도 연결되는 지점입니다.

## 4. 테스트: 실행되었다보다 무엇이 맞는가

테스트하기 쉬운 코드는 외부 환경 없이 업무 규칙을 확인할 수 있습니다. [2편](/posts/python-a-to-z-2/)의 `orders/pricing.py`를 대상으로 `tests/test_pricing.py`를 작성합니다.

```python
import unittest

from orders.pricing import total_amount


class PricingTest(unittest.TestCase):
    def test_paid_order_with_shipping(self):
        self.assertEqual(total_amount([12000, 27000], shipping=3000), 42000)

    def test_empty_order(self):
        self.assertEqual(total_amount([]), 0)

    def test_negative_price_is_rejected(self):
        with self.assertRaises(ValueError):
            total_amount([-1])

    def test_negative_shipping_is_rejected(self):
        with self.assertRaises(ValueError):
            total_amount([1000], shipping=-1)


if __name__ == "__main__":
    unittest.main()
```

프로젝트 루트에서 실행합니다.

```sh
python -m unittest discover -s tests -v
```

이 테스트는 "빈 주문을 0원으로 계산한다"는 예제의 계약을 고정합니다. 실제 서비스에서 빈 주문이 금지라면 코드와 테스트를 함께 바꿔야 합니다.

계산 규칙은 단위 테스트로, 실제 DB와 메시지 브로커의 계약은 통합 테스트로 확인합니다. 가짜 발송기를 사용한 테스트가 통과했다고 실제 메일 서버의 인증이나 타임아웃까지 검증된 것은 아닙니다.

표준 라이브러리만으로 시작할 수 있는 테스트 도구가 [unittest](https://docs.python.org/3.13/library/unittest.html)입니다.

## 5. 로깅: 작업의 흔적을 남긴다

로컬에서 값 하나를 확인할 때는 `print`도 충분합니다. 여러 요청이 동시에 실행되는 서비스에서는 시각, 심각도, 작업 식별자가 함께 필요합니다.

```python
import logging


logger = logging.getLogger(__name__)


def process_order(order_id: int) -> None:
    logger.info("order processed order_id=%s", order_id)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    process_order(1042)


if __name__ == "__main__":
    main()
```

설정은 진입점에서 하고 각 모듈은 자기 로거를 얻습니다. 예외 처리 경계에서는 `logger.exception(...)`으로 traceback을 함께 남길 수 있습니다.

비밀번호·토큰·결제 원문처럼 남기면 안 되는 입력은 통째로 기록하지 않습니다.

`logger.info("amount=%s", amount)`처럼 포맷 인자를 분리하면 로그 수준에 따라 문자열 결합을 미룰 수 있습니다. 다만 인자로 넘기는 비싼 함수 호출 자체까지 지연되는 것은 아닙니다. [logging 공식 문서](https://docs.python.org/3.13/library/logging.html)

## 6. 성능: 작업자를 늘리기 전에 병목을 찾는다

느리다는 느낌만으로 async나 프로세스 풀부터 붙이면 복잡성만 늘 수 있습니다.

1. 실제 크기의 입력으로 전체 처리 시간과 메모리를 확인합니다.
2. 프로파일러로 시간이 많이 드는 함수를 좁힙니다.
3. 반복 조회, 불필요한 변환, 전체 데이터 적재를 먼저 줄입니다.
4. 이후 병목이 I/O인지 CPU인지에 맞춰 동시성을 선택합니다.

```sh
# 실제 프로그램의 진입점에 맞게 모듈 이름을 바꾼다
python -m cProfile -s cumulative -m orders.main
```

짧은 연산 비교에는 `timeit`, Python 메모리 할당 추적에는 `tracemalloc`을 사용할 수 있습니다. 프로파일러도 실행 비용을 더하며, Python의 메모리 추적만으로 네이티브 확장 모듈의 모든 메모리 사용량을 설명할 수는 없습니다. [프로파일러 공식 문서](https://docs.python.org/3.13/library/profile.html)

대표적인 개선은 반복문 안에서 목록을 매번 검색하던 코드를, 한 번 만든 집합이나 딕셔너리 조회로 바꾸는 것입니다. 같은 일을 더 많은 작업자에게 시키기 전에, 하지 않아도 되는 일을 없앱니다.

### JVM에서는: GC 관찰 경험을 옮기되 회수 시점은 가정하지 않는다

JVM에서 도달할 수 없는 객체는 GC의 회수 대상이 됩니다. 일반 CPython은 참조 카운팅을 기본으로 순환 참조 수집을 함께 사용하므로, 참조가 사라진 직후 정리되는 모습이 더 자주 보일 수 있습니다.

하지만 그것을 Python 언어 전체의 즉시 해제 보장으로 생각하면 안 됩니다. 구현체나 객체 관계에 따라 달라집니다. [Java 객체 회수](https://docs.oracle.com/javase/specs/jls/se21/html/jls-12.html#jls-12.6), [Python 객체 수명](https://docs.python.org/3.13/reference/datamodel.html#objects-values-and-types)

따라서 두 환경 모두 파일·소켓 정리를 GC에 맡기지 않고 명시적인 자원 관리 구문으로 처리합니다. 메모리 문제 역시 단순히 “객체가 많다”보다 무엇이 참조를 계속 붙잡는지를 추적합니다.

## 7. 배포: 같은 코드를 같은 환경에서 실행하기

"제 컴퓨터에서는 됩니다"에는 코드 외에도 Python 버전, 설치된 패키지, 환경 변수, 작업 디렉터리가 들어 있습니다. 재현 가능한 실행에는 이 조건을 함께 관리해야 합니다.

| 관리할 대상 | 남길 정보 |
| --- | --- |
| Python | 지원 버전과 실제 실행 버전 |
| 의존성 | 직접 의존성과 실제로 해결된 버전 집합 |
| 실행 방법 | `python -m orders.main` 같은 진입점 |
| 설정 | 필수 환경 변수 이름, 기본값, 누락 시 동작 |
| 검증 | 테스트·정적 검사 실행 명령 |
| 종료 | 진행 중 작업을 마무리할 시간과 재처리 기준 |

작은 프로젝트에서는 깨끗한 가상환경의 설치 결과를 기록하는 방식으로 시작할 수 있습니다.

```sh
python -m pip freeze > requirements.txt
# 새 가상환경에서 재설치할 때
python -m pip install -r requirements.txt
python -m pip check
```

`pip freeze`는 현재 환경의 설치 목록입니다. 의도한 직접 의존성을 설계해 주거나 모든 운영체제에서 동일한 결과를 보장하는 잠금 파일은 아닙니다.

프로젝트가 커지면 `pyproject.toml`에 메타데이터와 직접 의존성을 선언하고, 선택한 도구가 제공하는 잠금·동기화 방식으로 재현 범위를 관리합니다.

`.venv` 자체를 복사해 배포하기보다 대상 환경에서 다시 만드는 편이 안전합니다. [pip freeze 공식 문서](https://pip.pypa.io/en/stable/cli/pip_freeze/)

## 정리: 시나리오로 고르기

| 해야 할 일 | 출발점 | 꼭 확인할 것 |
| --- | --- | --- |
| 주문 금액 계산 | 작은 순수 함수 | 음수·빈 입력·반올림 규칙 |
| 주문 파일 순차 집계 | 파일 순회 + 제너레이터 | 전체 적재 여부, 인코딩, 오류 행 처리 |
| 소수의 동기 API 요청 | 순차 처리 또는 작은 스레드 풀 | 타임아웃과 상대 서비스 제한 |
| 많은 비동기 API 요청 | async 클라이언트 + 제한된 동시성 | 대기열 크기, 취소, 연결 풀 |
| 무거운 순수 Python 계산 | 측정 후 프로세스 풀 검토 | 직렬화 비용, 작업 크기, 메모리 |
| 재시작해도 잃으면 안 되는 작업 | 외부 저장소·메시지 브로커 | 처리 완료 시점과 멱등성 |

세 편의 출발점은 같습니다. 변수에서는 **어떤 객체를 공유하는가**, 구조에서는 **누가 무엇을 책임지는가**, 동시성에서는 **어떤 자원을 기다리는가**를 묻습니다. 이 질문에 답할 수 있으면 짧은 스크립트에서 운영 프로그램으로 넘어갈 때도 선택의 이유가 분명해집니다.
