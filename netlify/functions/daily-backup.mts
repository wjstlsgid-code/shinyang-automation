import {createClient} from '@supabase/supabase-js'

const tables=['staff','client','client_contact','permit_checklist_template','project','project_checklist','task','quote','quote_item','service_contract','billing','payment','project_file','approval_request','alert_preference','email_send_log','activity_log'] as const

export default async ()=>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!service){console.error('daily-backup: missing Supabase server env');return}
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
  const snapshot:Record<string,unknown[]>={};let count=0
  for(const table of tables){const {data,error}=await db.from(table).select('*');if(error)throw new Error(`${table}: ${error.message}`);snapshot[table]=data||[];count+=(data||[]).length}
  const kst=new Date(Date.now()+9*60*60*1000);const day=kst.toISOString().slice(0,10)
  const {error}=await db.from('app_backup').insert({label:`자동 일일백업 ${day}`,row_count:count,data:snapshot,created_by:null});if(error)throw error
  const cutoff=new Date(Date.now()-45*86400000).toISOString();await db.from('app_backup').delete().like('label','자동 일일백업 %').lt('created_at',cutoff)
  console.log(`daily-backup: ${count} rows saved`)
}

export const config={schedule:'10 18 * * *'}
