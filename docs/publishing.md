# 글 발행과 GitHub Pages

## 문서 선택부터 병합까지

1. 작성자가 공개할 원본 문서와 첨부파일을 직접 선택합니다. 볼트 전체를 자동으로 탐색하거나 첫 글을 임의로 선정하지 않습니다.
2. 원본·편집 제안·근거표·질문·모델 설정과 인증정보는 비공개 공간에 보관합니다. 사실 관계, 코드 실행 결과, 타인의 정보와 회사 내부 정보, 링크 및 이미지의 공개 가능 여부를 검토합니다. LLM 편집 도구는 후속 작업이며 이 저장소와 CI에서 모델을 호출하지 않습니다.
3. 검토한 최종 Markdown만 `src/content/posts/<slug>.md`, 필요한 공개 이미지만 `public/images/posts/<slug>/`에 반영합니다. 초안은 가능하면 비공개 공간에 둡니다. `draft: true` 본문은 공개 산출물에서 제외되지만 공개 Git 저장소에 커밋한 원문 자체는 누구나 읽을 수 있습니다.
4. 프론트매터를 아래 형식으로 작성합니다. `slug`는 고유한 케밥케이스, 날짜는 실제 `YYYY-MM-DD`입니다. `series`와 양의 정수 `seriesOrder`는 함께 지정하며, `cover`를 쓸 때는 같은 slug 이미지 경로와 대체 텍스트가 필요합니다.

   ```yaml
   ---
   title: 글 제목
   description: 짧은 설명
   slug: first-post
   publishedAt: '2026-10-09'
   tags: [기술, 기록]
   draft: false
   ---
   ```

5. `[[위키링크]]`는 공개 URL이나 Markdown 링크로 변환합니다. 첨부 경로와 이미지 대체 텍스트를 확인합니다. 미해결 위키링크, 중복 slug, 메타데이터 오류, 누락·미참조 이미지는 검증을 실패시킵니다. 사용하지 않는 비공개 첨부파일을 `public/`에 넣지 않습니다.
6. `npm run dev`에서 문체, 사실, 모바일 읽기, 코드·태그·검색을 확인한 뒤 실제 origin/base로 `npm run verify`를 실행합니다. 루트 도메인은 `BASE_PATH=/`, 프로젝트 Pages는 `BASE_PATH=/repo-name/`입니다. 예시 테스트는 별도 디렉터리에서 두 base를 자동 검증합니다.
7. 별도 브랜치에 확정 파일을 커밋하고 PR을 엽니다. 변경된 파일과 공개 범위를 검토하고 CI가 통과하면 main에 병합합니다. main은 동일 CI를 한 번 실행한 뒤 그 실행에서 검증된 `dist/`만 업로드·배포합니다.

## 저장소 연결 후 설정

2026-10-09 비공개 저장소 [iamseung/tech-blog](https://github.com/iamseung/tech-blog)를 연결하고 GitHub Pages에 첫 배포를 완료했습니다. 소스 저장소는 비공개이고 웹사이트는 공개입니다. 공개 주소는 https://iamseung.github.io/tech-blog/ 이며 HTTPS가 적용됩니다. 작성자 소개와 첫 글은 아직 정하지 않았습니다.

GitHub Settings → Pages의 Source는 **GitHub Actions**입니다. 저장소 Actions variables에 `SITE_URL=https://iamseung.github.io`, `BASE_PATH=/tech-blog/`가 설정돼 있습니다. 다른 저장소나 도메인으로 옮길 때는 다음 규칙으로 변경하세요.

- `SITE_URL`: `https://your-name.github.io` 또는 커스텀 도메인의 HTTP(S) origin. `/repo-name/`을 포함하지 않습니다.
- `BASE_PATH`: 사용자 사이트·커스텀 도메인은 `/`, 프로젝트 사이트는 `/repo-name/`.

변수는 시크릿이 아닙니다. 볼트 접근 정보나 모델 인증정보를 CI에 등록하지 않습니다. Node 22.23.3에서 `npm ci`와 Chromium 설치 후 전체 검증을 실행합니다. PR은 contents 읽기 권한으로만 검증하고, main 배포 작업만 pages 쓰기와 id-token 쓰기 권한을 갖습니다. 진행 중 배포는 새 push가 와도 취소하지 않습니다. main 브랜치의 **CI / verify** 검증을 보호 규칙의 필수 항목으로 지정하세요(실제 첫 실행에서 표시되는 check 이름을 확인).

워크플로는 [GitHub 공식 Pages 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)의 checkout v6, configure-pages v5, upload-pages-artifact v4, deploy-pages v4와 [setup-node 공식 안내](https://github.com/actions/setup-node)의 v7을 사용합니다. GitHub hosted `ubuntu-latest` runner에서 Action 런타임과 프로젝트 Node 22를 별도로 사용합니다.

배포 후 실제 주소에서 홈 → 글 → 태그 → 검색, 첨부 이미지, canonical, RSS와 sitemap을 확인하세요. 로컬 통과는 원격 CI나 배포 성공을 의미하지 않습니다. 첫 문서와 블로그 이름·소개·도메인을 확정하고 실제 CI·공개 URL을 확인해야 첫 발행이 완료됩니다.

## 이전 버전 복구

최근 변경을 되돌리려면 작업 브랜치에서 문제 커밋을 `git revert <commit>`로 취소하고 PR로 검토·병합하세요. main의 전체 검증 후 복구된 산출물을 배포합니다. 강제 push나 main 히스토리 삭제는 필요하지 않습니다.

과거 성공 실행의 동일 산출물을 다시 배포하려면 GitHub Actions에서 해당 main 실행을 선택해 **Re-run all jobs**를 실행합니다. 해당 커밋으로 검증과 빌드를 다시 수행하므로 artifact 보관 기간에 의존하지 않습니다. 실행 당시 코드와 현재 저장소 변수의 origin/base가 맞는지 확인하고 이후 실제 공개 URL을 다시 점검하세요.
