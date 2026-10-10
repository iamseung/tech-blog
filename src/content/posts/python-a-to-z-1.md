---
title: 'Python A to Z (1): 변수는 상자가 아니라 이름표다'
description: 'Java/JVM과 비교하며 Python의 실행 방식, 객체와 타입, 자료구조, 함수를 주문 처리 예제로 이해합니다.'
slug: python-a-to-z-1
publishedAt: '2026-10-10'
tags: [Python, 프로그래밍, 기초]
series: python-a-to-z
seriesOrder: 1
draft: false
---

Python을 처음 보면 문법이 짧아서 금방 배울 것 같습니다. 세미콜론도 없고, 변수 앞에 타입도 적지 않습니다. 그런데 조금만 쓰면 이상한 일을 만납니다. 리스트를 다른 변수에 넣었는데 원본이 바뀌고, 함수의 기본값이 이전 호출의 내용을 기억합니다.

이런 현상은 문법을 더 외운다고 해결되지 않습니다. **Python의 변수는 값을 담는 상자가 아니라 객체에 붙이는 이름표**라는 관점을 먼저 잡아야 합니다.

이 시리즈는 Java의 기초 문법을 접한 개발자가 Python 코드를 읽고 작은 프로그램을 만들기까지 필요한 내용을 세 편에 나눕니다. A부터 Z까지 기능 이름을 나열하기보다, 실행 원리에서 출발해 실무에서 선택할 기준까지 연결합니다. 웹 프레임워크나 데이터 분석 라이브러리의 개별 사용법은 범위 밖입니다.

| 편 | 중심 질문 | 다루는 내용 |
| --- | --- | --- |
| **1편 · 현재 글** | 값은 어디에 있고 코드는 어떻게 실행될까? | 환경, 객체, 자료구조, 제어문, 함수 |
| [2편](/posts/python-a-to-z-2/) | 커진 코드를 어떻게 나눌까? | 모듈, 타입 힌트, 클래스, 제너레이터, 예외 |
| [3편](/posts/python-a-to-z-3/) | 여러 일을 처리하고 운영하려면? | 동시성, 테스트, 로깅, 성능, 배포 |

설명 기준은 **Python 3.13의 일반 CPython 빌드**이며, 비교 대상은 **Java 21과 HotSpot JVM**입니다. Java는 언어이고 JVM은 실행 환경이므로, 문법·타입 비교에서는 Java를, 실행·메모리·스레드 비교에서는 JVM을 구분해서 부릅니다. 각 절의 Java/JVM 비교는 익숙한 개념을 연결하는 읽기 길잡이입니다. 특정 버전에서 달라지는 기능은 따로 표시합니다. 예제는 주문 금액과 주문 이벤트를 공통 소재로 쓰며, 별도 표시가 없으면 각 Python 코드 블록을 독립적으로 실행할 수 있습니다.

## 1. Python과 CPython: 언어와 실행기를 구분하기

Python은 언어이고 CPython은 그 언어를 실행하는 구현체입니다. 보통 설치해서 쓰는 `python`이 CPython입니다.

"인터프리터 언어니까 소스를 한 줄씩 바로 실행한다"고만 생각하면 절반만 맞습니다. CPython은 소스를 파싱하고 바이트코드로 컴파일한 뒤, 그 명령을 실행합니다.

```text
.py 소스 → 구문 분석 → 코드 객체·바이트코드 → CPython 실행기
                           │
                           └─ import한 모듈은 .pyc 캐시를 만들 수 있다
```

