---
title: 'Python A to Z (2): 함수에서 프로그램으로'
description: 'Java의 타입·record·interface·Stream과 비교하며 Python의 모듈, 객체, 제너레이터, 예외 처리 경계를 만듭니다.'
slug: python-a-to-z-2
publishedAt: '2026-10-10'
tags: [Python, 설계, 타입힌트]
series: python-a-to-z
seriesOrder: 2
draft: false
---

처음에는 파일 하나로 충분합니다. 주문을 읽고, 금액을 계산하고, 결과를 출력합니다. 그런데 메일 발송과 재시도가 붙으면 어느 부분을 바꿔야 하는지 흐려집니다.

코드를 나눈다는 것은 파일 수를 늘리는 일이 아닙니다. **어떤 데이터가 들어오고, 누가 상태를 바꾸고, 실패하면 누가 책임지는지 경계를 만드는 일**입니다.

[1편](/posts/python-a-to-z-1/)에서 변수와 객체를 살펴봤습니다. 이번에는 Python 3.13 기준으로 함수들을 하나의 프로그램으로 구성하는 방법을 정리합니다. 각 코드 블록은 독립 예제이며, 파일 이름을 지정한 예제만 안내된 구조로 함께 저장합니다.

## 1. 모듈과 패키지: 주소를 붙여 코드를 나눈다

> **모듈과 패키지**
>
> 모듈은 코드를 담는 단위로, 보통 `.py` 파일 하나입니다. 패키지는 여러 모듈을 묶어 점으로 구분하는 이름 공간을 제공합니다.

처음에는 다음 정도면 충분합니다.

```text
project/
├── orders/
│   ├── __init__.py
│   ├── pricing.py
│   └── main.py
└── tests/
```

`orders/pricing.py`에는 계산만 둡니다.

```python
def total_amount(prices: list[int], *, shipping: int = 0) -> int:
    if shipping < 0 or any(price < 0 for price in prices):
        raise ValueError("금액은 음수일 수 없습니다")
    return sum(prices) + shipping
```

`orders/main.py`는 실행 진입점입니다.

```python
from orders.pricing import total_amount


def main() -> None:
    print(total_amount([12000, 27000], shipping=3000))


if __name__ == "__main__":
    main()
```

프로젝트 루트에서 `python -m orders.main`으로 실행합니다. `__init__.py`는 비워 두어도 됩니다. 여기서는 일반 패키지 구조를 사용하며, 해당 파일이 없는 namespace package는 별도 기능입니다.

### import도 코드를 실행한다

모듈을 처음 import하면 최상위 문장이 실행됩니다. 그래서 import만 했는데 DB에 연결하거나 배치 작업이 시작되는 구조는 테스트하기 어렵습니다. 실행 동작을 함수에 넣고 `__name__` 가드로 진입점을 구분합니다.

