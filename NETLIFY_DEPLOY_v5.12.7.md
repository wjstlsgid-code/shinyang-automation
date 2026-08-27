# Netlify 배포 체크 — v5.12.7

## 이번 404 대응 변경
- Next.js 15.5 앱은 Netlify의 최신 OpenNext 자동 어댑터를 사용하도록 `@netlify/plugin-nextjs` 수동 지정 제거
- Netlify 루트 redirect 제거
- `/` 접근은 Next.js 자체에서 `/login`으로 서버 리다이렉트
- `netlify.toml`은 빌드 명령과 Node 22만 명시하고 나머지는 Framework detection에 맡김

## Netlify 기존 사이트에서 확인할 값
1. **Project configuration → Build & deploy**
2. Base directory / Package directory: 프로젝트가 저장소 루트라면 비워둠
3. Build command: `npm run build`
4. Publish directory: 자동 감지를 권장. Netlify가 표시한다면 `.next`
5. Next.js Runtime/Build plugin을 예전에 수동 고정했다면 제거/비활성화하고 최신 자동 어댑터 사용
6. Environment variables에 기존 Supabase/메일 관련 환경변수가 유지되어 있는지 확인
7. **Deploys → Trigger deploy → Clear cache and deploy site** 권장

## 배포 후 확인 순서
- `/` → `/login` 이동
- `/login` 화면 정상 표시
- 로그인 후 `/dashboard`
- 노트북 높이에서 좌측 메뉴 끝까지 스크롤 가능
- 기존 견적서 열기 → 상단 `삭제` 버튼
- 기존 계약서 열기 → 상단 `삭제` 버튼

## 거래처 133명
`import_clients_2025_2026_133.sql`을 실제 운영 Supabase SQL Editor에서 1회 실행합니다.
- 원본: `거래처_업데이트_2025-2026_중복제거.xlsx`
- 133명 / 105개 업체
- 기존 업체는 회사명 기준으로 최신 대표정보 보강
- 복수 담당자는 `client_contact`에 보존
- 견적/계약/프로젝트 데이터는 건드리지 않음


## v5.12.7 핵심 수정
`netlify.toml`에 `publish = ".next"`를 다시 추가했습니다. 이전 로그의 `Starting to deploy site from '/'` 상태를 바로잡기 위한 수정입니다.