`.pyc`는 일반적인 네이티브 실행 파일이 아닙니다. 모듈을 다시 불러올 때 소스 컴파일 비용을 줄이는 캐시입니다. 캐시가 생겼다고 업무 로직 자체가 더 빠르게 계산되는 것은 아닙니다. 실행 진입점과 캐시 동작은 [공식 모듈 설명](https://docs.python.org/3.13/tutorial/modules.html)에서 확인할 수 있습니다.

### JVM에서는: 바이트코드라는 중간 단계는 닮았다

```text
Java:   .java → javac → .class 바이트코드 → JVM → 실행·JIT 컴파일
Python: .py   → CPython 내부 컴파일 → 바이트코드 → 실행
```

HotSpot은 실행 정보를 수집하고 자주 실행되는 코드를 기계어로 컴파일하는 JIT를 사용합니다. `.class`와 `.pyc`가 모두 중간 표현을 담는다고 두 실행기의 최적화 방식까지 같은 것은 아닙니다. CPython 3.13에도 선택적으로 빌드하는 실험적 JIT가 있지만, 이 글은 그것을 전제하지 않습니다. [HotSpot 실행 최적화](https://docs.oracle.com/en/java/javase/21/vm/java-hotspot-virtual-machine-performance-enhancements.html), [Python 3.13의 실험적 JIT](https://docs.python.org/3.13/whatsnew/3.13.html#an-experimental-just-in-time-jit-compiler)

따라서 “Java는 컴파일하고 Python은 컴파일하지 않는다”보다 **컴파일이 언제 일어나고 결과를 어떤 실행기가 처리하는가**로 구분하는 편이 정확합니다.

### 프로젝트마다 공구함을 따로 둔다

프로젝트 A와 B가 같은 라이브러리의 다른 버전을 쓴다면, 컴퓨터 전체에 하나만 설치하는 방식은 충돌하기 쉽습니다. 가상환경은 프로젝트별 공구함입니다.

```sh
# Python 3.13이 설치된 macOS/Linux 기준
python3.13 -m venv .venv
source .venv/bin/activate
python --version
python -m pip --version
python -c 'print("주문 처리 시작")'
```

Windows PowerShell에서는 보통 `py -3.13 -m venv .venv`로 만들고 `.venv\Scripts\Activate.ps1`로 활성화합니다.

`python -m pip`는 **지금 선택한 Python으로 pip를 실행한다**는 뜻입니다. 설치는 A 환경에 하고 실행은 B 환경으로 하는 실수를 줄입니다. 활성화는 PATH를 바꾸는 편의 기능이므로, `.venv/bin/python`을 직접 실행해도 됩니다.

가상환경은 Python 패키지 구성을 분리합니다. 운영체제나 모든 시스템 라이브러리까지 격리하는 컨테이너와는 범위가 다릅니다. 생성과 활성화 절차는 [Python Packaging 공식 가이드](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/)를 기준으로 했습니다.

## 2. 변수: 상자가 아니라 이름표

> **객체와 바인딩**
>
> 객체는 타입과 값, 정체성을 가진 대상입니다. 변수에 대입한다는 것은 이름을 그 객체에 연결하는 일입니다.

```python
original = [1042, 1043]
alias = original
alias.append(1044)

print(original)          # [1042, 1043, 1044]
print(original is alias) # True
```

`alias = original`은 리스트를 복사하지 않습니다. 같은 리스트에 이름표 하나를 더 붙입니다.

```text
original ──┐
           ├──▶ [1042, 1043, 1044]
alias ─────┘
```

반면 정수나 문자열은 내용을 제자리에서 바꿀 수 없는 **불변 객체**입니다.

```python
amount = 1000
backup = amount
amount += 500

print(amount, backup)  # 1500 1000
```

여기서는 `amount`가 연산 결과인 정수 객체를 가리키게 됩니다. `backup`이 가리키는 정수 1000을 수정한 것이 아닙니다. 함수 인자로 넘길 때도 같은 원리가 적용됩니다. 인자 이름이 전달받은 객체를 가리키므로, 리스트를 수정하면 호출자에게 보이고 이름을 재대입하면 그 이름의 연결만 바뀝니다.

### Java에서는: 참조 공유는 같고, 기본형의 취급은 다르다

Java에서도 리스트 대입은 객체 복사가 아닙니다. 아래 코드를 `ReferenceExample.java`로 저장하면 앞의 Python 예제와 같은 공유를 확인할 수 있습니다.

```java
import java.util.ArrayList;
import java.util.List;

public class ReferenceExample {
    public static void main(String[] args) {
        var original = new ArrayList<>(List.of(1042, 1043));
        var alias = original;
        alias.add(1044);
        System.out.println(original);         // [1042, 1043, 1044]
        System.out.println(original == alias); // true
    }
}
```

차이는 Java에 `int`, `boolean` 같은 기본형이 있고, Python에서는 정수도 객체라는 점입니다. Java의 `var`도 동적 타입이 아니라 컴파일 시 타입 추론입니다. Python 이름은 다른 타입의 객체로 다시 바인딩할 수 있지만, Java 변수에는 정해진 타입과 호환되는 값만 대입할 수 있습니다. [Java 타입과 변수 명세](https://docs.oracle.com/javase/specs/jls/se21/html/jls-4.html)

Java는 인자를 값으로 전달하며 객체의 경우 **참조 값이 복사**됩니다. Python도 함수 안의 이름을 재대입해서 호출자의 변수 연결을 바꿀 수는 없습니다. 두 언어 모두 “전달받은 객체 수정”과 “지역 이름 재대입”을 구분하면 헷갈리지 않습니다.

### 같은 값과 같은 객체는 다른 질문이다

- `==`: 두 값이 같은가?
- `is`: 정확히 같은 객체인가?
- `value is None`: 값이 없음을 나타내는 객체인가?

숫자나 문자열의 값 비교에 `is`를 쓰면 안 됩니다. 구현체가 일부 객체를 재사용해서 우연히 맞는 결과가 나올 수 있습니다. 객체와 변경 가능성은 [Python 데이터 모델](https://docs.python.org/3.13/reference/datamodel.html#objects-values-and-types)에 정의되어 있습니다.

Java 코드에서 넘어올 때 비교 연산자는 특히 주의합니다.

| 묻는 것 | Java | Python |
| --- | --- | --- |
| 같은 객체인가? | 참조형의 `a == b` | `a is b` |
| 값이 같은가? | 보통 `a.equals(b)` | `a == b` |
| 값이 없는가? | `a == null` | `a is None` |

Java의 기본형 `==`는 값 비교입니다. `equals`도 클래스가 어떻게 구현했는지에 따라 의미가 달라집니다. Python의 `==` 역시 `__eq__`로 정의할 수 있으므로, 두 언어 모두 사용자 정의 객체의 동등성 계약을 확인해야 합니다. [Java 동등성 연산자](https://docs.oracle.com/javase/specs/jls/se21/html/jls-15.html#jls-15.21)

### 얕은 복사는 한 층만 복사한다

```python
order = {"id": 1042, "items": ["book"]}
copy = order.copy()
copy["items"].append("pen")

print(order["items"])  # ['book', 'pen']
print(order is copy)   # False
```

바깥 딕셔너리는 둘이지만 안쪽 리스트는 하나입니다. `copy.deepcopy()`로 중첩 객체까지 복사할 수는 있지만, 큰 데이터를 무조건 깊게 복사하면 비용이 커지고 의도적으로 공유하던 관계도 달라집니다. 먼저 "누가 이 데이터를 수정해도 되는가"를 정하는 편이 낫습니다.

## 3. 자료형: 모양보다 할 일로 고르기

| 자료형 | 어울리는 일 | 주의점 |
| --- | --- | --- |
| `int` | 주문 수, 원 단위 정수 금액 | 메모리가 허용하는 범위에서 큰 정수를 표현 |
| `float` | 측정값, 근사 계산 | 십진 소수를 정확히 표현하지 못할 수 있음 |
| `str` / `bytes` | 텍스트 / 바이트 데이터 | 인코딩·디코딩 경계를 명확히 구분 |
| `list` | 순서대로 쌓는 항목 | 중간 검색·삭제 비용에 주의 |
| `tuple` | 위치로 의미를 묶는 고정 구성 | 내부에 가변 객체가 있으면 그것은 바뀔 수 있음 |
| `dict` | 주문 ID로 주문 조회 | 키는 해시 가능해야 함 |
| `set` | 중복 제거, 포함 여부 | 순서를 전제로 사용하지 않음 |

딕셔너리는 삽입 순서를 보존하지만 키를 자동 정렬하지는 않습니다. 빈 집합은 `set()`입니다. `{}`는 빈 딕셔너리입니다. 리스트를 큐로 쓰면서 앞에서 계속 꺼내야 한다면 `collections.deque`의 `popleft()`가 더 어울립니다. 각 컨테이너의 기본 연산은 [공식 자료구조 설명](https://docs.python.org/3.13/tutorial/datastructures.html)에 정리되어 있습니다.

### Java에서는: 같은 이름의 숫자 타입도 범위가 다르다

Java의 `int`는 32비트, `long`은 64비트 정수이고 큰 정수는 `BigInteger`로 다룹니다. Python의 `int`는 메모리가 허용하는 범위에서 커집니다. 그래서 Java의 정수 오버플로를 Python에서도 그대로 기대하면 안 됩니다. Python의 `float`는 일반적으로 Java의 `double`에 가까운 배정밀도입니다. [Java 기본형 명세](https://docs.oracle.com/javase/specs/jls/se21/html/jls-4.html#jls-4.2)

컬렉션은 `ArrayList` ↔ `list`, `HashSet` ↔ `set`을 출발점으로 삼으면 됩니다. 다만 Python `dict`는 삽입 순서를 보존하므로 순서 관점에서는 Java의 `LinkedHashMap`이 더 가까운 비교 대상입니다. 이름이 비슷하다고 순서·수정 가능성까지 같다고 가정하지 않습니다.

### 금액에서 소수점은 별도 결정이다

```python
from decimal import Decimal

print(0.1 + 0.2 == 0.3)  # False
price = Decimal("0.10")
fee = Decimal("0.20")
print(price + fee)        # 0.30
```

`Decimal(0.1)`은 이미 근사된 float를 가져옵니다. 십진수 원문을 보존하려면 문자열로 만듭니다. 원 단위 정수로 충분한 서비스라면 `int`가 더 단순할 수 있습니다. 통화별 최소 단위와 반올림 시점은 언어가 아니라 업무 규칙으로 정해야 합니다. 자세한 동작은 [Decimal 공식 문서](https://docs.python.org/3.13/library/decimal.html)를 참고합니다.

### 문자열과 바이트 사이에는 인코딩이 있다

```python
text = "주문 완료"
payload = text.encode("utf-8")
print(type(payload).__name__)      # bytes
print(payload.decode("utf-8"))     # 주문 완료
```

네트워크와 파일 경계에서는 바이트가 오갑니다. 그 바이트를 어떤 문자 규칙으로 읽을지 알아야 문자열이 됩니다. `str(payload)`는 디코딩이 아니라 바이트 객체의 표현을 만드는 것이므로 대체할 수 없습니다.

## 4. 제어문: 인덱스보다 항목을 직접 읽는다

Python은 들여쓰기로 블록을 구분합니다. 보통 공백 네 칸을 사용하며 탭과 섞지 않습니다. `for`는 숫자 카운터 전용 구문이 아니라 순회 가능한 대상에서 값을 하나씩 꺼내는 구문입니다.

```python
orders = [
    {"id": 1042, "status": "paid", "amount": 39000},
    {"id": 1043, "status": "cancelled", "amount": 12000},
]

for index, order in enumerate(orders, start=1):
    if order["status"] != "paid":
        continue
    print(f'{index}번째 주문: {order["id"]}, {order["amount"]:,}원')

paid_ids = [order["id"] for order in orders if order["status"] == "paid"]
print(paid_ids)  # [1042]
```

컴프리헨션은 "걸러서 변환한다"를 짧게 표현할 때 좋습니다. 분기와 중첩이 늘어나면 일반 `for` 문으로 풀어 씁니다. 압축한 글자 수보다 다음 사람이 실행 순서를 읽기 쉬운지가 기준입니다.

슬라이싱의 끝 인덱스는 포함하지 않습니다. `items[:3]`은 앞의 세 항목이고 `items[-1]`은 마지막 항목입니다. `range(3)`도 0, 1, 2까지입니다.

### 0과 값 없음은 같지 않다

`None`, 숫자 0, 빈 문자열과 빈 컨테이너는 조건식에서 거짓으로 취급됩니다. 그래서 `if not amount`는 금액이 없는 경우와 0원인 경우를 구분하지 못합니다. 무료 주문이 가능하다면 `amount is None`으로 검사해야 합니다.

`value or default`도 같은 함정이 있습니다. 0이나 빈 문자열을 정상 입력으로 인정하는지 먼저 결정합니다. 제어문과 함수 문법은 [공식 제어 흐름 문서](https://docs.python.org/3.13/tutorial/controlflow.html)를 기준으로 합니다.

## 5. 함수: 입력과 결과의 경계를 만든다

```python
def total_amount(prices: list[int], *, shipping: int = 0) -> int:
    if shipping < 0 or any(price < 0 for price in prices):
        raise ValueError("금액은 음수일 수 없습니다")
    return sum(prices) + shipping


print(total_amount([12000, 27000], shipping=3000))  # 42000
```

`*` 뒤의 `shipping`은 이름을 적어 전달해야 하는 인자입니다. `total_amount(prices, 3000)`보다 금액의 의미가 분명해집니다. `list[int]`와 `-> int`는 타입 힌트이며, 실제 입력을 자동으로 검증하지는 않습니다. 그 경계는 2편에서 다룹니다.

함수에는 위치 인자, 키워드 인자, 기본값이 있습니다. `*args`는 추가 위치 인자를 튜플로, `**kwargs`는 추가 키워드 인자를 딕셔너리로 모읍니다. 함수가 무엇을 받는지 알 수 있다면 이름 있는 인자를 먼저 쓰는 편이 읽기 쉽습니다.

### 기본값은 호출할 때마다 만들어지지 않는다

다음은 의도적으로 잘못 만든 예입니다.

```python
def collect(order_id, bucket=[]):
    bucket.append(order_id)
    return bucket


print(collect(1042))  # [1042]
print(collect(1043))  # [1042, 1043] — 이전 호출의 값이 남는다
```

기본값 표현식은 함수가 정의될 때 평가됩니다. 같은 리스트를 다음 호출에서도 재사용한 것입니다. 호출마다 새 목록이 필요하다면 이렇게 씁니다.

```python
def collect(order_id: int, bucket: list[int] | None = None) -> list[int]:
    if bucket is None:
        bucket = []
    bucket.append(order_id)
    return bucket


print(collect(1042))  # [1042]
print(collect(1043))  # [1043]
```

이 문제도 결국 이름표와 객체의 관계입니다. 함수가 값을 기억하는 마법이 아니라, 여러 호출이 하나의 가변 객체를 함께 수정한 것입니다.

### Java에서는: 오버로드와 기본 인자를 구분한다

Java에서는 선택 인자를 메서드 오버로드나 빌더로 표현하는 경우가 많습니다. Python은 기본값과 키워드 인자를 직접 지원합니다. 같은 이름으로 `def`를 두 번 쓴다고 Java처럼 인자 타입별 구현이 쌓이지 않습니다. 같은 이름을 나중 함수로 다시 바인딩합니다.

Java 메서드 본문에서 매번 `new ArrayList<>()`를 만들면 호출마다 새 객체가 생깁니다. Python의 `bucket=[]`는 **함수 본문 밖의 기본값 표현식**이므로 생성 시점이 다릅니다. Java에서도 `static` 필드에 목록을 하나 두고 재사용하면 공유 문제는 생깁니다. 문법 모양보다 객체를 언제 만드는지가 핵심입니다. [Java 메서드 오버로드](https://docs.oracle.com/javase/specs/jls/se21/html/jls-8.html#jls-8.4.9)

## 정리: 첫 프로그램을 쓰기 전에

- 실행하는 Python과 패키지를 설치하는 Python이 같은가?
- 대입과 복사, 얕은 복사와 깊은 복사를 구분했는가?
- 자료구조를 조회·순서·중복이라는 요구에 맞게 골랐는가?
- 0, 빈 값, `None`을 업무 규칙에 맞게 구분했는가?
- 함수의 가변 기본값이 호출 사이에 공유되고 있지 않은가?

Python의 짧은 문법을 편하게 쓰려면 객체의 수명과 공유부터 이해해야 합니다. [다음 편](/posts/python-a-to-z-2/)에서는 이 원리를 바탕으로 함수를 모듈과 객체로 묶고, 실패와 자원 정리까지 구조 안에 넣습니다.