또한 파일 이름을 `json.py`, `typing.py`처럼 표준 라이브러리와 같게 만들면 의도한 모듈 대신 자신의 파일을 불러올 수 있습니다. import 오류를 만났을 때 설치 문제만 보지 말고 파일 이름과 실행 위치도 확인합니다. 검색 경로와 모듈 실행은 [공식 모듈 문서](https://docs.python.org/3.13/tutorial/modules.html)에 설명되어 있습니다.

### Java에서는: import 문 자체가 초기화 명령은 아니다

Java의 `import`는 코드에서 타입 등의 이름을 짧게 참조하도록 하는 선언입니다. import했다고 해당 클래스의 `static` 초기화 블록이 바로 실행되지는 않습니다. 클래스 초기화는 인스턴스 생성이나 특정 정적 멤버 사용 등 별도 조건에서 일어납니다. Python의 import는 모듈의 최상위 코드를 실행할 수 있다는 점이 다릅니다. [Java 클래스 초기화 조건](https://docs.oracle.com/javase/specs/jls/se21/html/jls-12.html#jls-12.4.1)

Java의 유틸리티 클래스와 `static` 메서드를 그대로 옮길 필요도 없습니다. 상태가 없는 계산이라면 Python 모듈 안의 함수로 시작하면 됩니다.

## 2. 타입 힌트: 안내판과 출입 검사는 다르다

```python
def repeat(message: str, count: int) -> str:
    return message * count


print(repeat("paid ", 2))  # paid paid
```

타입 힌트는 작성자와 도구가 코드를 이해하도록 돕습니다. 정적 검사기가 잘못된 호출을 찾아줄 수 있지만, Python 실행기가 힌트만 보고 자동으로 입력을 거부하지는 않습니다.

외부 JSON에서는 다른 장치가 필요합니다.

```python
import json


def parse_amount(body: str) -> int:
    data = json.loads(body)
    if not isinstance(data, dict):
        raise ValueError("주문은 JSON 객체여야 합니다")
    amount = data.get("amount")
    if type(amount) is not int or amount < 0:
        raise ValueError("amount는 0 이상의 정수여야 합니다")
    return amount


print(parse_amount('{"amount": 39000}'))  # 39000
```

여기서 `type(amount) is int`는 의도적인 선택입니다. Python의 `bool`은 `int`의 하위 타입이므로 `isinstance(True, int)`는 참입니다. 외부 입력 `true`를 1원으로 받지 않으려면 이 차이를 다뤄야 합니다.

복잡한 입력은 별도의 검증 계층을 둘 수 있습니다. 어느 도구를 쓰든 **타입 설명과 실행 중 검증은 별개의 책임**입니다. `Any`는 검사를 느슨하게 만드는 탈출구라서, 외부 입력 전체에 붙이면 보호가 약해집니다. 타입 힌트와 `Protocol`의 의미는 [typing 공식 문서](https://docs.python.org/3.13/library/typing.html)를 기준으로 합니다.

### Java에서는: 컴파일러가 강제하는 계약이 있다

Java에서 정수 인자에 문자열을 넘기는 호출은 보통 컴파일 단계에서 거부됩니다. Python의 `count: int`는 실행기가 같은 검사를 강제한다는 뜻이 아닙니다. 정적 검사 도구를 CI에 넣을지 직접 정해야 합니다.

그렇다고 Java의 타입이 JSON 입력과 업무 규칙을 모두 검증하는 것도 아닙니다. `int amount`만으로 음수가 금지되지 않고, `List<String>`도 타입 소거 때문에 런타임에 모든 원소를 자동 검증하는 스키마가 되지는 않습니다. **두 언어 모두 외부 입력 경계의 검증이 필요하고, 기본으로 강제되는 정적 검사 범위가 다릅니다.** [Java 정적 타입과 타입 소거](https://docs.oracle.com/javase/specs/jls/se21/html/jls-4.html#jls-4.6)

## 3. 클래스: 같이 움직이는 상태와 동작을 묶는다

데이터를 주고받기만 한다면 딕셔너리도 충분합니다. 하지만 `order["amout"]` 같은 오타를 줄이고 필드의 의미를 드러내고 싶다면 `dataclass`가 유용합니다.

```python
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Order:
    order_id: int
    amount: int

    def __post_init__(self) -> None:
        if self.amount < 0:
            raise ValueError("주문 금액은 음수일 수 없습니다")


@dataclass
class Batch:
    orders: list[Order] = field(default_factory=list)


first = Batch()
second = Batch()
first.orders.append(Order(1042, 39000))
print(len(first.orders), len(second.orders))  # 1 0
```

`dataclass`는 생성자, 표현, 동등성 비교 같은 반복 코드를 만들어 줍니다. `default_factory=list`는 인스턴스마다 새 목록을 만듭니다. 클래스 속성에 목록을 하나 두고 모든 인스턴스가 공유하는 실수를 피할 수 있습니다.

`frozen=True`는 필드의 재대입을 막는 장치입니다. 내부에 리스트가 있으면 그 리스트까지 깊게 불변으로 만들지는 않습니다. 또한 `amount: int`라는 선언만으로 문자열 입력이 자동 차단되지는 않습니다. 이 예제의 객체는 검증된 내부 데이터를 받는다는 전제입니다. 생성 규칙은 [dataclasses 공식 문서](https://docs.python.org/3.13/library/dataclasses.html)를 참고합니다.

### Java에서는: record와 닮았지만 같은 기능은 아니다

Java의 `record Order(int orderId, int amount)`도 데이터 전달 객체의 반복 코드를 줄입니다. Python `dataclass`와 목적은 비슷하지만, Java record의 컴포넌트 필드는 final이고 Python dataclass는 기본적으로 필드 변경이 가능합니다. `frozen=True`를 켜야 재대입을 제한합니다.

둘 다 참조하는 내부 리스트까지 자동으로 불변이 되지는 않습니다. 또한 Java record는 다른 클래스를 상속할 수 없는 final 클래스인 반면, Python dataclass는 일반 클래스에 메서드 생성 등의 처리를 더하는 방식입니다. DTO를 옮길 때는 “필드 선언이 짧다”보다 변경 가능성과 검증 규칙을 맞춰야 합니다. [Java record 명세](https://docs.oracle.com/javase/specs/jls/se21/html/jls-8.html#jls-8.10)

### 상속보다 필요한 동작을 먼저 정한다

Python에서는 특정 부모 클래스를 상속했는지보다 "필요한 동작을 제공하는가"에 초점을 맞출 수 있습니다. 이를 흔히 덕 타이핑이라고 부릅니다.

```python
from typing import Protocol


class Sender(Protocol):
    def send(self, message: str) -> None: ...


class ConsoleSender:
    def send(self, message: str) -> None:
        print(message)


def notify_paid(order_id: int, sender: Sender) -> None:
    sender.send(f"주문 {order_id} 결제 완료")


notify_paid(1042, ConsoleSender())
```

`ConsoleSender`는 `Sender`를 상속하지 않습니다. 필요한 메서드의 형태가 맞는지 정적 검사 도구가 확인할 수 있습니다. 테스트에서는 수신 내용을 기록하는 가짜 발송기를, 운영에서는 실제 발송기를 전달할 수 있습니다.

`Protocol`도 기본적으로 런타임 입력 검증기가 아닙니다. 상속 계층을 만들기 전에 호출자가 정말 필요한 작은 동작부터 정의하는 것이 핵심입니다.

Java의 `interface`는 일반적으로 클래스가 `implements`로 구현 관계를 선언합니다. Python의 `Protocol`은 그 선언 없이 필요한 메서드의 형태가 맞는지를 정적으로 확인하는 **구조적 타이핑**입니다. 메서드 이름만 같다고 Java 인터페이스 구현체가 되는 것은 아니라는 차이를 기억하면 됩니다. [Java 인터페이스 명세](https://docs.oracle.com/javase/specs/jls/se21/html/jls-9.html)

## 4. 이터레이터와 제너레이터: 창고 대신 컨베이어 벨트

리스트는 결과를 미리 모아 둔 창고에 가깝습니다. 제너레이터는 요청받을 때 다음 값을 만들어 내는 컨베이어 벨트입니다.

> **이터러블과 이터레이터**
>
> 이터러블은 순회할 수 있는 대상이고, 이터레이터는 다음 값을 꺼낼 위치를 기억하는 객체입니다. 제너레이터는 이터레이터를 만드는 편리한 방법입니다.

```python
def paid_amounts(orders):
    for order in orders:
        if order["status"] == "paid":
            yield order["amount"]


orders = [
    {"status": "paid", "amount": 39000},
    {"status": "cancelled", "amount": 12000},
]
amounts = paid_amounts(orders)
print(sum(amounts))  # 39000
print(list(amounts)) # [] — 이미 끝까지 소비했다
```

`yield`는 값을 하나 돌려주고 다음 진행 위치를 기억합니다. 결과 목록 전체를 만들지 않아도 되지만, 입력부터 거대한 리스트로 읽었다면 그 메모리는 그대로 필요합니다. 파일 읽기부터 집계까지 흐름 전체가 조금씩 처리되어야 효과가 있습니다.

제너레이터는 한 번 소비하면 끝납니다. 다시 읽어야 한다면 새로 만들거나, 크기가 감당될 때 목록으로 보관합니다. 지연 실행되므로 예외도 생성 시점이 아니라 순회 시점에 발생할 수 있습니다. 순회 모델은 [공식 클래스 문서의 이터레이터·제너레이터 절](https://docs.python.org/3.13/tutorial/classes.html#iterators)에 설명되어 있습니다.

### Java에서는: Stream의 지연 처리와 연결해서 이해한다

Java Stream의 `filter`·`map`처럼 Python 제너레이터도 필요한 시점까지 계산을 미룰 수 있습니다. 반면 `[... for ...]` 형태의 리스트 컴프리헨션은 즉시 목록을 만듭니다.

Stream과 제너레이터 모두 소비 후 재사용을 기대하면 안 됩니다. 다만 끝난 Python 제너레이터를 다시 순회하면 보통 빈 결과가 나오고, Java Stream은 재사용을 감지하면 `IllegalStateException`을 던질 수 있습니다. 제너레이터 자체에 `parallelStream()` 같은 병렬 실행 기능이 붙는 것도 아닙니다. [Java Stream 계약](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/stream/Stream.html)

## 5. 함수도 객체다: 데코레이터는 포장지

함수를 다른 함수에 전달하거나 반환할 수 있습니다. 데코레이터는 이 성질로 기존 함수 앞뒤에 동작을 감쌉니다.

```python
from functools import wraps
from time import perf_counter


def timed(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        started = perf_counter()
        try:
            return func(*args, **kwargs)
        finally:
            print(f"{func.__name__}: {perf_counter() - started:.6f}s")
    return wrapper


@timed
def total(prices):
    return sum(prices)


print(total([12000, 27000]))  # 실행 시간 다음에 39000 출력
```

`@timed`는 대략 `total = timed(total)`과 같습니다. `wrapper`는 바깥의 `func`를 기억하는 클로저입니다. `wraps`는 원래 함수의 이름과 문서 등의 메타데이터를 보존합니다. [functools 공식 문서](https://docs.python.org/3.13/library/functools.html#functools.wraps)

이 예제는 동기 함수용입니다. 비동기 함수에 그대로 붙이면 코루틴 객체를 만드는 시간만 재고 실제 완료 시간은 재지 못합니다. 데코레이터를 붙이면 실행 계약도 맞는지 확인해야 합니다.

### Java에서는: annotation과 같은 기호, 다른 동작

Java의 `@Override` 같은 annotation은 메타데이터이며 컴파일러나 도구가 해석합니다. Python의 `@timed`는 정의 시점에 데코레이터를 적용해 함수를 감싸거나 바꿉니다. Java에서도 프레임워크가 annotation을 읽어 프록시 등의 동작을 붙일 수 있지만, annotation 문법 자체가 함수 래핑을 뜻하지는 않습니다. [Java annotation 명세](https://docs.oracle.com/javase/specs/jls/se21/html/jls-9.html#jls-9.7)

## 6. 예외와 with: 실패와 정리도 정상 경로다

실패를 없애는 프로그램은 없습니다. 중요한 것은 실패의 의미를 보존하고 책임 있는 위치까지 전달하는 것입니다.

```python
def parse_order_id(raw: str) -> int:
    try:
        order_id = int(raw)
    except ValueError as exc:
        raise ValueError("주문 ID는 정수 문자열이어야 합니다") from exc
    if order_id <= 0:
        raise ValueError("주문 ID는 양수여야 합니다")
    return order_id


print(parse_order_id("1042"))  # 1042
```

`raise ... from exc`는 원인을 연결합니다. 사용자에게 설명할 문맥을 더하면서도, 로그에는 최초 변환 오류가 남습니다.

| 구문 | 맡는 책임 |
| --- | --- |
| `try` | 실패를 구분하고 싶은 좁은 작업 |
| `except` | 이 위치에서 의미 있게 처리할 수 있는 실패 |
| `else` | 예외 없이 끝난 뒤의 작업 |
| `finally` | 성공·실패와 관계없이 필요한 정리 |
| `with` | 자원 획득과 종료 규약을 한 블록에 묶기 |

`except Exception: pass`로 삼키면 실패한 주문이 정상 처리된 것처럼 보일 수 있습니다. 반대로 모든 계층에서 같은 예외를 로그로 남기면 한 번의 실패가 여러 건처럼 보입니다. 처리할 수 없는 예외는 올리고, 요청이나 작업의 경계에서 한 번 기록하는 기준이 유용합니다. [공식 예외 처리 문서](https://docs.python.org/3.13/tutorial/errors.html)

### 파일은 읽기만큼 닫기도 중요하다

다음 예제는 임시 폴더를 사용하므로 외부 파일 준비 없이 실행할 수 있습니다.

```python
import json
from pathlib import Path
from tempfile import TemporaryDirectory


with TemporaryDirectory() as directory:
    path = Path(directory) / "order.json"
    path.write_text('{"id": 1042}', encoding="utf-8")
    with path.open(encoding="utf-8") as stream:
        order = json.load(stream)
    print(order["id"])  # 1042
```

JSON 파싱에 실패해도 파일의 컨텍스트 관리자는 닫기를 수행합니다. 파일뿐 아니라 락, 트랜잭션 등도 해당 객체가 제공하는 컨텍스트 관리 규약으로 수명을 명확히 할 수 있습니다. 다만 모든 `with`가 커밋을 뜻하는 것은 아닙니다. 종료 동작은 객체마다 다릅니다.

### Java에서는: try-with-resources와 연결하되 예외 계약은 다르다

Java의 try-with-resources는 `AutoCloseable` 자원의 `close()`를 호출합니다. Python의 `with`는 컨텍스트 관리자의 진입·종료 메서드를 호출하며, 파일 닫기 외에도 여러 규약을 표현할 수 있습니다. 종료 메서드가 예외를 억제할 수도 있으므로 사용하는 관리자의 계약을 확인합니다. [Java try-with-resources](https://docs.oracle.com/javase/specs/jls/se21/html/jls-14.html#jls-14.20.3)

또한 Python에는 Java의 checked exception처럼 호출자가 잡거나 선언하도록 컴파일러가 강제하는 예외 구분이 없습니다. 호출자가 처리할 실패 종류를 문서와 테스트로 드러내는 일이 더 중요합니다. [Java 예외 검사 명세](https://docs.oracle.com/javase/specs/jls/se21/html/jls-11.html#jls-11.2)

## 정리: 경계를 나누는 기준

- 계산 함수는 파일·네트워크 없이 실행할 수 있는가?
- import만 해도 외부 작업이 시작되지 않는가?
- 타입 힌트와 외부 입력 검증을 구분했는가?
- 공유 상태와 인스턴스별 상태가 명확한가?
- 제너레이터를 두 번 읽으려 하지 않는가?
- 실패 원인을 보존하고 자원을 닫는가?

함수, 클래스, 패키지를 모두 쓴다고 구조가 좋아지는 것은 아닙니다. 주문 금액을 계산하는 부분과 주문 데이터를 가져오는 부분처럼 **변경 이유가 다른 일을 나누는 것**부터 시작하면 됩니다. [3편](/posts/python-a-to-z-3/)에서는 이 구조 위에 동시성과 운영 장치를 붙입니다.
