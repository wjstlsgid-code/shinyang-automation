# 신양파트너스 업무자동화 v4

환경컨설팅 회사 내부용 Next.js + Supabase 업무자동화 앱입니다.

## v4 추가 기능
- 직원관리: 관리자 직원 초대, 역할/부서/사용여부 관리
- 프로젝트 상세: 체크리스트, 연결 업무, 진행률 한 화면 관리
- 첨부파일: Supabase Storage 비공개 버킷 업로드/다운로드/삭제
- 견적서: 공급가액/VAT/합계 자동 계산, 브라우저 PDF 저장/인쇄
- 실제 이메일: 문서 자동작성 결과를 Resend API로 거래처에 발송
- Claude AI 업무비서: DB 요약을 기반으로 일반 업무 질문까지 처리
- 기존 DB 조회형 업무비서는 API 키 없이 계속 사용 가능

## 1. Supabase 설정
새 프로젝트라면 `supabase/schema.sql` 전체를 SQL Editor에서 실행합니다.
기존 v3 DB라면 파일 하단의 `v4: 직원관리 / 파일 / 견적서` 구간만 추가 실행해도 됩니다.

Authentication에서 최초 관리자 계정을 만든 뒤 Auth UUID를 staff에 등록합니다.

```sql
insert into public.staff(id,name,role,department,email)
values ('AUTH_USER_UUID','관리자','ADMIN','환경컨설팅','admin@example.com');
```

## 2. 환경변수
`.env.example`을 `.env.local`로 복사합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxx
SUPABASE_SERVICE_ROLE_KEY=xxxx

RESEND_API_KEY=re_xxxx
MAIL_FROM=SHINYANG PARTNERS <noreply@your-domain.com>

ANTHROPIC_API_KEY=sk-ant-xxxx
ANTHROPIC_MODEL=claude-opus-5
```

`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `ANTHROPIC_API_KEY`는 서버 전용입니다. `NEXT_PUBLIC_`을 붙이지 마세요.

## 3. 실행
```bash
npm install
npm run dev
```

## 직원 초대
`ADMIN` 계정으로 직원관리 → 직원 초대에서 이메일, 이름, 권한을 등록합니다. 초대 메일은 Supabase Auth가 발송합니다. 직원이 초대를 수락하면 staff 권한으로 바로 앱에 접근할 수 있습니다.

## 프로젝트 파일
`schema.sql`이 `project-files` 비공개 Storage 버킷과 RLS 정책을 생성합니다. STAFF 이상은 업로드 가능하고 ADMIN/MANAGER는 삭제할 수 있습니다. 앱에서는 60초 유효 Signed URL로 다운로드합니다.

## 견적서 PDF
견적서 목록에서 견적을 선택 → `PDF/인쇄` → 브라우저 인쇄 창에서 `PDF로 저장`을 선택합니다. 별도 PDF 라이브러리 없이 한글 폰트 깨짐을 줄이는 방식입니다.

## 이메일 발송
Resend에서 발송 도메인을 인증하고 `RESEND_API_KEY`, `MAIL_FROM`을 설정하면 문서자동작성 화면의 `실제 메일 발송` 버튼이 동작합니다. 발송 직전 확인창이 한 번 표시됩니다.

## Claude AI
`ANTHROPIC_API_KEY`를 설정하면 고정 조회 명령 외의 질문은 `/api/ai`를 통해 Claude Messages API로 전달됩니다. 회사 DB에서 필요한 요약 데이터만 함께 전달하도록 구성했습니다. 키가 없으면 기존 DB 조회형 기능만 사용합니다.

## 권한 요약
- ADMIN: 전체 관리 + 직원 초대/권한 변경
- MANAGER: 거래처/프로젝트/업무/수금/견적/파일 관리
- STAFF: 조회 + 배정 업무/체크리스트 + 프로젝트 파일 업로드 + 이메일 발송
- VIEWER: 조회 중심

## 다음 권장 확장
- 관할기관/법정처리기한 DB
- 변경이력/감사로그
- 캘린더 연동
- 카카오 알림톡/문자
- 견적 품목 다중 행 및 회사 직인 이미지
- 인허가별 법령·제출서류 지식베이스 검색

## iPhone 파일 앱 사용자
아이폰 기본 파일 앱에서 `.env.local` 파일을 만들기 어려운 경우 프로젝트 루트에 `env.local`로 저장해도 됩니다. 이 v4.1은 `next.config.mjs`에서 `env.local`을 읽어 동일하게 환경변수로 적용합니다.


## v4.2 Responsive
- iPhone/Android: 상단 헤더 + 슬라이드 메뉴 + 하단 주요 메뉴
- Tablet: 2열 카드/축소 사이드바
- Desktop: 좌측 고정 메뉴 + 4열 대시보드
- 표는 작은 화면에서 안전하게 가로 스크롤, 모달은 모바일 바텀시트 형태
- iOS safe-area 대응
