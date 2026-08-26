'use client'
import { useEffect,useMemo,useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/components/AuthProvider'
import type { ChecklistItem,Project } from '@/lib/types'

export default function Checklists(){const {staff}=useAuth();
 const [projects,setProjects]=useState<Project[]>([]); const [items,setItems]=useState<ChecklistItem[]>([]); const [projectId,setProjectId]=useState('')
 async function load(){const [{data:p},{data:i}]=await Promise.all([(()=>{let q=supabase.from('project').select('*,client:client_id(name)').is('deleted_at',null).neq('status','취소').order('created_at',{ascending:false});if(staff?.role==='STAFF'&&!staff?.permissions?.all_projects)q=q.eq('manager_id',staff.id);return q})(),supabase.from('project_checklist').select('*,project:project_id(project_name,permit_type,client:client_id(name))').order('sort_order')]);setProjects((p||[]) as Project[]);setItems((i||[]) as ChecklistItem[]);if(!projectId&&p?.[0])setProjectId(p[0].id)}
 useEffect(()=>{load()},[])
 const rows=useMemo(()=>items.filter(x=>x.project_id===projectId),[items,projectId]); const done=rows.filter(x=>x.done).length; const pct=rows.length?Math.round(done/rows.length*100):0
 async function toggle(row:ChecklistItem){await supabase.from('project_checklist').update({done:!row.done,done_at:!row.done?new Date().toISOString():null}).eq('id',row.id);load()}
 async function note(row:ChecklistItem,value:string){await supabase.from('project_checklist').update({note:value||null}).eq('id',row.id);setItems(items.map(x=>x.id===row.id?{...x,note:value}:x))}
 return <><div className="pageHead"><div><h1>인허가 체크리스트</h1><p>프로젝트 생성 시 인허가 분야별 기본 서류와 검토항목이 자동 생성됩니다.</p></div></div><div className="card filterCard"><label>프로젝트<select value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">선택</option>{projects.map(p=><option key={p.id} value={p.id}>{p.client?.name} · {p.project_name} ({p.permit_type})</option>)}</select></label><div className="progressText"><b>{done}/{rows.length}</b> 완료 · {pct}%</div></div><div className="progress"><span style={{width:`${pct}%`}}/></div><div className="section tableWrap"><table><thead><tr><th>완료</th><th>점검항목</th><th>필수</th><th>메모</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><input type="checkbox" checked={x.done} onChange={()=>toggle(x)}/></td><td className={x.done?'doneText':''}><b>{x.label}</b></td><td>{x.is_required?<span className="badge warn">필수</span>:'선택'}</td><td><input className="inlineInput" defaultValue={x.note||''} onBlur={e=>note(x,e.target.value)} placeholder="확보자료/보완사항 메모"/></td></tr>)}{!rows.length&&<tr><td colSpan={4} className="empty">프로젝트를 선택하거나 체크리스트 생성 여부를 확인하세요.</td></tr>}</tbody></table></div></>
}
