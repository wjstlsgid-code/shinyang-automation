# 신양파트너스 업무자동화 v5.12.6

## 반영사항
- Netlify Next.js 최신 OpenNext 자동 어댑터 방식으로 배포 설정 정리
  - 레거시 `@netlify/plugin-nextjs` 직접 지정 제거
  - 루트 Netlify redirect 제거
  - `/`는 Next.js 서버에서 `/login`으로 리다이렉트
- 노트북/낮은 화면 높이에서 좌측 메뉴 하단 잘림 수정
  - 메뉴 영역 자체 스크롤
  - 프로필/로그아웃 영역 고정
  - 낮은 화면에서는 메뉴 간격 자동 축소
- 견적서 기존 작성본 삭제 버튼 추가
  - `deleted_at` 소프트 삭제
  - 연결 프로젝트/수금자료 보존
- 계약서 기존 작성본 삭제 버튼 추가
  - `deleted_at` 소프트 삭제
  - 연결 거래처/프로젝트/견적서 보존
- 2025~2026 최신 거래처 133명 import SQL 포함
  - 업체명 기준 기존 거래처 최신정보 보강
  - 동일 업체 복수 담당자는 `client_contact`에 별도 보존

## 배포
Netlify에서 기존 사이트의 Deploys에서 새 v5.12.6 폴더/저장소를 배포하고, 환경변수는 Netlify UI의 Environment variables 값을 사용하세요.
