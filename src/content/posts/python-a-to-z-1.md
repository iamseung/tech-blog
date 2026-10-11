---
title: 'Python A to Z (1): 변수는 상자가 아니라 이름표다'
description: 'Java/JVM과 비교하며 Python의 실행 방식, 객체와 타입, 자료구조, 함수를 주문 처리 예제로 이해합니다.'
slug: python-a-to-z-1
publishedAt: '2026-10-10'
updatedAt: '2026-10-11'
tags: [Python, 프로그래밍, 기초]
series: python-a-to-z
seriesOrder: 1
draft: false
---

Python을 처음 보면 문법이 짧아서 금방 배울 것 같습니다. 세미콜론도 없고, 변수 앞에 타입도 적지 않습니다.

그런데 조금만 쓰면 이상한 일을 만납니다. 리스트를 다른 변수에 넣었는데 원본이 바뀌고, 함수의 기본값이 이전 호출의 내용을 기억합니다.

이런 현상은 문법을 더 외운다고 해결되지 않습니다. **Python의 변수는 값을 담는 상자가 아니라 객체에 붙이는 이름표**라는 관점을 먼저 잡아야 합니다.

이 시리즈는 Java의 기초 문법을 접한 개발자가 Python 코드를 읽고 작은 프로그램을 만들기까지 필요한 내용을 세 편에 나눕니다. A부터 Z까지 기능 이름을 나열하기보다, 실행 원리에서 출발해 실무에서 선택할 기준까지 연결합니다.

웹 프레임워크나 데이터 분석 라이브러리의 개별 사용법은 범위 밖입니다.

| 편 | 중심 질문 | 다루는 내용 |
| --- | --- | --- |
| **1편 · 현재 글** | 값은 어디에 있고 코드는 어떻게 실행될까? | 환경, 객체, 자료구조, 제어문, 함수 |
| [2편](/posts/python-a-to-z-2/) | 커진 코드를 어떻게 나눌까? | 모듈, 타입 힌트, 클래스, 제너레이터, 예외 |
| [3편](/posts/python-a-to-z-3/) | 여러 일을 처리하고 운영하려면? | 동시성, 테스트, 로깅, 성능, 배포 |

설명 기준은 **Python 3.13의 일반 CPython 빌드**이며, 비교 대상은 **Java 21과 HotSpot JVM**입니다.

Java는 언어이고 JVM은 실행 환경이므로, 문법·타입 비교에서는 Java를, 실행·메모리·스레드 비교에서는 JVM을 구분해서 부릅니다.

각 절의 Java/JVM 비교는 익숙한 개념을 연결하는 읽기 길잡이입니다. 특정 버전에서 달라지는 기능은 따로 표시합니다.

예제는 주문 금액과 주문 이벤트를 공통 소재로 쓰며, 별도 표시가 없으면 각 Python 코드 블록을 독립적으로 실행할 수 있습니다.

## 1. Python과 CPython: 언어와 실행기를 구분하기

Python은 언어이고 CPython은 그 언어를 실행하는 구현체입니다. 보통 설치해서 쓰는 `python`이 CPython입니다.

이 절에서 짚을 점은 하나입니다. **Python도 실행 전에 컴파일합니다. 다만 그 단계가 `python main.py` 한 명령 안에 숨어 있어서 보이지 않을 뿐입니다.**

"인터프리터 언어니까 소스를 한 줄씩 바로 실행한다"고 생각하기 쉽지만, CPython은 파일 전체를 먼저 읽어 **바이트코드**로 바꾼 뒤 실행합니다. 바이트코드는 CPU가 아니라 CPython 실행기가 읽는 명령 목록입니다.

![python main.py를 실행하면 CPython 내부에서 구문 분석, 바이트코드 컴파일, 실행기의 실행이 차례로 일어나고, import한 모듈의 바이트코드는 __pycache__ 아래 .pyc 파일로 저장되어 다음 실행에서 컴파일을 건너뛰는 구조](/images/posts/python-a-to-z-1/cpython-pipeline.svg)

컴파일이 먼저 일어난다는 사실은 직접 확인할 수 있습니다. 아래 파일은 2번째 줄의 괄호가 닫히지 않았습니다.

```python
print("주문 처리 시작")
total = (1000 +
```

한 줄씩 바로 실행한다면 "주문 처리 시작"이 먼저 출력되어야 합니다. 실제로는 아무것도 출력되지 않고 `SyntaxError: '(' was never closed`만 나옵니다. 그림의 ① 구문 분석 단계에서 멈추기 때문입니다.

