# v5.7 최종 재검수 보고서

## 1. 반응형
- PC/태블릿/모바일 레이아웃용 CSS 존재 확인
- 760px / 520px / 430px / 380px 구간 확인
- 모바일 modal safe-area, 하단 sticky action, 견적 품목 재배치 확인
- 견적 A4 출력 영역은 화면에서 스크롤/축소되고 PDF는 A4 기준으로 생성

## 2. 견적 PDF
- `PDF 다운로드`와 `인쇄` 버튼 분리
- html2canvas + jsPDF 기반 자동 파일 다운로드
- A4 비율 페이지 분할
- 한글은 브라우저 렌더링 결과를 캡처하므로 PDF 폰트 깨짐 위험 감소

## 3. 자동 백업
- Netlify Scheduled Function `daily-backup` 포함
- 03:10 KST 일일 실행 (cron은 UTC 기준)
- staff/거래처/담당자/인허가템플릿/프로젝트/체크리스트/업무/견적/청구/입금/파일메타/결재/알림설정/메일로그/활동로그 백업
- 자동 백업 45일 보관
- app_secret, Auth 계정, service role, 실제 Storage 파일 바이너리는 백업 제외
- 수동 백업/JSON 다운로드/복원 유지

## 4. 자동 푸시
- VAPID 키 수동 입력 제거
- 첫 `앱 종료 후 푸시` 등록 시 서버가 VAPID 키 자동 생성
- `app_secret`은 RLS + authenticated 권한 revoke로 클라이언트 직접 접근 차단
- 09:00 KST `daily-push`가 직원별 권한/알림설정 반영
- 마감예정/기한경과/보완/미수금/세금계산서 미발행 요약 푸시
- 만료된 구독(404/410)은 자동 삭제

## 5. 보안
- SERVICE_ROLE은 서버 코드에서만 참조
- ZIP 내 SERVICE_ROLE/RESEND/ANTHROPIC/VAPID private 값 없음
- VAPID private key는 app_secret에만 저장
- app_secret은 일반 authenticated/anon 접근 권한 제거

## 6. 정적 검사
- TS/TSX/MTS 36개 파일 TypeScript transpile syntax 검사: 오류 0
- 내부 @/ 및 상대 import 경로 검사: 누락 0
- 비밀키 값 패턴 검사: 노출 0
- Node 20 / Netlify Next.js plugin / functions directory 설정 확인

## 7. 배포 후 실환경 확인 항목
Netlify 빌드는 외부 npm 의존성 설치가 필요한 관계로 현재 작업 컨테이너에서는 전체 `next build`를 끝까지 실행하지 못했습니다. 실제 Netlify production build가 최종 타입/번들 검증 단계입니다.
배포 후 아래 4개만 실사용 확인하면 됩니다.
1. 견적 1건 PDF 다운로드
2. 알림센터 > 앱 종료 후 푸시 > 테스트 푸시
3. 백업관리 > 수동 백업 1건 생성
4. Netlify Functions에서 daily-backup / daily-push가 Scheduled로 표시되는지 확인
