# v5.7.7 하이웍스 SMTP 자동메일 설정

Resend / Cloudflare / 가비아 DNS 인증은 사용하지 않습니다.

## Netlify Environment variables

아래 값만 실제 배포 프로젝트에 등록합니다.

- `HIWORKS_SMTP_HOST` = `smtps.hiworks.com`
- `HIWORKS_SMTP_PORT` = `465`
- `HIWORKS_SMTP_USER` = 자동발송에 사용할 **실제 하이웍스 전체 이메일 주소**
- `HIWORKS_SMTP_PASSWORD` = 위 하이웍스 계정 비밀번호
- `HIWORKS_MAIL_FROM_NAME` = `신양파트너스(주)` (선택)

`HIWORKS_SMTP_PASSWORD`는 ZIP/.env.local/채팅에 넣지 말고 Netlify 환경변수에만 저장합니다.

## 하이웍스 측 설정

자동발송에 사용할 계정에서 POP3/SMTP 사용이 허용되어 있어야 합니다.
하이웍스 공식 SMTP 서버는 `smtps.hiworks.com`, 포트 465, SSL 방식입니다.

## 발신자 표시 방식

SMTP 인증은 한 개의 회사 하이웍스 계정으로 통일합니다.
메일 본문 서명은 로그인 직원 이름/직책/이메일/휴대전화로 자동 변경되고,
답장은 해당 직원 이메일(`Reply-To`)로 가도록 구성했습니다.

## v5.7.7 적용 범위

- 문서 자동작성 센터 실제 발송
- 프로젝트 파일 첨부 발송
- 계약서 PDF 메일발송
- 견적서 PDF 메일발송 (신규 버튼)
- 발송이력 / 활동로그 유지

Supabase SQL 추가 변경은 없습니다.