`import`한 모듈의 바이트코드는 `__pycache__/` 아래 `.pyc` 파일로 저장됩니다. 다음 실행에서 소스가 바뀌지 않았다면 ①②를 건너뛰고 이 파일을 읽습니다. 직접 실행한 `main.py`는 저장하지 않습니다.

`.pyc`는 일반적인 네이티브 실행 파일이 아니라 컴파일 결과를 담아 둔 캐시입니다. 시작이 빨라질 뿐, 업무 로직 자체가 더 빠르게 계산되는 것은 아닙니다. 실행 진입점과 캐시 동작은 [공식 모듈 설명](https://docs.python.org/3.13/tutorial/modules.html)에서 확인할 수 있습니다.

### JVM에서는: 바이트코드라는 중간 단계는 닮았다

두 언어 모두 소스를 바이트코드로 바꾸고, 실행기가 그 바이트코드를 실행합니다. 다른 점은 **언제 컴파일하는가**와 **실행기가 무엇을 더 하는가**입니다.

![Java는 빌드할 때 javac가 .class 바이트코드를 만들어 배포하고 실행할 때 JVM이 해석하며 자주 실행되는 코드를 JIT로 기계어로 바꾼다. Python은 소스를 그대로 배포하고 실행할 때 CPython이 바이트코드로 컴파일한 뒤 실행기가 하나씩 해석한다](/images/posts/python-a-to-z-1/java-python-pipeline.svg)

Java는 빌드할 때 `javac`가 `.class` 파일을 만들고, 그 결과물을 배포합니다. Python은 보통 `.py` 소스를 배포하고, 프로그램을 시작하는 순간 CPython이 컴파일합니다.

실행 단계도 다릅니다. HotSpot은 실행 정보를 수집해 자주 실행되는 코드를 JIT로 기계어로 바꿉니다. 일반 CPython 빌드는 바이트코드를 실행기가 해석합니다. `.class`와 `.pyc`가 모두 바이트코드를 담는다고 성능 특성까지 같은 것은 아닙니다.

CPython 3.13에도 선택적으로 빌드하는 실험적 JIT가 있지만, 이 글은 그것을 전제하지 않습니다. [HotSpot 실행 최적화](https://docs.oracle.com/en/java/javase/21/vm/java-hotspot-virtual-machine-performance-enhancements.html), [Python 3.13의 실험적 JIT](https://docs.python.org/3.13/whatsnew/3.13.html#an-experimental-just-in-time-jit-compiler)

따라서 “Java는 컴파일하고 Python은 컴파일하지 않는다”보다 **컴파일이 언제 일어나고 결과를 어떤 실행기가 처리하는가**로 구분하는 편이 정확합니다.

### 프로젝트마다 공구함을 따로 둔다

프로젝트 A는 어떤 라이브러리의 1.x 버전을, B는 2.x 버전을 쓴다고 가정해 봅시다. 같은 설치 공간에서 버전을 바꾸면 다른 프로젝트도 영향을 받습니다. **가상환경은 프로젝트별 Python 패키지 설치 공간**이라서 각자 필요한 버전을 둘 수 있습니다.

먼저 이름을 구분합니다. `venv`는 Python에 포함된 **가상환경 생성 모듈**이고, `.venv`는 그 모듈로 만드는 **디렉터리 이름**입니다. `venv 파일` 하나를 만드는 것이 아닙니다. `.venv`라는 이름은 관례이며 다른 이름이나 경로도 가능합니다.

![프로젝트 A와 B가 각각 별도 .venv 안에 Python 실행 파일과 서로 다른 라이브러리 버전을 두며, 활성화하면 현재 터미널의 python 명령이 A의 실행 파일을 먼저 선택하는 구조](/images/posts/python-a-to-z-1/venv-toolboxes.svg)

그림의 공구함 안에는 실행 파일과 패키지가 있습니다. macOS/Linux에서 주요 구조는 다음과 같습니다. 설치한 패키지와 플랫폼에 따라 다른 파일도 생깁니다.

```text
project-a/
├── main.py                         # 내가 작성한 코드
├── requirements.txt                # 필요한 패키지 기록
└── .venv/                          # 생성되는 환경 디렉터리
    ├── pyvenv.cfg                  # 기반 Python과 환경 설정
    ├── bin/
    │   ├── python                 # Python 실행 파일의 복사본 또는 링크
    │   └── activate               # 현재 셸의 PATH를 바꾸는 스크립트
    └── lib/python3.13/site-packages/  # 이 환경에 설치한 패키지
```

`main.py`는 `.venv` 밖에 둡니다. `pyvenv.cfg`는 설정 파일이고, `activate`는 셸 스크립트입니다. Windows에서는 실행 파일이 `Scripts\`에, 패키지가 `Lib\site-packages\`에 들어갑니다. [venv 공식 문서의 생성 구조](https://docs.python.org/3.13/library/venv.html#creating-virtual-environments)

아래 명령은 Python 3.13이 설치된 macOS/Linux에서 **프로젝트 디렉터리 안에서** 실행합니다. 세 단계는 환경 생성 → 현재 터미널에서 선택 → 선택한 Python으로 실행입니다.

```sh
python3.13 -m venv .venv           # 1. 디렉터리 생성
source .venv/bin/activate         # 2. 이 셸에서 사용할 환경 선택
python --version
python -m pip --version           # pip 경로도 .venv 안인지 확인
python -c 'print("주문 처리 시작")'  # 3. 선택한 Python으로 실행
```

Windows PowerShell에서는 보통 `py -3.13 -m venv .venv`로 만들고 `.venv\Scripts\Activate.ps1`로 활성화합니다.

활성화는 현재 셸의 `PATH` 앞에 `.venv/bin`을 넣습니다. 이후 `python`을 입력하면 셸이 이 경로의 실행 파일을 먼저 찾습니다. 프로젝트 B로 `cd`만 했다고 B의 환경으로 자동 전환되지는 않습니다.

### pip: 패키지를 내려받아 설치하는 도구

위 명령에 나온 **pip는 Python 패키지 설치 도구**입니다. 남이 만든 라이브러리를 받아 내 환경에 넣는 일을 맡습니다. Python 3.13의 `venv`는 새 환경을 만들 때 pip도 함께 설치합니다.

![python -m pip install requests를 실행하면 PyPI에서 패키지를 찾고, 의존 패키지까지 내려받아, 실행한 Python의 .venv site-packages에 설치하며, main.py의 import requests는 이 위치에서 패키지를 찾는다](/images/posts/python-a-to-z-1/pip-install.svg)

`python -m pip install requests`를 실행하면 pip는 공개 패키지 저장소인 **PyPI**에서 `requests`를 찾습니다. `requests`가 필요로 하는 다른 패키지까지 내려받아 `site-packages/`에 설치합니다.

이후 코드에서 `import requests`를 쓰면 Python이 이 `site-packages/`에서 패키지를 찾습니다. 설치하지 않은 패키지를 import하면 `ModuleNotFoundError`가 납니다.

Java에 비유하면 PyPI는 Maven Central, `requirements.txt`는 `pom.xml`의 의존성 목록에 해당합니다. 다만 pip는 설치만 맡습니다. Maven·Gradle처럼 컴파일·테스트·패키징 같은 빌드 단계까지 관리하지는 않습니다.

중요한 점은 **pip가 자신을 실행한 Python의 환경에 설치한다**는 것입니다. 그래서 어떤 Python으로 pip를 실행했는지가 곧 설치 위치를 정합니다.

`python -m pip`는 **지금 선택한 Python으로 pip를 실행한다**는 뜻입니다. 활성화는 편의 기능이므로 `.venv/bin/python -m pip --version`처럼 경로를 직접 지정해도 됩니다. `deactivate`는 셸의 선택을 되돌리며 환경 디렉터리나 패키지를 지우지 않습니다. [venv 활성화 동작](https://docs.python.org/3.13/library/venv.html#how-venvs-work)

패키지는 환경을 만든 것만으로 설치되지 않습니다. 의존성을 기록한 `requirements.txt`가 있다면 활성화 후 `python -m pip install -r requirements.txt`로 설치합니다. 동료는 기록과 Python 버전을 공유받아 자기 환경을 다시 만들면 됩니다. [패키지 설치 공식 가이드](https://packaging.python.org/en/latest/guides/installing-using-pip-and-virtual-environments/)

`.venv/`는 Git 추적에서 제외하고, 작성한 코드와 의존성 기록을 관리합니다. 환경에는 절대 경로가 들어갈 수 있어 디렉터리째 다른 컴퓨터로 옮기는 방식은 적합하지 않습니다. Python 3.13의 `venv`는 기본적으로 내부에 Git 무시 파일도 생성합니다.

가상환경은 기반 Python 설치를 사용하며 Python 패키지 구성을 분리합니다. 운영체제까지 따로 실행하는 컨테이너와는 격리 범위가 다릅니다.

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

아래 그림은 Python과 Java의 대입 구조를 비교합니다. 화살표는 객체 연결을 뜻하며, 실제 주소나 스택·힙의 물리 배치를 그린 것은 아닙니다. 리스트 내부의 항목 참조는 읽기 쉽게 생략했습니다.

![Python에서 두 이름이 같은 리스트에 연결되고 Java에서 두 변수의 참조 값이 같은 ArrayList를 가리키는 구조. Python 정수는 객체에 이름을 연결하지만 Java int 변수는 기본형 값을 보유한다](/images/posts/python-a-to-z-1/python-java-references.svg)

반면 정수나 문자열은 내용을 제자리에서 바꿀 수 없는 **불변 객체**입니다.

```python
amount = 1000
backup = amount
amount += 500

print(amount, backup)  # 1500 1000
```

여기서는 `amount`가 연산 결과인 정수 객체를 가리키게 됩니다. `backup`이 가리키는 정수 1000을 수정한 것이 아닙니다.

함수 인자로 넘길 때도 같은 원리가 적용됩니다. 인자 이름이 전달받은 객체를 가리키므로, 리스트를 수정하면 호출자에게 보이고 이름을 재대입하면 그 이름의 연결만 바뀝니다.

호출자가 가진 목록을 바꾸는 경우와 함수 안의 이름만 바꾸는 경우도 직접 비교할 수 있습니다.

```python
def append_order(ids: list[int]) -> None:
    ids.append(1043)


def replace_orders(ids: list[int]) -> None:
    ids = [9999]  # 이 함수의 지역 이름만 새 목록으로 연결한다
    print(ids)


order_ids = [1042]
append_order(order_ids)
replace_orders(order_ids)  # [9999]
print(order_ids)           # [1042, 1043]
```

호출자에게 새 목록을 전달하려면 함수가 그 목록을 `return`하고 호출자가 반환값을 대입하도록 계약을 만듭니다.

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

Java의 참조형 변수에는 객체 자체가 아니라 **객체를 가리키는 참조 값**이 들어갑니다. 대입하면 그 참조 값이 복사되어 두 변수가 같은 객체를 가리킵니다. Python의 이름표 비유와 Java의 참조 값 설명은 표현이 다르지만, 위 리스트 공유 결과는 같습니다.

차이는 Java에 `int`, `boolean` 같은 기본형이 있고, Python에서는 정수도 객체라는 점입니다. Java의 `int backup = amount;`는 기본형 값을 복사합니다. Python의 `backup = amount`는 같은 정수 객체에 이름을 연결하며, `amount += 500`은 `amount`의 연결을 연산 결과로 바꿉니다. 두 경우 모두 `backup`은 1000으로 남지만 그 이유가 다릅니다.

Java의 `var`도 동적 타입이 아니라 컴파일 시 타입 추론입니다. Python 이름은 다른 타입의 객체로 다시 바인딩할 수 있지만, Java 변수에는 정해진 타입과 호환되는 값만 대입할 수 있습니다. [Java 타입과 변수 명세](https://docs.oracle.com/javase/specs/jls/se21/html/jls-4.html)

Java는 인자를 값으로 전달하며 객체의 경우 **참조 값이 복사**됩니다. Python도 함수 안의 이름을 재대입해서 호출자의 변수 연결을 바꿀 수는 없습니다. 두 언어 모두 “전달받은 객체 수정”과 “지역 이름 재대입”을 구분하면 헷갈리지 않습니다.

### 같은 값과 같은 객체는 다른 질문이다

먼저 `====`는 Python과 Java에 없는 연산자입니다. `===`도 두 언어에서 사용할 수 없습니다. Python에서 구분할 것은 **값의 동등성을 묻는 `==`와 객체의 동일성을 묻는 `is`**입니다.


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

Java의 기본형 `==`는 값 비교입니다. `equals`도 클래스가 어떻게 구현했는지에 따라 의미가 달라집니다.

Python의 `==` 역시 `__eq__`로 정의할 수 있으므로, 두 언어 모두 사용자 정의 객체의 동등성 계약을 확인해야 합니다. [Java 동등성 연산자](https://docs.oracle.com/javase/specs/jls/se21/html/jls-15.html#jls-15.21)

같은 내용의 리스트 두 개로 비교하면 차이가 바로 보입니다.

```python
first = [1042, 1043]
second = [1042, 1043]
alias = first

print(first == second)  # True: 항목의 값이 같다
print(first is second)  # False: 서로 다른 리스트다
print(first is alias)   # True: 같은 리스트를 가리킨다
```

![first와 alias는 리스트 A를, second는 내용이 같은 별도 리스트 B를 가리킨다. Python에서 first == second는 True, first is second는 False, first is alias는 True이다](/images/posts/python-a-to-z-1/equality-identity.svg)

그림에서 A와 B는 **같은 내용의 서로 다른 객체**입니다. 값이 같다는 사실만으로 같은 객체라고 결론 내릴 수 없습니다. [Python 비교 연산 명세](https://docs.python.org/3.13/reference/expressions.html#comparisons)

Java에서는 같은 질문에 쓰는 연산자가 다릅니다. `EqualityExample.java`로 저장해서 실행합니다.

```java
import java.util.ArrayList;
import java.util.List;

public class EqualityExample {
    public static void main(String[] args) {
        var first = new ArrayList<>(List.of(1042, 1043));
        var second = new ArrayList<>(List.of(1042, 1043));
        var alias = first;
        System.out.println(first.equals(second)); // true: 항목의 값 비교
        System.out.println(first == second);      // false: 참조 비교
        System.out.println(first == alias);       // true
    }
}
```

#### JavaScript의 `===`와도 구분하기

JavaScript에서 `==`는 타입 변환을 수반할 수 있고, `===`는 타입 변환 없이 비교합니다. 예를 들어 `1 == "1"`은 `true`, `1 === "1"`은 `false`입니다. 객체끼리의 `===`는 같은 객체인지 비교하며, 별도 배열 두 개의 내용을 비교해 주지는 않습니다. [ECMAScript 동등성 연산자 명세](https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html#sec-equality-operators)

Python의 `==`를 JavaScript의 `===`와 같은 의미로 외우면 안 됩니다. Python에서는 `1 == 1.0`이 `True`이고 `1 == "1"`은 `False`입니다. `is` 또한 타입까지 엄격하게 비교한다는 뜻이 아니라 객체의 동일성을 묻습니다.

### 대입·얕은 복사·깊은 복사: 어디까지 새로 만들까?

**대입**은 같은 객체를 공유합니다. **얕은 복사**는 바깥 컨테이너를 새로 만들고 내부 객체의 참조를 공유합니다. **깊은 복사**는 중첩된 객체를 재귀적으로 복사합니다. 아래 그림은 `{"id": 1042, "items": ["book"]}`의 가변 부분에 집중했습니다.

![대입은 하나의 딕셔너리와 내부 리스트를 공유하고, 얕은 복사는 서로 다른 딕셔너리에서 같은 내부 리스트를 공유하며, 깊은 복사는 딕셔너리와 내부 리스트를 각각 새로 만드는 구조](/images/posts/python-a-to-z-1/copy-depth.svg)

같은 주문으로 세 방식을 비교합니다. 깊은 복사를 만든 다음 공유 리스트를 수정하므로, 출력에서 어느 객체가 영향을 받았는지 볼 수 있습니다.

```python
import copy

order = {"id": 1042, "items": ["book"]}
alias = order
shallow = order.copy()
deep = copy.deepcopy(order)

print(alias is order)                      # True
print(shallow is order)                    # False
print(shallow["items"] is order["items"])   # True
print(deep["items"] is order["items"])      # False

shallow["items"].append("pen")
print(order["items"])   # ['book', 'pen']
print(alias["items"])   # ['book', 'pen']
print(shallow["items"]) # ['book', 'pen']
print(deep["items"])    # ['book']

deep["items"].append("cup")
print(order["items"])   # ['book', 'pen']
print(deep["items"])    # ['book', 'cup']

shallow["id"] = 9999    # 바깥 딕셔너리의 항목을 교체한다
print(order["id"], shallow["id"])  # 1042 9999
```

`shallow["items"].append(...)`는 공유 중인 리스트 자체를 수정합니다. 반면 `shallow["id"] = 9999`는 복사한 딕셔너리의 항목만 교체합니다. 얕은 복사에서 원본이 바뀌는지는 **어느 층을 수정하는가**에 달려 있습니다.

Python의 `list.copy()`, `list[:]`, `dict.copy()`는 얕은 복사입니다. 숫자처럼 불변 객체만 담았다면 공유된 항목을 제자리에서 수정할 수 없지만, 중첩 리스트가 있으면 공유가 드러납니다.

`deepcopy()`도 모든 객체를 무조건 새로 만드는 것은 아닙니다. 불변 객체는 재사용할 수 있고, 사용자 정의 클래스는 복사 방식을 조정할 수 있습니다. 한 번의 깊은 복사 안에서 원래 같은 객체를 여러 곳이 참조했다면 그 공유 관계도 보존하며, 파일·소켓 같은 외부 자원을 독립된 새 자원으로 복제해 주는 도구는 아닙니다. [Python copy 공식 문서](https://docs.python.org/3.13/library/copy.html)

#### Java에서도 새 컬렉션이 곧 깊은 복사는 아니다

`new ArrayList<>(original)`은 바깥 리스트를 새로 만들지만 각 요소의 참조는 공유합니다. 중첩 리스트라면 Python의 얕은 복사와 같은 일이 일어납니다. 다음은 `CopyExample.java`로 저장해서 실행합니다.

```java
import java.util.ArrayList;
import java.util.List;

public class CopyExample {
    public static void main(String[] args) {
        var items = new ArrayList<>(List.of("book"));
        var original = new ArrayList<List<String>>();
        original.add(items);
        var shallow = new ArrayList<>(original);

        // 이 예제는 중첩 리스트 안에 불변 String만 있다.
        var deep = new ArrayList<List<String>>();
        for (var row : original) {
            deep.add(new ArrayList<>(row));
        }

        shallow.get(0).add("pen");
        deep.get(0).add("cup");
        System.out.println(original);               // [[book, pen]]
        System.out.println(shallow);                // [[book, pen]]
        System.out.println(deep);                   // [[book, cup]]
        System.out.println(original == shallow);    // false
        System.out.println(original.get(0) == shallow.get(0)); // true
        System.out.println(original.get(0) == deep.get(0));    // false
    }
}
```

이 예제는 두 층의 리스트를 복사하면 가변 데이터가 분리됩니다. 요소가 수정 가능한 주문 객체라면 그 객체까지 복사하는 정책이 필요합니다. Java의 `ArrayList.clone()`도 얕은 복사이며 요소 자체를 복사하지 않습니다. [ArrayList 공식 API](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/ArrayList.html#clone())

큰 데이터를 무조건 깊게 복사하면 시간과 메모리 비용이 커집니다. 먼저 누가 어느 부분을 수정할지 정한 뒤, 필요한 범위만 복사합니다.

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

딕셔너리는 삽입 순서를 보존하지만 키를 자동 정렬하지는 않습니다.

빈 집합은 `set()`입니다. `{}`는 빈 딕셔너리입니다.

리스트를 큐로 쓰면서 앞에서 계속 꺼내야 한다면 `collections.deque`의 `popleft()`가 더 어울립니다. 각 컨테이너의 기본 연산은 [공식 자료구조 설명](https://docs.python.org/3.13/tutorial/datastructures.html)에 정리되어 있습니다.

주문 처리에서는 같은 입력을 서로 다른 목적으로 가공합니다. ID로 조회할 때는 딕셔너리, 중복을 없앨 때는 집합, 먼저 온 작업부터 꺼낼 때는 큐가 어울립니다.

```python
from collections import deque

orders = [{"id": 1042, "amount": 39000}, {"id": 1043, "amount": 12000}]
by_id = {order["id"]: order for order in orders}
print(by_id[1043]["amount"])  # 12000

received_ids = [1042, 1042, 1043]
unique_ids = set(received_ids)
print(sorted(unique_ids))    # [1042, 1043]: 출력 순서는 명시적으로 정한다

pending = deque([1042, 1043])
pending.append(1044)
print(pending.popleft())     # 1042
print(list(pending))         # [1043, 1044]
```

`by_id`는 원래 주문 객체를 복사하지 않습니다. 또한 같은 ID가 여러 번 나오면 뒤의 값이 앞의 값을 덮습니다. 이 입력에서 중복 ID를 오류로 볼지, 최신 값으로 볼지는 별도로 정해야 합니다.

### Java에서는: 같은 이름의 숫자 타입도 범위가 다르다

Java의 `int`는 32비트, `long`은 64비트 정수이고 큰 정수는 `BigInteger`로 다룹니다. Python의 `int`는 메모리가 허용하는 범위에서 커집니다. 그래서 Java의 정수 오버플로를 Python에서도 그대로 기대하면 안 됩니다.

Python의 `float`는 일반적으로 Java의 `double`에 가까운 배정밀도입니다. [Java 기본형 명세](https://docs.oracle.com/javase/specs/jls/se21/html/jls-4.html#jls-4.2)

컬렉션은 `ArrayList` ↔ `list`, `HashSet` ↔ `set`을 출발점으로 삼으면 됩니다. 다만 Python `dict`는 삽입 순서를 보존하므로 순서 관점에서는 Java의 `LinkedHashMap`이 더 가까운 비교 대상입니다. 이름이 비슷하다고 순서·수정 가능성까지 같다고 가정하지 않습니다.

### 금액에서 소수점은 별도 결정이다

```python
from decimal import Decimal

print(0.1 + 0.2 == 0.3)  # False
price = Decimal("0.10")
fee = Decimal("0.20")
print(price + fee)        # 0.30
```

`Decimal(0.1)`은 이미 근사된 float를 가져옵니다. 십진수 원문을 보존하려면 문자열로 만듭니다.

원 단위 정수로 충분한 서비스라면 `int`가 더 단순할 수 있습니다.

통화별 최소 단위와 반올림 시점은 언어가 아니라 업무 규칙으로 정해야 합니다. 자세한 동작은 [Decimal 공식 문서](https://docs.python.org/3.13/library/decimal.html)를 참고합니다.

### 문자열과 바이트 사이에는 인코딩이 있다

```python
text = "주문 완료"
payload = text.encode("utf-8")
print(type(payload).__name__)      # bytes
print(payload.decode("utf-8"))     # 주문 완료
```

네트워크와 파일 경계에서는 바이트가 오갑니다. 그 바이트를 어떤 문자 규칙으로 읽을지 알아야 문자열이 됩니다.

`str(payload)`는 디코딩이 아니라 바이트 객체의 표현을 만드는 것이므로 대체할 수 없습니다.

## 4. 제어문: 인덱스보다 항목을 직접 읽는다

Python은 들여쓰기로 블록을 구분합니다. 보통 공백 네 칸을 사용하며 탭과 섞지 않습니다.

`for`는 숫자 카운터 전용 구문이 아니라 순회 가능한 대상에서 값을 하나씩 꺼내는 구문입니다.

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

배송비 0원을 정상 입력으로 받는 상황을 코드로 확인해 보겠습니다.

```python
def shipping_fee(value: int | None) -> int:
    return 3000 if value is None else value


for value in (None, 0, 2500):
    print(value, value or 3000, shipping_fee(value))
# None 3000 3000
# 0 3000 0       ← or를 쓰면 무료 배송이 3000원으로 바뀐다
# 2500 2500 2500
```

이 함수는 이미 검증한 내부 입력을 받는 예제입니다. 금액 범위와 외부 입력 타입 검증은 별도 경계에서 처리합니다.

## 5. 함수: 입력과 결과의 경계를 만든다

```python
def total_amount(prices: list[int], *, shipping: int = 0) -> int:
    if shipping < 0 or any(price < 0 for price in prices):
        raise ValueError("금액은 음수일 수 없습니다")
    return sum(prices) + shipping


print(total_amount([12000, 27000], shipping=3000))  # 42000
```

### 함수의 `*`: 인자를 어떻게 전달할지 정하는 경계

함수 정의에서 **혼자 있는 `*`는 인자 이름이 아니라 구분선**입니다. 이 구분선 뒤에 오는 인자는 호출할 때 반드시 이름을 적어 전달합니다. 이를 **키워드 전용 인자**라고 부릅니다. 곱셈 기호로 읽지 않습니다.

앞의 정의를 세 부분으로 나누면 읽기 쉽습니다.

![함수 정의의 prices는 위치 또는 이름으로 전달할 수 있고, 단독 별표 뒤의 shipping은 이름으로만 전달한다. shipping을 생략하면 0을 쓰며 3000을 위치로 전달하면 TypeError가 발생한다](/images/posts/python-a-to-z-1/keyword-only.svg)

`prices`는 첫 번째 자리에 넣거나 `prices=...`로 전달할 수 있습니다. `shipping`은 `*` 뒤에 있으므로 `shipping=3000`처럼 이름을 적어야 합니다. `= 0`은 생략했을 때 사용할 기본값입니다.

아래 예제는 독립적으로 실행할 수 있도록 같은 함수 정의를 포함했습니다. 잘못된 호출은 `try`로 감싸 오류의 종류를 확인합니다.

```python
def total_amount(prices: list[int], *, shipping: int = 0) -> int:
    if shipping < 0 or any(price < 0 for price in prices):
        raise ValueError("금액은 음수일 수 없습니다")
    return sum(prices) + shipping


print(total_amount([12000, 27000]))                 # 39000: shipping 생략
print(total_amount([12000, 27000], shipping=3000))  # 42000
print(total_amount(prices=[12000, 27000], shipping=3000))  # 42000

try:
    total_amount([12000, 27000], 3000)
except TypeError:
    print("shipping은 이름을 붙여 전달해야 합니다")
```

마지막 호출의 `3000`은 두 번째 **위치 인자**입니다. 함수가 허용하는 위치 인자는 `prices` 하나뿐이라서 함수 본문을 실행하기 전에 `TypeError`가 납니다. `shipping=3000`이라고 쓰면 금액이 배송비라는 점도 드러납니다.

`list[int]`와 `-> int`는 타입 힌트이며, 실제 입력을 자동으로 검증하지는 않습니다. 그 경계는 2편에서 다룹니다.

타입 힌트와 달리 **키워드 전용 규칙은 실행 중 실제로 강제됩니다**. “타입 힌트가 검증되지 않으니 `*`도 안내일 뿐”이라고 생각하면 안 됩니다. [Python 공식 문서의 키워드 전용 인자](https://docs.python.org/3.13/tutorial/controlflow.html#keyword-only-arguments)

### `*args`, `**kwargs`: 여러 인자를 모으는 표기

별표 뒤에 이름이 붙으면 역할이 달라집니다. 함수 정의의 `*args`는 추가 위치 인자를 **튜플**로, `**kwargs`는 추가 키워드 인자를 **딕셔너리**로 모읍니다. `args`와 `kwargs`는 관례적인 이름이며 다른 이름도 사용할 수 있습니다.

```python
def show_arguments(*args, **kwargs):
    print(args)
    print(kwargs)


show_arguments(1042, 1043, status="paid", shipping=3000)
# (1042, 1043)
# {'status': 'paid', 'shipping': 3000}
```

`1042`, `1043`은 이름 없이 위치로 전달되어 `args`에 모입니다. `status="paid"`, `shipping=3000`은 이름과 함께 전달되어 `kwargs`에 모입니다. 두 묶음은 전달 방식으로 나뉩니다.

`def f(*args, shipping=0)`처럼 함께 쓸 수도 있습니다. 이 경우 `*args` 다음의 `shipping`도 키워드 전용이므로 단독 `*`를 따로 넣지 않습니다.

### 호출할 때의 `*`와 `**`: 묶음을 다시 펼친다

함수 **정의**에서 별표는 모으거나 경계를 정하지만, 함수 **호출**에서는 기존 묶음을 인자로 펼칩니다. `*`는 순회 가능한 대상의 항목을 위치 인자로, `**`는 문자열 키를 가진 매핑의 항목을 키워드 인자로 전달합니다.

```python
def show_arguments(*args, **kwargs):
    print(args)
    print(kwargs)


ids = [1042, 1043]
options = {"status": "paid", "shipping": 3000}
show_arguments(*ids, **options)
# show_arguments(1042, 1043, status="paid", shipping=3000)과 같다
# (1042, 1043)
# {'status': 'paid', 'shipping': 3000}
```

`total_amount`에 가격 목록을 전달할 때는 `total_amount(prices)`처럼 목록 하나를 그대로 넘깁니다. `total_amount(*prices)`는 가격들을 각각의 위치 인자로 펼치므로 앞의 함수 계약과 맞지 않습니다. [공식 문서의 인자 펼치기](https://docs.python.org/3.13/tutorial/controlflow.html#unpacking-argument-lists)

| 표기 | 사용 위치 | 역할 |
| --- | --- | --- |
| `def f(a, *, b)` | 함수 정의 | `b`는 이름으로만 전달 |
| `def f(*args)` | 함수 정의 | 위치 인자를 튜플로 모으기 |
| `def f(**kwargs)` | 함수 정의 | 키워드 인자를 딕셔너리로 모으기 |
| `f(*items)` | 함수 호출 | 항목을 위치 인자로 펼치기 |
| `f(**options)` | 함수 호출 | 항목을 키워드 인자로 펼치기 |

함수가 무엇을 받는지 알 수 있다면 이름 있는 인자를 먼저 쓰는 편이 읽기 쉽습니다. 인자를 무조건 `*args`, `**kwargs`로 받기보다 전달 규칙이 드러나도록 정의합니다.

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

Java에서는 선택 인자를 메서드 오버로드나 빌더로 표현하는 경우가 많습니다. Python은 기본값과 키워드 인자를 직접 지원합니다.

같은 이름으로 `def`를 두 번 쓴다고 Java처럼 인자 타입별 구현이 쌓이지 않습니다. 같은 이름을 나중 함수로 다시 바인딩합니다.

Java 메서드 본문에서 매번 `new ArrayList<>()`를 만들면 호출마다 새 객체가 생깁니다. Python의 `bucket=[]`는 **함수 본문 밖의 기본값 표현식**이므로 생성 시점이 다릅니다.

Java에서도 `static` 필드에 목록을 하나 두고 재사용하면 공유 문제는 생깁니다. 문법 모양보다 객체를 언제 만드는지가 핵심입니다. [Java 메서드 오버로드](https://docs.oracle.com/javase/specs/jls/se21/html/jls-8.html#jls-8.4.9)

## 정리: 첫 프로그램을 쓰기 전에

- 실행하는 Python과 패키지를 설치하는 Python이 같은가?
- 대입과 복사, 얕은 복사와 깊은 복사를 구분했는가?
- 자료구조를 조회·순서·중복이라는 요구에 맞게 골랐는가?
- 0, 빈 값, `None`을 업무 규칙에 맞게 구분했는가?
- 함수의 가변 기본값이 호출 사이에 공유되고 있지 않은가?

Python의 짧은 문법을 편하게 쓰려면 객체의 수명과 공유부터 이해해야 합니다. [다음 편](/posts/python-a-to-z-2/)에서는 이 원리를 바탕으로 함수를 모듈과 객체로 묶고, 실패와 자원 정리까지 구조 안에 넣습니다.
