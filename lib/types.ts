export type Role = 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER'
export type StaffPermissionKey = 'clients'|'projects'|'tasks'|'quotes'|'finance'|'documents'|'files'|'all_projects'|'staff_admin'|'approvals'|'audit'|'backup'
export type StaffPermissions = Partial<Record<StaffPermissionKey,boolean>>
export type Staff = { id:string; name:string; role:Role; department:string|null; active:boolean; email?:string|null; phone?:string|null; permissions?:StaffPermissions|null; created_at?:string }
export type Client = { id:string; name:string; biz_no:string|null; contact_name:string|null; phone:string|null; email:string|null; address:string|null; memo:string|null; created_at:string }
export type ClientContact = { id:string; client_id:string; name:string; position:string|null; phone:string|null; email:string|null; is_primary:boolean; memo:string|null; created_at:string }
export type Project = { id:string; client_id:string; project_name:string; permit_type:string; status:string; manager_id:string|null; contract_amount:number; due_date:string|null; submitted_at:string|null; completed_at:string|null; created_at:string; client?:{name:string;email?:string|null;phone?:string|null}|null; manager?:{name:string}|null }
export type Task = { id:string; project_id:string|null; title:string; assignee_id:string|null; priority:string; status:string; due_date:string|null; correction_note:string|null; completed_at:string|null; created_at:string; project?:{project_name:string}|null; assignee?:{name:string}|null }
export type Billing = { id:string; project_id:string; billing_type:string; amount:number; due_date:string|null; tax_invoice_status:string; project?:{project_name:string;client?:{name:string}|null}|null }
export type Payment = { id:string; billing_id:string; amount:number; paid_at:string; memo:string|null }
export type ChecklistItem = { id:string; project_id:string; label:string; sort_order:number; is_required:boolean; done:boolean; done_at:string|null; note:string|null; created_at:string; project?:{project_name:string;permit_type:string;client?:{name:string}|null}|null }
export type ProjectFile = { id:string; project_id:string; file_name:string; storage_path:string; content_type:string|null; size_bytes:number|null; uploaded_by:string|null; created_at:string; version_no?:number; logical_name?:string|null; is_latest?:boolean; uploader?:{name:string}|null }
export type QuoteItem = { id?:string; quote_id?:string; sort_order:number; item_name:string; description:string|null; quantity:number; unit:string; unit_price:number; supply_amount:number; vat_amount:number; remark:string|null }
export type Quote = { id:string; client_id:string; project_id:string|null; quote_no:string; quote_date?:string; version_no?:number; title:string; supply_amount:number; vat_amount:number; total_amount:number; discount_amount?:number; validity_days:number; vat_mode?:string; payment_terms?:string; customer_note?:string|null; internal_note?:string|null; note:string|null; status:string; sent_at?:string|null; accepted_at?:string|null; converted_project_id?:string|null; created_at:string; created_by?:string|null; client?:{name:string;biz_no:string|null;contact_name:string|null;email:string|null;address:string|null;phone?:string|null}|null; project?:{project_name:string}|null; creator?:{name:string;phone?:string|null;email?:string|null;department?:string|null}|null; items?:QuoteItem[] }
export type AlertItem = { type:'마감'|'보완'|'미수금'|'세금계산서'; title:string; detail:string; due_date:string|null; severity:'danger'|'warn'|'info'; href:string }
export type AlertPreferences = { due_days:number; task_due:boolean; overdue:boolean; correction:boolean; receivable:boolean; tax_invoice:boolean; browser_notify:boolean }

export const roleDefaultPermissions=(role:Role):StaffPermissions=>{
 if(role==='ADMIN') return {clients:true,projects:true,tasks:true,quotes:true,finance:true,documents:true,files:true,all_projects:true,staff_admin:true,approvals:true,audit:true,backup:true}
 if(role==='MANAGER') return {clients:true,projects:true,tasks:true,quotes:true,finance:true,documents:true,files:true,all_projects:true,staff_admin:false,approvals:true,audit:false,backup:false}
 if(role==='STAFF') return {clients:true,projects:true,tasks:true,quotes:true,finance:false,documents:true,files:true,all_projects:false,staff_admin:false,approvals:true,audit:false,backup:false}
 return {clients:true,projects:true,tasks:false,quotes:false,finance:false,documents:false,files:false,all_projects:false,staff_admin:false,approvals:false,audit:false,backup:false}
}
export const hasPermission=(staff:Staff,key:StaffPermissionKey)=> staff.role==='ADMIN' || (staff.permissions?.[key] ?? roleDefaultPermissions(staff.role)[key] ?? false)

export type ServiceContract = { id:string;contract_no:string;client_id:string;project_id:string|null;quote_id:string|null;title:string;contract_date:string;start_date:string|null;end_date:string|null;service_name:string;service_scope:string;service_location:string|null;supply_amount:number;vat_mode:string;payment_terms:string;payment_account:string|null;special_terms:string|null;status:string;version_no:number;sent_at:string|null;signed_at?:string|null;created_at:string }
