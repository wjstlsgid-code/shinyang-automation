# 신양파트너스 업무자동화 v5.12.7

## Netlify 404 수정
- `netlify.toml`의 `[build]`에 `publish = ".next"`를 복구했습니다.
- 기존 빌드 로그에서 `Starting to deploy site from '/'`가 확인되어 프로젝트 루트가 배포 대상으로 잡힌 것이 404의 직접 원인이었습니다.
- 재배포 후 로그에서 `Starting to deploy site from '.next'` 또는 Next.js/OpenNext 처리 문구를 확인하세요.
- `netlify/functions`의 `daily-backup.mts`, `daily-push.mts`는 그대로 유지합니다.

## v5.12.6 포함 수정 유지
- 노트북 좌측 메뉴 하단 잘림 보완
- 기존 견적서 소프트 삭제
- 기존 계약서 소프트 삭제
- 거래처 2025~2026 최근분 133건 반영용 자료/SQL 포함

## 재배포 확인 포인트
1. Next.js 15.x 감지
2. `npm run build` 성공
3. 배포 경로가 `/`가 아닌 `.next`로 표시되는지 확인
4. `/login` 접속 확인
5. 루트 `/` 접속 시 `/login`으로 이동하는지 확인
