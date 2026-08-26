-- 신양파트너스 업무자동화 2026-08 최종 업그레이드
-- Supabase SQL Editor에서 이 파일 전체를 1회 실행하세요.

begin;

alter table public.quote add column if not exists quote_date date not null default current_date;
alter table public.quote add column if not exists version_no integer not null default 1;
alter table public.quote add column if not exists vat_mode text not null default '별도';
alter table public.quote add column if not exists payment_terms text not null default '착수금 60% / 잔금 40%';
alter table public.quote add column if not exists customer_note text;
alter table public.quote add column if not exists internal_note text;
alter table public.quote add column if not exists discount_amount numeric(14,0) not null default 0;
alter table public.quote add column if not exists sent_at timestamptz;
alter table public.quote add column if not exists accepted_at timestamptz;
alter table public.quote add column if not exists converted_project_id uuid references public.project(id);

create table if not exists public.quote_item (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quote(id) on delete cascade,
  sort_order integer not null default 0,
  item_name text not null,
  description text,
  quantity numeric(12,2) not null default 1 check(quantity > 0),
  unit text not null default '식',
  unit_price numeric(14,0) not null default 0 check(unit_price >= 0),
  supply_amount numeric(14,0) not null default 0 check(supply_amount >= 0),
  vat_amount numeric(14,0) not null default 0 check(vat_amount >= 0),
  remark text,
  created_at timestamptz not null default now()
);

create table if not exists public.client_contact (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.client(id) on delete cascade,
  name text not null,
  position text,
  phone text,
  email text,
  is_primary boolean not null default false,
  memo text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists idx_client_contact_client on public.client_contact(client_id) where deleted_at is null;

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.staff(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text,
  created_at timestamptz not null default now()
);

alter table public.quote_item enable row level security;
alter table public.client_contact enable row level security;
alter table public.activity_log enable row level security;

drop policy if exists quote_item_read on public.quote_item;
create policy quote_item_read on public.quote_item for select using (auth.uid() is not null);
drop policy if exists quote_item_write on public.quote_item;
create policy quote_item_write on public.quote_item for all using (app_current_role() in ('ADMIN','MANAGER')) with check (app_current_role() in ('ADMIN','MANAGER'));

drop policy if exists client_contact_read on public.client_contact;
create policy client_contact_read on public.client_contact for select using (auth.uid() is not null and deleted_at is null);
drop policy if exists client_contact_write on public.client_contact;
create policy client_contact_write on public.client_contact for all using (app_current_role() in ('ADMIN','MANAGER')) with check (app_current_role() in ('ADMIN','MANAGER'));

drop policy if exists activity_log_read on public.activity_log;
create policy activity_log_read on public.activity_log for select using (auth.uid() is not null);
drop policy if exists activity_log_insert on public.activity_log;
create policy activity_log_insert on public.activity_log for insert with check (auth.uid() = actor_id);

grant select,insert,update,delete on table public.quote_item, public.client_contact to authenticated;
grant select,insert on table public.activity_log to authenticated;

-- 기존 단일 견적 금액을 품목 1줄로 보강
insert into public.quote_item(quote_id,sort_order,item_name,description,quantity,unit,unit_price,supply_amount,vat_amount)
select q.id,10,q.title,null,1,'식',q.supply_amount,q.supply_amount,q.vat_amount
from public.quote q
where q.deleted_at is null
  and not exists (select 1 from public.quote_item qi where qi.quote_id=q.id);

-- 기존 거래처 대표 담당자를 연락처 테이블로 보강
insert into public.client_contact(client_id,name,phone,email,is_primary)
select c.id,c.contact_name,c.phone,c.email,true
from public.client c
where c.deleted_at is null and c.contact_name is not null and trim(c.contact_name)<>''
  and not exists (select 1 from public.client_contact cc where cc.client_id=c.id and cc.deleted_at is null and cc.name=c.contact_name);

commit;

-- ===== v5.3 문서 자동작성 센터 / 메일 발송이력 =====
create table if not exists public.email_send_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.staff(id),
  project_id uuid references public.project(id),
  client_id uuid references public.client(id),
  to_email text not null,
  subject text not null,
  document_type text not null,
  attachment_count integer not null default 0,
  provider_message_id text,
  status text not null default '발송완료',
  created_at timestamptz not null default now()
);
alter table public.email_send_log enable row level security;
drop policy if exists email_send_log_read on public.email_send_log;
create policy email_send_log_read on public.email_send_log for select using (
  app_current_role() in ('ADMIN','MANAGER') or actor_id=auth.uid()
);
drop policy if exists email_send_log_insert on public.email_send_log;
create policy email_send_log_insert on public.email_send_log for insert with check (actor_id=auth.uid());
grant select,insert on table public.email_send_log to authenticated;

