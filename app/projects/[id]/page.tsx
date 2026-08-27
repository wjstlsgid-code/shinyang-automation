'use client'
import { useEffect,useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft,Link2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/components/AuthProvider'
import type { Project,ChecklistItem,Task } from '@/lib/types'
import FileAttachmentPanel from '@/app/components/FileAttachmentPanel'

export default function ProjectDetail(){
 const {id}=useParams<{id:string}>(); const {staff}=useAuth(); const [project,setProject]=useState<Project|null>(null); const [check,setCheck]=useState<ChecklistItem[]>([]); const [tasks,setTasks]=useState<Task[]>([])
 const can=staff?.role==='ADMIN'||staff?.role==='MANAGER'; const [portalBusy,setPortalBusy]=useState(false)
 async function load(){const [{data:p},{data:c},{data:t}]=await Promise.all([supabase.from('project').select('*,client:client_id(name,email,phone),manager:manager_id(name)').eq('id',id).single(),supabase.from('project_checklist').select('*').eq('project_id',id).order('sort_order'),supabase.from('task').select('*,assignee:assignee_id(name)').eq('project_id',id).is('deleted_at',null).order('due_date')]);setProject(p as Project);setCheck((c||[]) as ChecklistItem[]);setTasks((t||[]) as Task[])}
 useEffect(()=>{load()},[id])
 async function toggle(x:ChecklistItem){await supabase.from('project_checklist').update({done:!x.done,done_at:!x.done?new Date().toISOString():null}).eq('id',x.id);load()}
 async function createPortal(){setPortalBusy(true);const {data:{session}}=await supabase.auth.getSession();const r=await fetch('/api/portal/share',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token||''}`},body:JSON.stringify({project_id:id,days:30})});const d=await r.json();setPortalBusy(false);if(!r.ok){alert(d.error||'포털 링크 생성 실패');return}const url=`${location.origin}/portal/${d.token}`;await navigator.clipboard.writeText(url);alert('고객 포털 링크를 복사했습니다. 30일간 유효합니다.')}
 if(!project)return <div className="centerInline">프로젝트 불러오는 중...</div>
 const done=check.filter(x=>x.done).length; const pct=check.length?Math.round(done/check.length*100):0
 return <><div className="pageHead"><div><Link href="/projects" className="backLink"><ArrowLeft size={15}/> 프로젝트 목록</Link><h1>{project.project_name}</h1><p>{project.client?.name} · {project.permit_type} · 담당 {project.manager?.name||'미지정'}</p></div><div className="toolbar">{can&&<button className="secondary" disabled={portalBusy} onClick={createPortal}><Link2 size={14}/> {portalBusy?'생성 중...':'고객 포털 링크'}</button>}<span className="badge">{project.status}</span></div></div>
 <div className="grid4"><div className="card metric"><span>마감일</span><strong className="smallMetric">{project.due_date||'미정'}</strong></div><div className="card metric"><span>계약금액</span><strong className="smallMetric">{Number(project.contract_amount).toLocaleString()}원</strong></div><div className="card metric"><span>체크리스트</span><strong>{done}/{check.length}</strong></div><div className="card metric"><span>진행률</span><strong>{pct}%</strong></div></div>
 <div className="twoCol section"><section><h2>인허가 체크리스트</h2><div className="card listCard"><div className="progress"><span style={{width:`${pct}%`}}/></div>{check.map(x=><label key={x.id} className="checkRow"><input type="checkbox" checked={x.done} onChange={()=>toggle(x)}/><span className={x.done?'doneText':''}>{x.label}</span>{x.is_required&&<small>필수</small>}</label>)}{!check.length&&<div className="empty">체크리스트가 없습니다.</div>}</div></section><section><FileAttachmentPanel projectId={id}/></section></div>
 <section className="section"><h2>연결 업무</h2><div className="tableWrap"><table><thead><tr><th>업무</th><th>담당</th><th>우선순위</th><th>마감</th><th>상태</th></tr></thead><tbody>{tasks.map(x=><tr key={x.id}><td>{x.title}</td><td>{x.assignee?.name||'-'}</td><td>{x.priority}</td><td>{x.due_date||'-'}</td><td><span className="badge">{x.status}</span></td></tr>)}{!tasks.length&&<tr><td colSpan={5} className="empty">연결된 업무가 없습니다.</td></tr>}</tbody></table></div></section></>
}
