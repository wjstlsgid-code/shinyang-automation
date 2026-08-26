create extension if not exists pgcrypto;

do $$ begin create type user_role as enum ('ADMIN','MANAGER','STAFF','VIEWER'); exception when duplicate_object then null; end $$;
do $$ begin create type project_status as enum ('견적','계약','진행중','보완','완료','취소'); exception when duplicate_object then null; end $$;
do $$ begin create type task_status as enum ('대기','진행중','보완','완료'); exception when duplicate_object then null; end $$;

create table if not exists staff (id uuid primary key references auth.users(id) on delete cascade,name text not null,role user_role not null default 'STAFF',department text,active boolean not null default true,created_at timestamptz not null default now());
create table if not exists client (id uuid primary key default gen_random_uuid(),name text not null,biz_no text,contact_name text,phone text,email text,address text,memo text,created_at timestamptz not null default now(),deleted_at timestamptz);
create unique index if not exists uq_client_biz_no_active on client(biz_no) where biz_no is not null and deleted_at is null;
create table if not exists project (id uuid primary key default gen_random_uuid(),client_id uuid not null references client(id),project_name text not null,permit_type text not null,status project_status not null default '견적',manager_id uuid references staff(id),contract_amount numeric(14,0) not null default 0 check(contract_amount>=0),due_date date,submitted_at date,completed_at timestamptz,created_at timestamptz not null default now(),deleted_at timestamptz);
create table if not exists task (id uuid primary key default gen_random_uuid(),project_id uuid references project(id),title text not null,assignee_id uuid references staff(id),priority text not null default '보통',status task_status not null default '대기',due_date date,correction_note text,completed_at timestamptz,created_at timestamptz not null default now(),deleted_at timestamptz);
create table if not exists billing (id uuid primary key default gen_random_uuid(),project_id uuid not null references project(id),billing_type text not null,amount numeric(14,0) not null check(amount>0),due_date date,tax_invoice_status text not null default '미발행',created_at timestamptz not null default now(),deleted_at timestamptz);
create table if not exists payment (id uuid primary key default gen_random_uuid(),billing_id uuid not null references billing(id),amount numeric(14,0) not null check(amount>0),paid_at date not null,memo text,created_at timestamptz not null default now(),deleted_at timestamptz);

create or replace view v_receivables with (security_invoker=true) as select b.id billing_id,p.id project_id,c.name client_name,p.project_name,b.amount billed_amount,coalesce(sum(pay.amount),0) paid_amount,greatest(0,b.amount-coalesce(sum(pay.amount),0)) receivable from billing b join project p on p.id=b.project_id and p.deleted_at is null and p.status<>'취소' join client c on c.id=p.client_id and c.deleted_at is null left join payment pay on pay.billing_id=b.id and pay.deleted_at is null where b.deleted_at is null group by b.id,p.id,c.name,p.project_name,b.amount;

alter table staff enable row level security; alter table client enable row level security; alter table project enable row level security; alter table task enable row level security; alter table billing enable row level security; alter table payment enable row level security;
create or replace function app_current_role() returns user_role language sql stable security definer set search_path=public as $$ select role from staff where id=auth.uid() and active=true $$;

drop policy if exists staff_read on staff; create policy staff_read on staff for select using (auth.uid() is not null and app_current_role() is not null);
drop policy if exists client_read on client; create policy client_read on client for select using (auth.uid() is not null and deleted_at is null);
drop policy if exists project_read on project; create policy project_read on project for select using (auth.uid() is not null and deleted_at is null);
drop policy if exists task_read on task; create policy task_read on task for select using (auth.uid() is not null and deleted_at is null);
drop policy if exists billing_read on billing; create policy billing_read on billing for select using (auth.uid() is not null and deleted_at is null);
drop policy if exists payment_read on payment; create policy payment_read on payment for select using (auth.uid() is not null and deleted_at is null);

drop policy if exists client_write on client; create policy client_write on client for all using (app_current_role() in ('ADMIN','MANAGER')) with check (app_current_role() in ('ADMIN','MANAGER'));
drop policy if exists project_write on project; create policy project_write on project for all using (app_current_role() in ('ADMIN','MANAGER')) with check (app_current_role() in ('ADMIN','MANAGER'));
drop policy if exists billing_write on billing; create policy billing_write on billing for all using (app_current_role() in ('ADMIN','MANAGER')) with check (app_current_role() in ('ADMIN','MANAGER'));
drop policy if exists payment_write on payment; create policy payment_write on payment for all using (app_current_role() in ('ADMIN','MANAGER')) with check (app_current_role() in ('ADMIN','MANAGER'));
drop policy if exists task_insert_manager on task; create policy task_insert_manager on task for insert with check (app_current_role() in ('ADMIN','MANAGER'));
drop policy if exists task_update on task; create policy task_update on task for update using (app_current_role() in ('ADMIN','MANAGER') or assignee_id=auth.uid()) with check (app_current_role() in ('ADMIN','MANAGER') or assignee_id=auth.uid());
drop policy if exists task_delete_manager on task; create policy task_delete_manager on task for delete using (app_current_role() in ('ADMIN','MANAGER'));

