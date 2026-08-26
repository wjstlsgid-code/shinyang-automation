# 신양파트너스 업무자동화 v5.7 FINAL

v5.6 재검수본에 남아 있던 3개 항목까지 마무리한 최종 통합본입니다.

## v5.7에서 마무리한 기능

1. **견적서 진짜 PDF 자동생성**
   - 견적 상세의 `PDF 다운로드` 버튼으로 A4 PDF 파일을 바로 생성/저장합니다.
   - 한글 글꼴을 별도 PDF 폰트로 내장하지 않고, 브라우저에 렌더링된 실제 견적서를 고해상도 이미지로 캡처해 PDF화하여 한글 깨짐을 피합니다.
   - 여러 페이지로 길어질 경우 자동 페이지 분할합니다.
   - 기존 `인쇄` 버튼도 유지합니다.

2. **자동 일일 백업**
   - Netlify Scheduled Function `daily-backup`이 매일 03:10 KST에 실행됩니다.
   - 핵심 업무 테이블을 `app_backup`에 스냅샷으로 저장합니다.
   - 자동백업은 45일 이후 자동 정리됩니다.
   - 기존 수동 백업 / JSON 다운로드 / 복원 기능도 유지합니다.

3. **앱 종료 후 자동 푸시 발송**
   - 사용자가 알림센터에서 `앱 종료 후 푸시`를 한 번 등록하면 됩니다.
   - VAPID 키는 첫 등록 시 서버가 자동 생성하고 `app_secret`에 저장합니다.
   - 별도의 VAPID 환경변수 입력이 필요 없습니다.
   - `daily-push`가 매일 09:00 KST에 직원별 알림설정/권한을 반영해 마감·기한경과·보완·미수금·세금계산서 알림을 보냅니다.
   - 만료된 푸시 구독은 자동 정리합니다.

## 배포 시 필요한 환경변수

기존과 동일합니다.

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 또는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (서버 전용, NEXT_PUBLIC 금지)
- 실제 메일 발송 사용 시 `RESEND_API_KEY`, `MAIL_FROM`
- AI 비서 사용 시 `ANTHROPIC_API_KEY`

VAPID 키는 v5.7부터 직접 입력할 필요가 없습니다.

## 적용 순서

- v5.6 SQL까지 이미 실행: `shinyang-v5.7-final-patch.sql`만 1회 실행
- 처음부터 신규 적용: `shinyang-v5.7-full-upgrade.sql` 1회 실행
- 이후 ZIP을 Netlify에 배포

## 예약 실행 시간

Netlify Scheduled Functions의 cron은 UTC 기준이므로:
- `daily-backup`: `10 18 * * *` → KST 03:10
- `daily-push`: `0 0 * * *` → KST 09:00


## v5.7.2 Netlify build fix
- backup page Supabase relation type corrected (`created_by` relation returns array shape in generated result)
- Netlify Node.js bumped from 20 to 22 for current Supabase JS engine requirement
