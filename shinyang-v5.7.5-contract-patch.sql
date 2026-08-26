begin;
create table if not exists public.service_contract (
 id uuid primary key default gen_random_uuid(),
 contract_no text not null unique,
 client_id uuid not null references public.client(id),
 project_id uuid references public.project(id),
 quote_id uuid references public.quote(id),
 title text not null default '환경컨설팅 용역계약',
 contract_date date not null default current_date,
 start_date date,
 end_date date,
 service_name text not null,
 service_scope text not null,
 service_location text,
 supply_amount numeric(14,0) not null default 0 check(supply_amount>=0),
 vat_mode text not null default '별도',
 payment_terms text not null default '',
 payment_account text,
 special_terms text,
 customer_representative text,
 customer_contact_name text,
 customer_contact_phone text,
 status text not null default '작성',
 version_no integer not null default 1,
 sent_at timestamptz,
 signed_at timestamptz,
 created_by uuid references public.staff(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 deleted_at timestamptz
);
create index if not exists idx_service_contract_client on public.service_contract(client_id);
create index if not exists idx_service_contract_project on public.service_contract(project_id);
create index if not exists idx_service_contract_quote on public.service_contract(quote_id);
alter table public.service_contract enable row level security;
drop policy if exists service_contract_read on public.service_contract;
create policy service_contract_read on public.service_contract for select using (
 app_current_role() in ('ADMIN','MANAGER') or
 (app_current_role()='STAFF' and exists(select 1 from public.project p where p.id=project_id and p.manager_id=auth.uid()))
);
drop policy if exists service_contract_write on public.service_contract;
create policy service_contract_write on public.service_contract for all using (
 app_current_role() in ('ADMIN','MANAGER') or
 (app_current_role()='STAFF' and exists(select 1 from public.project p where p.id=project_id and p.manager_id=auth.uid()))
) with check (
 app_current_role() in ('ADMIN','MANAGER') or
 (app_current_role()='STAFF' and exists(select 1 from public.project p where p.id=project_id and p.manager_id=auth.uid()))
);
grant select,insert,update,delete on table public.service_contract to authenticated;
commit;