-- ===== v3: 인허가 자동 체크리스트 =====
create table if not exists permit_checklist_template (
  id uuid primary key default gen_random_uuid(),
  permit_type text not null,
  label text not null,
  sort_order integer not null default 0,
  is_required boolean not null default true,
  unique(permit_type,label)
);

create table if not exists project_checklist (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project(id) on delete cascade,
  template_id uuid references permit_checklist_template(id) on delete set null,
  label text not null,
  sort_order integer not null default 0,
  is_required boolean not null default true,
  done boolean not null default false,
  done_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  unique(project_id,label)
);

insert into permit_checklist_template(permit_type,label,sort_order,is_required) values
('폐기물','사업자등록증 및 법인등기사항증명서',10,true),('폐기물','사업장 위치도 및 배치도',20,true),('폐기물','토지·건물 사용권원 서류',30,true),('폐기물','시설·장비 명세 및 사진',40,true),('폐기물','취급 폐기물 종류·코드 검토',50,true),('폐기물','처리·보관·운반 계획 검토',60,true),('폐기물','기술인력 및 자격요건 확인',70,true),('폐기물','관할기관 제출서류 최종 점검',80,true),
('대기','사업자 기본서류',10,true),('대기','공정도 및 배출시설 명세',20,true),('대기','원료·연료 사용량 자료',30,true),('대기','오염물질 발생량 산정근거',40,true),('대기','방지시설 용량 및 설계자료',50,true),('대기','굴뚝 및 측정공 위치 검토',60,true),('대기','배치도·평면도',70,true),('대기','신고·허가서 최종 점검',80,true),
('폐수','사업자 기본서류',10,true),('폐수','공정도 및 용수수지',20,true),('폐수','폐수 발생량 산정자료',30,true),('폐수','수질오염물질 농도 산정근거',40,true),('폐수','방지시설 처리용량 및 공정',50,true),('폐수','방류·위탁처리 계획',60,true),('폐수','배치도 및 배관계통도',70,true),('폐수','신고·허가서 최종 점검',80,true),
('화관법','취급 화학물질 목록',10,true),('화관법','최신 MSDS 확보',20,true),('화관법','최대보유량 및 취급량 산정',30,true),('화관법','유해화학물질 해당 여부 검토',40,true),('화관법','취급시설 도면 및 배치도',50,true),('화관법','검사·안전진단 대상 검토',60,true),('화관법','기술인력·관리자 요건 확인',70,true),('화관법','관할기관 제출자료 최종 점검',80,true),
('화평법','물질명·CAS No. 확인',10,true),('화평법','연간 제조·수입량 확인',20,true),('화평법','기존화학물질 여부 확인',30,true),('화평법','등록·신고 대상 여부 검토',40,true),('화평법','등록면제 가능성 검토',50,true),('화평법','용도 및 공급망 정보 확보',60,true),('화평법','시험자료·유해성정보 확인',70,true),('화평법','신청자료 최종 점검',80,true),
('통합환경','사업장 기본현황',10,true),('통합환경','공정 및 시설 목록',20,true),('통합환경','배출영향분석 기초자료',30,true),('통합환경','오염물질 배출현황',40,true),('통합환경','방지시설 운영자료',50,true),('통합환경','최적가용기법 적용 검토',60,true),('통합환경','모니터링 계획',70,true),('통합환경','허가신청서 최종 점검',80,true),
('기타','사업자 기본서류',10,true),('기타','관할기관 및 근거법령 확인',20,true),('기타','대상시설·사업 범위 확정',30,true),('기타','도면·공정자료 확보',40,true),('기타','산정근거 작성',50,true),('기타','필요 첨부서류 확인',60,true),('기타','관할기관 사전협의 사항 정리',70,true),('기타','최종 제출자료 점검',80,true)
on conflict (permit_type,label) do nothing;

create or replace function create_project_checklist() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into project_checklist(project_id,template_id,label,sort_order,is_required)
  select new.id,t.id,t.label,t.sort_order,t.is_required
  from permit_checklist_template t
  where t.permit_type=new.permit_type
  on conflict(project_id,label) do nothing;
  return new;
end $$;

drop trigger if exists trg_project_checklist on project;
create trigger trg_project_checklist after insert on project for each row execute function create_project_checklist();

