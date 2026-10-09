# 기술 블로그

한국어 Markdown 기반 Astro 정적 블로그입니다. 공개용 글은 아직 없으며 개발 예시는 production 빌드에 포함되지 않습니다.

## 빠른 시작

Node.js 22.23.3과 npm을 준비한 뒤 실행하세요. 의존성은 lockfile에 고정되어 있습니다.

```sh
npm ci
npm run dev:demo
```

터미널에 표시된 로컬 주소에서 세 편의 검증용 글을 볼 수 있습니다. 실제 공개 파일만 보는 개발 서버는 `npm run dev`입니다. 데모는 개발 전용이며 `--mode demo` 빌드는 실패합니다.

## 검증

`.env.example`을 참고해 `.env`에 실제 `SITE_URL` origin과 `BASE_PATH`를 지정하거나 명령 앞에 환경 변수를 전달하세요. 개발 기본 주소는 `http://localhost:4321`입니다. production 빌드는 공개 origin이 없거나 경로·인증정보·query가 포함되면 실패합니다.

```sh
node_modules/node/bin/node node_modules/playwright/cli.js install chromium
SITE_URL=https://your-name.github.io BASE_PATH=/tech-blog/ npm run verify
```

`verify`는 타입 검사, 단위 테스트, production 빌드와 산출물 검사, 루트 및 `/tech-blog/` 브라우저 검증을 순서대로 실행합니다. production 결과는 `dist/`, 예시 검증은 별도 `dist-test/`에 생성됩니다. 브라우저 검증은 4323·4324 포트를 사용하므로 두 포트를 비워 두세요. 서로 같은 출력 디렉터리를 사용하므로 여러 검증·빌드를 동시에 실행하지 마세요.

공개 글은 `src/content/posts/`, 공개 이미지는 `public/images/posts/<slug>/`에 둡니다. 발행 절차와 GitHub Pages 설정은 [발행 안내](docs/publishing.md)를 따르세요.
