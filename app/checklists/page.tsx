'use client'
import { FormEvent,useEffect,useMemo,useState } from 'react'
import { Pencil,Plus,Save,Trash2,X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/components/AuthProvider'
import type { ChecklistItem,Project } from '@/lib/types'

export default function Checklists(){
 const {staff}=useAuth()
 const canManage=staff?.role==='ADMIN'||staff?.role==='MANAGER'

 const [projects,setProjects]=useState<Project[]>([])
 const [items,setItems]=useState<ChecklistItem[]>([])
 const [projectId,setProjectId]=useState('')
 const [addOpen,setAddOpen]=useState(false)
 const [label,setLabel]=useState('')
 const [required,setRequired]=useState(true)
 const [newNote,setNewNote]=useState('')
 const [saving,setSaving]=useState(false)
 const [err,setErr]=useState('')
 const [editingId,setEditingId]=useState<string|null>(null)
 const [editLabel,setEditLabel]=useState('')
 const [editRequired,setEditRequired]=useState(true)

 async function load(){
  const [{data:p},{data:i}]=await Promise.all([
   (()=>{
    let q=supabase.from('project').select('*,client:client_id(name)').is('deleted_at',null).neq('status','취소').order('created_at',{ascending:false})
    if(staff?.role==='STAFF'&&!staff?.permissions?.all_projects)q=q.eq('manager_id',staff.id)
    return q
   })(),
   supabase.from('project_checklist').select('*,project:project_id(project_name,permit_type,client:client_id(name))').order('sort_order')
  ])
  setProjects((p||[]) as Project[])
  setItems((i||[]) as ChecklistItem[])
  if(!projectId&&p?.[0])setProjectId(p[0].id)
 }

 useEffect(()=>{load()},[])

 const rows=useMemo(()=>items.filter(x=>x.project_id===projectId),[items,projectId])
 const done=rows.filter(x=>x.done).length
 const pct=rows.length?Math.round(done/rows.length*100):0
 const selectedProject=projects.find(x=>x.id===projectId)

 async function toggle(row:ChecklistItem){
  await supabase.from('project_checklist').update({
   done:!row.done,
   done_at:!row.done?new Date().toISOString():null
  }).eq('id',row.id)
  load()
 }

 async function note(row:ChecklistItem,value:string){
  await supabase.from('project_checklist').update({note:value||null}).eq('id',row.id)
  setItems(items.map(x=>x.id===row.id?{...x,note:value}:x))
 }

 async function addItem(e:FormEvent){
  e.preventDefault()
  if(!projectId){setErr('프로젝트를 먼저 선택해 주세요.');return}
  if(!label.trim()){setErr('점검항목을 입력해 주세요.');return}
  setSaving(true);setErr('')
  try{
   const nextSort=rows.length?Math.max(...rows.map(x=>Number(x.sort_order)||0))+10:10
   const {error}=await supabase.from('project_checklist').insert({
    project_id:projectId,
    label:label.trim(),
    sort_order:nextSort,
    is_required:required,
    done:false,
    note:newNote.trim()||null
   })
   if(error)throw error
   setLabel('');setRequired(true);setNewNote('');setAddOpen(false)
   await load()
  }catch(e:any){
   setErr(e?.message||'체크리스트 추가에 실패했습니다.')
  }finally{
   setSaving(false)
  }
 }

 function startEdit(row:ChecklistItem){
  setEditingId(row.id)
  setEditLabel(row.label)
  setEditRequired(row.is_required)
 }

 async function saveEdit(row:ChecklistItem){
  if(!editLabel.trim())return
  const {error}=await supabase.from('project_checklist').update({
   label:editLabel.trim(),
   is_required:editRequired
  }).eq('id',row.id)
  if(error){alert('수정 실패: '+error.message);return}
  setEditingId(null)
  await load()
 }

 async function remove(row:ChecklistItem){
  if(!confirm(`"${row.label}" 항목을 삭제할까요?`))return
  const {error}=await supabase.from('project_checklist').delete().eq('id',row.id)
  if(error){alert('삭제 실패: '+error.message);return}
  await load()
 }

 return <>
  <div className="pageHead">
   <div>
    <h1>인허가 체크리스트</h1>
    <p>프로젝트별 기본 체크항목을 확인하고 필요한 항목을 직접 추가·수정할 수 있습니다.</p>
   </div>
   {canManage&&<button className="primary" onClick={()=>{
    if(!projectId){alert('프로젝트를 먼저 선택해 주세요.');return}
    setErr('');setAddOpen(true)
   }}><Plus size={15}/> 체크항목 추가</button>}
  </div>

  <div className="card filterCard">
   <label>프로젝트
    <select value={projectId} onChange={e=>{setProjectId(e.target.value);setEditingId(null)}}>
     <option value="">선택</option>
     {projects.map(p=><option key={p.id} value={p.id}>{p.client?.name} · {p.project_name} ({p.permit_type})</option>)}
    </select>
   </label>
   <div className="progressText"><b>{done}/{rows.length}</b> 완료 · {pct}%</div>
  </div>

  <div className="progress"><span style={{width:`${pct}%`}}/></div>

  <div className="section tableWrap checklistTableWrap">
   <table className="checklistTable">
    <thead><tr><th>완료</th><th>점검항목</th><th>필수</th><th>메모</th>{canManage&&<th>관리</th>}</tr></thead>
    <tbody>
     {rows.map(x=><tr key={x.id}>
      <td><input type="checkbox" checked={x.done} onChange={()=>toggle(x)}/></td>
      <td className={x.done?'doneText':''}>
       {editingId===x.id
        ?<input className="inlineInput checklistEditInput" value={editLabel} onChange={e=>setEditLabel(e.target.value)} autoFocus/>
        :<b>{x.label}</b>}
      </td>
      <td>
       {editingId===x.id
        ?<label className="miniCheck"><input type="checkbox" checked={editRequired} onChange={e=>setEditRequired(e.target.checked)}/> 필수</label>
        :x.is_required?<span className="badge warn">필수</span>:'선택'}
      </td>
      <td><input className="inlineInput" defaultValue={x.note||''} onBlur={e=>note(x,e.target.value)} placeholder="확보자료/보완사항 메모"/></td>
      {canManage&&<td>
       <div className="checklistActions">
        {editingId===x.id
         ?<>
           <button className="iconBtn okIcon" onClick={()=>saveEdit(x)} title="저장"><Save size={14}/></button>
           <button className="iconBtn" onClick={()=>setEditingId(null)} title="취소"><X size={14}/></button>
          </>
         :<>
           <button className="iconBtn" onClick={()=>startEdit(x)} title="수정"><Pencil size={14}/></button>
           <button className="dangerBtn" onClick={()=>remove(x)} title="삭제"><Trash2 size={13}/></button>
          </>}
       </div>
      </td>}
     </tr>)}
     {!rows.length&&<tr><td colSpan={canManage?5:4} className="empty">
      {projectId?'등록된 체크항목이 없습니다. 체크항목 추가 버튼으로 직접 추가하세요.':'프로젝트를 선택해 주세요.'}
     </td></tr>}
    </tbody>
   </table>
  </div>

  {addOpen&&<div className="modalBack"><form className="modal checklistAddModal" onSubmit={addItem}>
   <h2>인허가 체크항목 추가</h2>
   <p className="modalSub">{selectedProject?.client?.name} · {selectedProject?.project_name}</p>
   <div className="formGrid">
    <label className="full">점검항목
     <input required value={label} onChange={e=>setLabel(e.target.value)} placeholder="예: 사업자등록증 확보"/>
    </label>
    <label className="full">메모
     <textarea value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="필요자료, 보완사항 등"/>
    </label>
    <label className="full checkLabel">
     <input type="checkbox" checked={required} onChange={e=>setRequired(e.target.checked)}/> 필수 항목
    </label>
   </div>
   {err&&<div className="error">{err}</div>}
   <div className="actions">
    <button type="button" className="secondary" onClick={()=>setAddOpen(false)}>취소</button>
    <button className="primary" disabled={saving}><Plus size={14}/>{saving?' 추가 중...':' 추가'}</button>
   </div>
  </form></div>}
 </>
}
