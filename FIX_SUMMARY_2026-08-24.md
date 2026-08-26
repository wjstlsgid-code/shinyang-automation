# 2026-08-24 로그인/Auth 안정화 수정

## 수정한 파일
- `lib/supabase.ts`
- `app/components/AuthProvider.tsx`
- `app/components/AppShell.tsx`
- `app/login/page.tsx`
- `.env.example`
- `supabase/schema.sql`

## 핵심 수정
1. Supabase anon key와 publishable key 환경변수 둘 다 지원.
2. Auth 초기 세션 및 staff 조회에 12초 timeout과 오류 상태 추가.
3. 모든 성공/실패 경로에서 loading이 종료되도록 수정.
4. AppShell 렌더 도중 router.replace 호출 제거하고 useEffect redirect로 변경.
5. 로그인 submit에 try/catch/finally와 session 생성 검증 추가.
6. 업로드한 최신 schema-fixed.sql 기준으로 로컬 schema 동기화.
7. `current_role()` 구버전을 `app_current_role()` 기준으로 교체.
8. `staff_read`의 같은 staff 테이블 재조회 방식 대신 SECURITY DEFINER 함수 기반 정책으로 재귀 가능성 제거.
9. authenticated 객체 GRANT를 schema에 명시하여 RLS 이전의 table permission denied 가능성 방지.

## 아직 실제 환경에서 확인해야 하는 항목
- 실제 `.env.local`의 Supabase URL/key가 운영 프로젝트와 일치하는지
- `npm install` 및 `npm run build` (이 작업 환경에서는 패키지 설치가 제한시간 내 완료되지 않아 미검증)
- Mac 브라우저 PC 로그인
- 새로고침 후 세션 유지
- iPhone 동일 Wi-Fi 로그인

## Mac에서 실행
```bash
cd shinyang-automation-v4.2-responsive
npm install
npm run dev
```

`.env.local`에는 실제 운영 프로젝트의 다음 값이 필요합니다.
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 또는 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

서버 API 기능(직원 초대 등)을 사용하려면 서버 전용 `SUPABASE_SERVICE_ROLE_KEY`도 필요합니다. 이 키에는 절대 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.

## 2026-08-24 환경변수 추가 점검
- 업로드된 env 파일의 Supabase URL 프로젝트 ref에 오타 2곳(j/i)이 확인됨.
- NEXT_PUBLIC_SUPABASE_ANON_KEY가 빈 값이었음.
- 실제 ACTIVE_HEALTHY `shinyang-automation` 프로젝트 URL과 활성 publishable key로 `.env.local` 수정.
- 서버 인증은 publishable/anon key + 사용자 JWT + RLS로 검증하도록 수정.
- service_role은 직원 초대처럼 실제 관리자 서버 권한이 필요한 기능에만 요구하도록 분리.
- service_role / Resend / Anthropic 키는 제공되지 않아 빈 값 유지.

## 추가 수정 — 비밀번호 재설정 흐름
- `/reset-password` 전용 페이지 추가
- 로그인 화면에 `비밀번호를 잊으셨나요?` 추가
- 재설정 메일은 `${origin}/reset-password`로 돌아오도록 설정
- `PASSWORD_RECOVERY` 이벤트 감지 시 `/reset-password`로 이동
- 새 비밀번호/확인 비밀번호 검증 후 `supabase.auth.updateUser({ password })` 실행
- 변경 완료 후 로그아웃하고 로그인 화면으로 복귀
- `/reset-password`를 인증 전 공개 페이지로 AppShell에서 예외 처리

### 검증 상태
- 코드 정적 점검: 완료
- 이 작업 환경에는 `node_modules`가 없어 `next build` 실행 불가 (`next: not found`)
- Mac에서 기존처럼 `npm install` 후 `npm run dev`로 최종 확인 필요

## 2026-08-24 mobile icon + quote modal polish
- Added branded `app/icon.png` and `app/apple-icon.png` for browser/PWA/iOS home-screen icon.
- Raised mobile modal overlay above the fixed bottom navigation so the action buttons are no longer covered.
- Added dynamic viewport + iOS safe-area handling and sticky action-bar spacing for quote creation and other modals.
