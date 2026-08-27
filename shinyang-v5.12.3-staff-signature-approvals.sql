begin;

alter table public.staff add column if not exists signature_title text;
alter table public.staff add column if not exists signature_email text;
alter table public.staff add column if not exists signature_enabled boolean not null default true;
alter table public.staff add column if not exists deleted_at timestamptz;
update public.staff set signature_title=coalesce(signature_title,department),signature_email=coalesce(signature_email,email) where signature_title is null or signature_email is null;

drop policy if exists staff_admin_insert on public.staff;
create policy staff_admin_insert on public.staff for insert to authenticated with check (public.app_current_role()='ADMIN');
grant select,insert,update on public.staff to authenticated;

alter table public.approval_request add column if not exists updated_at timestamptz not null default now();
alter table public.approval_request add column if not exists deleted_at timestamptz;

drop policy if exists approval_read on public.approval_request;
create policy approval_read on public.approval_request for select to authenticated using (
 deleted_at is null and (requester_id=auth.uid() or approver_id=auth.uid() or public.app_current_role() in ('ADMIN','MANAGER'))
);

drop policy if exists approval_update on public.approval_request;
create policy approval_update on public.approval_request for update to authenticated using (
 requester_id=auth.uid() or public.app_current_role() in ('ADMIN','MANAGER')
) with check (
 requester_id=auth.uid() or public.app_current_role() in ('ADMIN','MANAGER')
);

create or replace function public.approval_request_guard()
returns trigger language plpgsql security definer set search_path=public as $$
declare r text;
begin
 new.updated_at=now();
 r:=public.app_current_role();
 if coalesce(r,'') not in ('ADMIN','MANAGER') then
   if old.requester_id is distinct from auth.uid() then raise exception '권한이 없습니다.'; end if;
   if old.status<>'대기' then raise exception '대기 중인 결재만 수정할 수 있습니다.'; end if;
   if new.requester_id is distinct from old.requester_id or new.approver_id is distinct from old.approver_id or new.decision_note is distinct from old.decision_note or new.decided_at is distinct from old.decided_at then raise exception '결재자/결재결과는 직접 변경할 수 없습니다.'; end if;
   if new.status not in ('대기','취소') then raise exception '승인/반려는 결재권자만 처리할 수 있습니다.'; end if;
 end if;
 return new;
end $$;

drop trigger if exists trg_approval_request_guard on public.approval_request;
create trigger trg_approval_request_guard before update on public.approval_request for each row execute function public.approval_request_guard();

grant select,insert,update on public.approval_request to authenticated;

commit;
