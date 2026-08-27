begin;

-- v5.12.4 전체 리체크 보완
-- 1) 업무 상태 UI와 DB enum 동기화
alter type public.task_status add value if not exists '보완중';
alter type public.task_status add value if not exists '보류';

-- 2) 파일 관리 권한을 RLS에 안정적으로 적용
create or replace function public.app_is_file_manager()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.staff s
    where s.id=auth.uid()
      and s.active=true
      and s.deleted_at is null
      and s.role in ('ADMIN','MANAGER')
  );
$$;

grant execute on function public.app_is_file_manager() to authenticated;

alter table public.project_file enable row level security;

drop policy if exists project_file_read on public.project_file;
create policy project_file_read
on public.project_file
for select
to authenticated
using (
  public.app_has_permission('files')
  and (deleted_at is null or public.app_is_file_manager())
  and (
    (project_id is not null and public.app_can_see_project(project_id))
    or
    (task_id is not null and public.app_can_see_task_file(task_id))
  )
);

drop policy if exists project_file_insert on public.project_file;
create policy project_file_insert
on public.project_file
for insert
to authenticated
with check (
  uploaded_by=auth.uid()
  and public.app_has_permission('files')
  and (
    (project_id is not null and public.app_can_see_project(project_id))
    or
    (task_id is not null and public.app_can_see_task_file(task_id))
  )
);

drop policy if exists project_file_update on public.project_file;
create policy project_file_update
on public.project_file
for update
to authenticated
using (
  public.app_has_permission('files')
  and public.app_is_file_manager()
)
with check (
  public.app_has_permission('files')
  and public.app_is_file_manager()
);

drop policy if exists project_file_delete on public.project_file;
create policy project_file_delete
on public.project_file
for delete
to authenticated
using (
  public.app_has_permission('files')
  and public.app_is_file_manager()
);

-- Storage 권한도 같은 기준 사용
create or replace function public.app_can_read_file_storage(p_path text)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.project_file pf
    where pf.storage_path=p_path
      and public.app_has_permission('files')
      and (pf.deleted_at is null or public.app_is_file_manager())
      and (
        (pf.project_id is not null and public.app_can_see_project(pf.project_id))
        or
        (pf.task_id is not null and public.app_can_see_task_file(pf.task_id))
      )
  );
$$;

drop policy if exists "project_files_storage_read" on storage.objects;
create policy "project_files_storage_read"
on storage.objects for select to authenticated
using (
  bucket_id='project-files'
  and public.app_can_read_file_storage(name)
);

drop policy if exists "project_files_storage_insert" on storage.objects;
create policy "project_files_storage_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id='project-files'
  and public.app_has_permission('files')
  and public.app_current_role() in ('ADMIN','MANAGER','STAFF')
);

drop policy if exists "project_files_storage_update" on storage.objects;
create policy "project_files_storage_update"
on storage.objects for update to authenticated
using (
  bucket_id='project-files'
  and public.app_is_file_manager()
)
with check (
  bucket_id='project-files'
  and public.app_is_file_manager()
);

drop policy if exists "project_files_storage_delete" on storage.objects;
create policy "project_files_storage_delete"
on storage.objects for delete to authenticated
using (
  bucket_id='project-files'
  and public.app_is_file_manager()
);

-- 3) 전자결재 메뉴 OFF면 DB 접근도 차단
-- 기존 insert 정책도 권한키를 포함하도록 재정의
drop policy if exists approval_read on public.approval_request;
create policy approval_read
on public.approval_request
for select
to authenticated
using (
  public.app_has_permission('approvals')
  and deleted_at is null
  and (
    requester_id=auth.uid()
    or approver_id=auth.uid()
    or public.app_current_role() in ('ADMIN','MANAGER')
  )
);

drop policy if exists approval_insert on public.approval_request;
create policy approval_insert
on public.approval_request
for insert
to authenticated
with check (
  public.app_has_permission('approvals')
  and requester_id=auth.uid()
);

drop policy if exists approval_update on public.approval_request;
create policy approval_update
on public.approval_request
for update
to authenticated
using (
  public.app_has_permission('approvals')
  and (
    requester_id=auth.uid()
    or public.app_current_role() in ('ADMIN','MANAGER')
  )
)
with check (
  public.app_has_permission('approvals')
  and (
    requester_id=auth.uid()
    or public.app_current_role() in ('ADMIN','MANAGER')
  )
);

commit;