-- ===== v5.4 직원별 세부권한 / 개인 알림설정 =====
alter table public.staff add column if not exists permissions jsonb;

create table if not exists public.alert_preference (
  staff_id uuid primary key references public.staff(id) on delete cascade,
  due_days integer not null default 7 check(due_days in (1,3,7,14)),
  task_due boolean not null default true,
  overdue boolean not null default true,
  correction boolean not null default true,
  receivable boolean not null default true,
  tax_invoice boolean not null default true,
  browser_notify boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.alert_preference enable row level security;
drop policy if exists alert_preference_read on public.alert_preference;
create policy alert_preference_read on public.alert_preference for select using (staff_id=auth.uid() or app_current_role()='ADMIN');
drop policy if exists alert_preference_write on public.alert_preference;
create policy alert_preference_write on public.alert_preference for all using (staff_id=auth.uid() or app_current_role()='ADMIN') with check (staff_id=auth.uid() or app_current_role()='ADMIN');
grant select,insert,update,delete on table public.alert_preference to authenticated;

-- 기존 직원은 역할 기본권한을 저장해 이후 ADMIN 화면에서 개별 수정 가능
update public.staff set permissions = case role::text
  when 'ADMIN' then '{"clients":true,"projects":true,"tasks":true,"quotes":true,"finance":true,"documents":true,"files":true,"all_projects":true,"staff_admin":true}'::jsonb
  when 'MANAGER' then '{"clients":true,"projects":true,"tasks":true,"quotes":true,"finance":true,"documents":true,"files":true,"all_projects":true,"staff_admin":false}'::jsonb
  when 'STAFF' then '{"clients":true,"projects":true,"tasks":true,"quotes":true,"finance":false,"documents":true,"files":true,"all_projects":false,"staff_admin":false}'::jsonb
  else '{"clients":true,"projects":true,"tasks":false,"quotes":false,"finance":false,"documents":false,"files":false,"all_projects":false,"staff_admin":false}'::jsonb
end
where permissions is null;

-- ===== v5.5 전자결재 / 감사로그 강화 / 파일 버전 / 고객포털 / 백업 / 웹푸시 =====
create table if not exists public.approval_request (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.staff(id),
  approver_id uuid references public.staff(id),
  request_type text not null,
  entity_type text,
  entity_id uuid,
  title text not null,
  amount numeric(14,0),
  reason text,
  status text not null default '대기' check(status in ('대기','승인','반려','취소')),
  decision_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
alter table public.approval_request enable row level security;
drop policy if exists approval_read on public.approval_request;
create policy approval_read on public.approval_request for select using (
  requester_id=auth.uid() or approver_id=auth.uid() or app_current_role() in ('ADMIN','MANAGER')
);
drop policy if exists approval_insert on public.approval_request;
create policy approval_insert on public.approval_request for insert with check (requester_id=auth.uid());
drop policy if exists approval_update on public.approval_request;
create policy approval_update on public.approval_request for update using (
  requester_id=auth.uid() or app_current_role() in ('ADMIN','MANAGER')
) with check (
  requester_id=auth.uid() or app_current_role() in ('ADMIN','MANAGER')
);
grant select,insert,update on public.approval_request to authenticated;

alter table public.project_file add column if not exists logical_name text;
alter table public.project_file add column if not exists version_no integer not null default 1;
alter table public.project_file add column if not exists is_latest boolean not null default true;
update public.project_file set logical_name=coalesce(logical_name,file_name) where logical_name is null;
create index if not exists idx_project_file_version on public.project_file(project_id,logical_name,version_no desc);
create or replace function public.project_file_version_before_insert()
returns trigger language plpgsql security definer set search_path=public as $$
declare v integer;
begin
  new.logical_name := coalesce(nullif(new.logical_name,''),new.file_name);
  select coalesce(max(version_no),0)+1 into v from public.project_file
   where project_id=new.project_id and coalesce(logical_name,file_name)=new.logical_name;
  new.version_no := v;
  new.is_latest := true;
  update public.project_file set is_latest=false
   where project_id=new.project_id and coalesce(logical_name,file_name)=new.logical_name and is_latest=true;
  return new;
end $$;
drop trigger if exists trg_project_file_version on public.project_file;
create trigger trg_project_file_version before insert on public.project_file
for each row execute function public.project_file_version_before_insert();

create table if not exists public.portal_share (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.project(id) on delete cascade,
  token text not null unique,
  active boolean not null default true,
  expires_at timestamptz not null,
  created_by uuid references public.staff(id),
  created_at timestamptz not null default now()
);
alter table public.portal_share enable row level security;
drop policy if exists portal_share_internal_read on public.portal_share;
create policy portal_share_internal_read on public.portal_share for select using (app_current_role() in ('ADMIN','MANAGER'));
grant select on public.portal_share to authenticated;

create table if not exists public.app_backup (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  row_count integer not null default 0,
  data jsonb not null,
  created_by uuid references public.staff(id),
  created_at timestamptz not null default now()
);
alter table public.app_backup enable row level security;
drop policy if exists app_backup_admin_read on public.app_backup;
create policy app_backup_admin_read on public.app_backup for select using (app_current_role()='ADMIN');
grant select on public.app_backup to authenticated;

create table if not exists public.push_subscription (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_subscription enable row level security;
drop policy if exists push_subscription_self on public.push_subscription;
create policy push_subscription_self on public.push_subscription for all using (staff_id=auth.uid()) with check (staff_id=auth.uid());
grant select,insert,update,delete on public.push_subscription to authenticated;

-- 감사로그를 주요 테이블에 DB 트리거로 자동 기록
create or replace function public.audit_business_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  row_data jsonb;
  rid uuid;
  act text;
  sm text;
begin
  -- NEW/OLD are different record shapes for each table. Convert the active row
  -- to jsonb first so this one trigger function can safely serve all tables.
  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  rid := nullif(row_data->>'id','')::uuid;
  act := case when tg_op='INSERT' then '생성' when tg_op='UPDATE' then '수정' else '삭제' end;
  sm := case tg_table_name
    when 'project' then coalesce(row_data->>'project_name', tg_table_name)
    when 'client' then coalesce(row_data->>'name', tg_table_name)
    when 'quote' then coalesce(row_data->>'quote_no', tg_table_name)
    when 'billing' then coalesce(row_data->>'billing_type', tg_table_name)
    when 'task' then coalesce(row_data->>'title', tg_table_name)
    when 'staff' then coalesce(row_data->>'name', tg_table_name)
    else tg_table_name end;
  insert into public.activity_log(actor_id,entity_type,entity_id,action,summary)
  values(auth.uid(),tg_table_name,rid,act,sm);
  return case when tg_op = 'DELETE' then old else new end;
end $$;

do $$ declare t text; begin
  foreach t in array array['project','client','quote','billing','task','staff'] loop
    execute format('drop trigger if exists trg_audit_%I on public.%I',t,t);
    execute format('create trigger trg_audit_%I after insert or update or delete on public.%I for each row execute function public.audit_business_change()',t,t);
  end loop;
end $$;

-- v5.5 권한 기본값 보강
update public.staff set permissions = coalesce(permissions,'{}'::jsonb) || case role::text
  when 'ADMIN' then '{"approvals":true,"audit":true,"backup":true}'::jsonb
  when 'MANAGER' then '{"approvals":true,"audit":false,"backup":false}'::jsonb
  when 'STAFF' then '{"approvals":true,"audit":false,"backup":false}'::jsonb
  else '{"approvals":false,"audit":false,"backup":false}'::jsonb end;


-- ===== v5.6 권한/RLS 하드닝 =====
-- 화면에서 숨기는 것만으로 끝내지 않고 DB에서도 직원별 범위를 제한합니다.
create or replace function public.app_has_permission(p_key text)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(
    case when s.role='ADMIN' then true else (s.permissions->>p_key)::boolean end,
    case s.role
      when 'MANAGER' then p_key in ('clients','projects','tasks','quotes','finance','documents','files','all_projects','approvals')
      when 'STAFF' then p_key in ('clients','projects','tasks','quotes','documents','files','approvals')
      when 'VIEWER' then p_key='clients'
      else false end,
    false
  )
  from public.staff s where s.id=auth.uid() and s.active=true
$$;

create or replace function public.app_can_see_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.staff s
    where s.id=auth.uid() and s.active=true and (
      s.role in ('ADMIN','MANAGER') or
      coalesce((s.permissions->>'all_projects')::boolean,false) or
      exists(select 1 from public.project p where p.id=p_project_id and p.deleted_at is null and p.manager_id=auth.uid())
    )
  )
$$;

create or replace function public.app_can_see_client(p_client_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.staff s
    where s.id=auth.uid() and s.active=true and (
      s.role in ('ADMIN','MANAGER') or
      coalesce((s.permissions->>'all_projects')::boolean,false) or
      exists(select 1 from public.project p where p.client_id=p_client_id and p.deleted_at is null and p.manager_id=auth.uid())
    )
  )
$$;

create or replace function public.app_can_see_billing(p_billing_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.billing b where b.id=p_billing_id and b.deleted_at is null and public.app_can_see_project(b.project_id))
$$;

create or replace function public.app_can_see_quote(p_quote_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.quote q where q.id=p_quote_id and q.deleted_at is null and (
      public.app_current_role() in ('ADMIN','MANAGER') or
      coalesce((select (permissions->>'all_projects')::boolean from public.staff where id=auth.uid()),false) or
      q.created_by=auth.uid() or
      (q.project_id is not null and public.app_can_see_project(q.project_id)) or
      public.app_can_see_client(q.client_id)
    )
  )
$$;

-- 직원 개인정보는 본인/관리자만 직접 읽습니다.
drop policy if exists staff_read on public.staff;
create policy staff_read on public.staff for select using (
  id=auth.uid() or public.app_current_role() in ('ADMIN','MANAGER')
);

-- 직원은 본인 담당 프로젝트/거래처 범위만, 전체보기 권한이 있으면 전체 조회합니다.
drop policy if exists client_read on public.client;
create policy client_read on public.client for select using (
  deleted_at is null and public.app_has_permission('clients') and public.app_can_see_client(id)
);
drop policy if exists project_read on public.project;
create policy project_read on public.project for select using (
  deleted_at is null and public.app_has_permission('projects') and public.app_can_see_project(id)
);
drop policy if exists task_read on public.task;
create policy task_read on public.task for select using (
  deleted_at is null and public.app_has_permission('tasks') and (
    public.app_current_role() in ('ADMIN','MANAGER') or
    coalesce((select (permissions->>'all_projects')::boolean from public.staff where id=auth.uid()),false) or
    assignee_id=auth.uid() or (project_id is not null and public.app_can_see_project(project_id))
  )
);
drop policy if exists billing_read on public.billing;
create policy billing_read on public.billing for select using (
  deleted_at is null and public.app_has_permission('finance') and public.app_can_see_project(project_id)
);
drop policy if exists payment_read on public.payment;
create policy payment_read on public.payment for select using (
  deleted_at is null and public.app_has_permission('finance') and public.app_can_see_billing(billing_id)
);
drop policy if exists checklist_read on public.project_checklist;
create policy checklist_read on public.project_checklist for select using (
  public.app_has_permission('tasks') and public.app_can_see_project(project_id)
);
drop policy if exists project_file_read on public.project_file;
create policy project_file_read on public.project_file for select using (
  public.app_has_permission('files') and public.app_can_see_project(project_id)
);
drop policy if exists quote_read on public.quote;
create policy quote_read on public.quote for select using (
  deleted_at is null and public.app_has_permission('quotes') and public.app_can_see_quote(id)
);
drop policy if exists quote_item_read on public.quote_item;
create policy quote_item_read on public.quote_item for select using (
  public.app_has_permission('quotes') and public.app_can_see_quote(quote_id)
);
drop policy if exists client_contact_read on public.client_contact;
create policy client_contact_read on public.client_contact for select using (
  deleted_at is null and public.app_has_permission('clients') and public.app_can_see_client(client_id)
);
drop policy if exists activity_log_read on public.activity_log;
create policy activity_log_read on public.activity_log for select using (
  public.app_has_permission('audit') or actor_id=auth.uid()
);

-- 파일 Storage도 project_file 메타데이터와 같은 담당 범위만 다운로드 허용합니다.
create or replace function public.app_can_read_project_storage(p_path text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.project_file pf
    where pf.storage_path=p_path and public.app_has_permission('files') and public.app_can_see_project(pf.project_id)
  )
$$;
drop policy if exists "project_files_storage_read" on storage.objects;
create policy "project_files_storage_read" on storage.objects for select to authenticated
using (bucket_id='project-files' and public.app_can_read_project_storage(name));
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
