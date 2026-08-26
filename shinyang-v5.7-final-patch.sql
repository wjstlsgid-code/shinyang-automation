-- 신양파트너스 업무자동화 v5.7 FINAL patch
-- v5.6 SQL 실행 후 1회 실행
begin;

-- 웹푸시 VAPID 키를 서비스 역할만 접근 가능한 DB 비밀 저장소에 보관한다.
-- 클라이언트/일반 authenticated 사용자는 이 테이블을 직접 읽거나 쓸 수 없다.
create table if not exists public.app_secret (
  secret_key text primary key,
  secret_value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.app_secret enable row level security;
revoke all on table public.app_secret from anon, authenticated;

-- updated_at 자동 갱신
create or replace function public.app_secret_touch_updated_at()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  new.updated_at=now();
  return new;
end $$;
drop trigger if exists trg_app_secret_touch on public.app_secret;
create trigger trg_app_secret_touch before update on public.app_secret
for each row execute function public.app_secret_touch_updated_at();

commit;
