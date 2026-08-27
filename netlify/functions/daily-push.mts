import {createClient} from '@supabase/supabase-js'
import webpush from 'web-push'

type Staff={id:string;name:string;role:string;permissions:any}
type Pref={staff_id:string;due_days:number;task_due:boolean;overdue:boolean;correction:boolean;receivable:boolean;tax_invoice:boolean}

export default async ()=>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL
  const service=process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url||!service){console.error('daily-push: missing Supabase server env');return}
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
  const {data:key}=await db.from('app_secret').select('secret_value').eq('secret_key','webpush_vapid').maybeSingle()
  const vapid:any=key?.secret_value
  if(!vapid?.publicKey||!vapid?.privateKey){console.log('daily-push: no VAPID key yet');return}
  webpush.setVapidDetails('mailto:admin@sypartners.kr',vapid.publicKey,vapid.privateKey)
  const [{data:staffRows},{data:prefRows},{data:subs}]=await Promise.all([
    db.from('staff').select('id,name,role,permissions').eq('active',true),
    db.from('alert_preference').select('staff_id,due_days,task_due,overdue,correction,receivable,tax_invoice'),
    db.from('push_subscription').select('staff_id,endpoint,p256dh,auth_key')
  ])
  const prefs=new Map<string,Pref>((prefRows||[]).map((x:any)=>[x.staff_id,x as Pref] as [string,Pref]))
  const subMap=new Map<string,any[]>();for(const s of subs||[]){const a=subMap.get(s.staff_id)||[];a.push(s);subMap.set(s.staff_id,a)}
  const today=new Date();const yyyy=today.toISOString().slice(0,10)
  let totalSent=0
  for(const staff of (staffRows||[]) as Staff[]){
    const devices=subMap.get(staff.id)||[];if(!devices.length)continue
    const p=prefs.get(staff.id)||{staff_id:staff.id,due_days:7,task_due:true,overdue:true,correction:true,receivable:true,tax_invoice:true}
    const lim=new Date();lim.setUTCDate(lim.getUTCDate()+Number(p.due_days||7));const end=lim.toISOString().slice(0,10)
    const all=staff.role==='ADMIN'||staff.role==='MANAGER'||Boolean(staff.permissions?.all_projects)
    const finance=staff.role==='ADMIN'||staff.role==='MANAGER'||Boolean(staff.permissions?.finance)
    let taskQ=db.from('task').select('id,due_date,status,assignee_id').is('deleted_at',null).neq('status','완료').not('due_date','is',null).lte('due_date',end)
    if(!all)taskQ=taskQ.eq('assignee_id',staff.id)
    let projQ=db.from('project').select('id,manager_id,status').is('deleted_at',null).eq('status','보완')
    if(!all)projQ=projQ.eq('manager_id',staff.id)
    const jobs:any[]=[taskQ,projQ]
    if(finance){jobs.push(db.from('v_receivables').select('receivable').gt('receivable',0));jobs.push(db.from('billing').select('id').is('deleted_at',null).eq('tax_invoice_status','미발행'))}
    const res=await Promise.all(jobs);const tasks:any[]=res[0].data||[],corrections:any[]=res[1].data||[],receivables:any[]=res[2]?.data||[],taxes:any[]=res[3]?.data||[]
    const overdue=tasks.filter(x=>x.due_date<yyyy).length;const upcoming=tasks.length-overdue
    const parts:string[]=[]
    if(p.overdue&&overdue)parts.push(`기한경과 ${overdue}건`)
    if(p.task_due&&upcoming)parts.push(`마감예정 ${upcoming}건`)
    if(p.correction&&corrections.length)parts.push(`보완 ${corrections.length}건`)
    if(finance&&p.receivable&&receivables.length)parts.push(`미수금 ${receivables.length}건`)
    if(finance&&p.tax_invoice&&taxes.length)parts.push(`세금계산서 ${taxes.length}건`)
    if(!parts.length)continue
    const payload=JSON.stringify({title:`${staff.name}님 오늘의 업무 알림`,body:parts.join(' · '),url:'/alerts'})
    for(const d of devices){
      try{await webpush.sendNotification({endpoint:d.endpoint,keys:{p256dh:d.p256dh,auth:d.auth_key}},payload);totalSent++}
      catch(e:any){if(e?.statusCode===404||e?.statusCode===410)await db.from('push_subscription').delete().eq('endpoint',d.endpoint);else console.error('push failed',staff.id,e?.message)}
    }
  }
  console.log(`daily-push: ${totalSent} notifications sent`)
}

export const config={schedule:'0 0 * * *'} // 매일 09:00 KST (UTC 기준)