-- 기존 프로젝트에도 체크리스트 보강
insert into project_checklist(project_id,template_id,label,sort_order,is_required)
select p.id,t.id,t.label,t.sort_order,t.is_required
from project p join permit_checklist_template t on t.permit_type=p.permit_type
where p.deleted_at is null
on conflict(project_id,label) do nothing;

alter table permit_checklist_template enable row level security;
alter table project_checklist enable row level security;
drop policy if exists permit_template_read on permit_checklist_template;
create policy permit_template_read on permit_checklist_template for select using (auth.uid() is not null);
drop policy if exists checklist_read on project_checklist;
create policy checklist_read on project_checklist for select using (auth.uid() is not null);
drop policy if exists checklist_update on project_checklist;
create policy checklist_update on project_checklist for update using (app_current_role() in ('ADMIN','MANAGER','STAFF')) with check (app_current_role() in ('ADMIN','MANAGER','STAFF'));
drop policy if exists checklist_insert_manager on project_checklist;
create policy checklist_insert_manager on project_checklist for insert with check (app_current_role() in ('ADMIN','MANAGER'));
drop policy if exists checklist_delete_manager on project_checklist;
create policy checklist_delete_manager on project_checklist for delete using (app_current_role() in ('ADMIN','MANAGER'));

-- ===== v4: 직원관리 / 파일 / 견적서 =====
alter table staff add column if not exists email text;
alter table staff add column if not exists phone text;

drop policy if exists staff_admin_update on staff;
create policy staff_admin_update on staff for update using (app_current_role()='ADMIN') with check (app_current_role()='ADMIN');

create table if not exists project_file (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references project(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  content_type text,
  size_bytes bigint,
  uploaded_by uuid references staff(id),
  created_at timestamptz not null default now()
);
alter table project_file enable row level security;
drop policy if exists project_file_read on project_file;
create policy project_file_read on project_file for select using (auth.uid() is not null);
drop policy if exists project_file_insert on project_file;
create policy project_file_insert on project_file for insert with check (app_current_role() in ('ADMIN','MANAGER','STAFF') and uploaded_by=auth.uid());
drop policy if exists project_file_delete on project_file;
create policy project_file_delete on project_file for delete using (app_current_role() in ('ADMIN','MANAGER'));

create table if not exists quote (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references client(id),
  project_id uuid references project(id),
  quote_no text not null unique,
  title text not null,
  supply_amount numeric(14,0) not null default 0 check(supply_amount>=0),
  vat_amount numeric(14,0) not null default 0 check(vat_amount>=0),
  total_amount numeric(14,0) not null default 0 check(total_amount>=0),
  validity_days integer not null default 30 check(validity_days>0),
  note text,
  status text not null default '작성',
  created_by uuid references staff(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table quote enable row level security;
drop policy if exists quote_read on quote;
create policy quote_read on quote for select using (auth.uid() is not null and deleted_at is null);
drop policy if exists quote_write on quote;
create policy quote_write on quote for all using (app_current_role() in ('ADMIN','MANAGER')) with check (app_current_role() in ('ADMIN','MANAGER'));

-- 비공개 프로젝트 파일 버킷. Supabase SQL Editor에서 실행하면 생성됩니다.
insert into storage.buckets(id,name,public,file_size_limit)
values ('project-files','project-files',false,20971520)
on conflict (id) do update set public=false, file_size_limit=20971520;

drop policy if exists "project_files_storage_read" on storage.objects;
create policy "project_files_storage_read" on storage.objects for select to authenticated
using (bucket_id='project-files');
drop policy if exists "project_files_storage_insert" on storage.objects;
create policy "project_files_storage_insert" on storage.objects for insert to authenticated
with check (bucket_id='project-files' and app_current_role() in ('ADMIN','MANAGER','STAFF'));
drop policy if exists "project_files_storage_delete" on storage.objects;
create policy "project_files_storage_delete" on storage.objects for delete to authenticated
using (bucket_id='project-files' and app_current_role() in ('ADMIN','MANAGER'));

-- ===== 운영 권한 GRANT =====
-- SQL Editor에서 만든 객체도 authenticated가 접근할 수 있도록 객체 권한을 명시합니다.
-- 실제 행 단위 허용/차단은 위 RLS 정책이 최종 결정합니다.
grant usage on schema public to authenticated;
grant select on table staff to authenticated;
grant update (name, department, active, email, phone, role) on table staff to authenticated;
grant select, insert, update, delete on table client, project, task, billing, payment to authenticated;
grant select on table permit_checklist_template to authenticated;
grant select, insert, update, delete on table project_checklist to authenticated;
grant select, insert, delete on table project_file to authenticated;
grant select, insert, update, delete on table quote to authenticated;
