'use client'
import Link from 'next/link'
import { useEffect,useMemo,useState } from 'react'
import { BellRing, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/components/AuthProvider'
import type { AlertItem,AlertPreferences } from '@/lib/types'

const defaults:AlertPreferences={due_days:7,task_due:true,overdue:true,correction:true,receivable:true,tax_invoice:true,browser_notify:false}

export default function Alerts(){
 const {staff}=useAuth(); const [rows,setRows]=useState<AlertItem[]>([]); const [prefs,setPrefs]=useState<AlertPreferences>(defaults); const [saving,setSaving]=useState(false)
 useEffect(()=>{if(staff)void loadPrefs()},[staff?.id])
 useEffect(()=>{if(staff)void loadAlerts()},[staff?.id,prefs.due_days,prefs.task_due,prefs.overdue,prefs.correction,prefs.receivable,prefs.tax_invoice])
 async function loadPrefs(){const {data}=await supabase.from('alert_preference').select('due_days,task_due,overdue,correction,receivable,tax_invoice,browser_notify').eq('staff_id',staff!.id).maybeSingle();if(data)setPrefs({...defaults,...data})}
 async function loadAlerts(){
  const today=new Date(); const limit=new Date(); limit.setDate(today.getDate()+Number(prefs.due_days||7)); const start=today.toISOString().slice(0,10),end=limit.toISOString().slice(0,10)
  let tq=supabase.from('task').select('title,due_date,status,assignee_id,project:project_id(project_name,manager_id)').is('deleted_at',null).neq('status','완료').lte('due_date',end)
  if(staff?.role==='STAFF') tq=tq.eq('assignee_id',staff.id)
  let pq=supabase.from('project').select('project_name,due_date,status,manager_id,client:client_id(name)').is('deleted_at',null).eq('status','보완')
  if(staff?.role==='STAFF') pq=pq.eq('manager_id',staff.id)
  const jobs:any[]=[tq,pq]
  if(staff?.role!=='STAFF'){jobs.push(supabase.from('v_receivables').select('*').gt('receivable',0));jobs.push(supabase.from('billing').select('billing_type,due_date,tax_invoice_status,project:project_id(project_name,client:client_id(name))').is('deleted_at',null).eq('tax_invoice_status','미발행'))}
  const res=await Promise.all(jobs); const t=res[0].data||[],p=res[1].data||[],r=res[2]?.data||[],b=res[3]?.data||[]; const out:AlertItem[]=[]
  ;(t as any[]).forEach(x=>{const overdue=x.due_date<start;if((overdue&&!prefs.overdue)||(!overdue&&!prefs.task_due))return;out.push({type:'마감',title:x.title,detail:`${x.project?.project_name||'공통업무'} · ${overdue?'기한경과':`${prefs.due_days}일 이내 마감`}`,due_date:x.due_date,severity:overdue?'danger':'warn',href:'/tasks'})})
  if(prefs.correction)(p as any[]).forEach(x=>out.push({type:'보완',title:x.project_name,detail:`${x.client?.name||'-'} · 보완 처리 필요`,due_date:x.due_date,severity:'danger',href:'/projects'}))
  if(prefs.receivable)(r as any[]).forEach(x=>out.push({type:'미수금',title:x.project_name,detail:`${x.client_name} · ${Number(x.receivable).toLocaleString()}원 미수`,due_date:null,severity:'warn',href:'/finance'}))
  if(prefs.tax_invoice)(b as any[]).forEach(x=>out.push({type:'세금계산서',title:x.project?.project_name||'-',detail:`${x.project?.client?.name||'-'} · ${x.billing_type} 미발행`,due_date:x.due_date,severity:'info',href:'/finance'}))
  setRows(out)
 }
 async function savePrefs(){setSaving(true);const {error}=await supabase.from('alert_preference').upsert({staff_id:staff!.id,...prefs,updated_at:new Date().toISOString()},{onConflict:'staff_id'});setSaving(false);if(error){alert(error.message);return}alert('알림 설정을 저장했습니다.')}
 async function enableBrowser(){if(!('Notification'in window)){alert('이 브라우저는 알림을 지원하지 않습니다.');return}const result=await Notification.requestPermission();const enabled=result==='granted';setPrefs(v=>({...v,browser_notify:enabled}));if(enabled){new Notification('신양파트너스 알림',{body:`현재 확인할 알림 ${rows.length}건이 있습니다.`})}}
 async function enablePush(){if(!('serviceWorker'in navigator)||!('PushManager'in window)){alert('이 기기/브라우저는 웹푸시를 지원하지 않습니다.');return}const {data:{session}}=await supabase.auth.getSession();const token=session?.access_token||'';const kr=await fetch('/api/push/public-key',{headers:{Authorization:`Bearer ${token}`}});const kd=await kr.json();if(!kr.ok||!kd.publicKey){alert(kd.error||'푸시 키 준비 실패');return}const reg=await navigator.serviceWorker.register('/sw.js');const perm=await Notification.requestPermission();if(perm!=='granted')return;const b64=(s:string)=>{const pad='='.repeat((4-s.length%4)%4);const base64=(s+pad).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(base64),c=>c.charCodeAt(0))};const existing=await reg.pushManager.getSubscription();const sub=existing||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64(kd.publicKey)});const r=await fetch('/api/push/subscribe',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(sub)});if(!r.ok){const d=await r.json();alert(d.error||'푸시 등록 실패');return}alert('백그라운드 푸시 알림을 등록했습니다.')}
 async function testPush(){const {data:{session}}=await supabase.auth.getSession();const r=await fetch('/api/push/test',{method:'POST',headers:{Authorization:`Bearer ${session?.access_token||''}`}});const d=await r.json();alert(r.ok?`테스트 푸시 ${d.sent}건 전송`:(d.error||'테스트 실패'))}
 const dangerCount=useMemo(()=>rows.filter(x=>x.severity==='danger').length,[rows])
 return <><div className="pageHead"><div><h1>알림센터</h1><p>마감, 보완, 미수금, 세금계산서 누락을 자동으로 모아봅니다.</p></div><div className="toolbar"><span className="badge danger">긴급 {dangerCount}</span><span className="badge">전체 {rows.length}</span></div></div>
 <div className="card alertSettings"><h2>내 알림 설정</h2><div className="settingGrid"><label>마감 사전알림<select value={prefs.due_days} onChange={e=>setPrefs({...prefs,due_days:Number(e.target.value)})}><option value={1}>1일 전</option><option value={3}>3일 전</option><option value={7}>7일 전</option><option value={14}>14일 전</option></select></label><label className="switchRow"><span>업무 마감</span><input type="checkbox" checked={prefs.task_due} onChange={e=>setPrefs({...prefs,task_due:e.target.checked})}/></label><label className="switchRow"><span>기한 경과</span><input type="checkbox" checked={prefs.overdue} onChange={e=>setPrefs({...prefs,overdue:e.target.checked})}/></label><label className="switchRow"><span>보완 요청</span><input type="checkbox" checked={prefs.correction} onChange={e=>setPrefs({...prefs,correction:e.target.checked})}/></label>{staff?.role!=='STAFF'&&<><label className="switchRow"><span>미수금</span><input type="checkbox" checked={prefs.receivable} onChange={e=>setPrefs({...prefs,receivable:e.target.checked})}/></label><label className="switchRow"><span>세금계산서 미발행</span><input type="checkbox" checked={prefs.tax_invoice} onChange={e=>setPrefs({...prefs,tax_invoice:e.target.checked})}/></label></>}</div><div className="toolbar alertActions"><button className="secondary" onClick={enableBrowser}><BellRing size={15}/> 브라우저 알림 허용</button><button className="secondary" onClick={enablePush}><BellRing size={15}/> 앱 종료 후 푸시</button><button className="secondary" onClick={testPush}>테스트 푸시</button><button className="primary" disabled={saving} onClick={savePrefs}><Save size={15}/> {saving?'저장 중...':'알림 설정 저장'}</button></div><p className="hint">앱을 열면 알림센터와 메뉴 배지가 자동 갱신됩니다. ‘앱 종료 후 푸시’를 한 번 등록하면 서버가 푸시 키를 안전하게 자동 준비하고, 매일 업무 알림을 전송합니다.</p></div>
 <div className="alertList section">{rows.map((x,i)=><Link className={`alertCard ${x.severity}`} href={x.href} key={i}><div><span className="badge">{x.type}</span><b>{x.title}</b><p>{x.detail}</p></div><strong>{x.due_date||'확인 필요'}</strong></Link>)}{!rows.length&&<div className="card empty">현재 확인할 알림이 없습니다.</div>}</div></>
}
