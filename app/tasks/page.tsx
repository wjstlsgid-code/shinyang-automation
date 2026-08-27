'use client'
import { FormEvent,useEffect,useMemo,useState } from 'react'
import { FolderCog,Paperclip,Pencil,Plus,Trash2,Users,X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../components/AuthProvider'
import type { Staff,Task } from '@/lib/types'
import FileAttachmentPanel from '@/app/components/FileAttachmentPanel'

const DEFAULT_PROJECT_TYPES=['폐기물','환경','화관법','산안법','컨설팅(토탈)']
const DEFAULT_PEOPLE=['전유경','박세훈','이유진','임유진','임지원','김주현']
const TASK_STATUSES=['대기','진행중','보완중','보류','완료']
const META_PREFIX='[SYTASKMETA]'

type Meta={
  projects:string[]
  assignee_names:string[]
  assignee_ids:string[]
  note:string
}
type PersonOption={key:string,name:string,staff_id:string|null}

function decodeMeta(v?:string|null):Meta{
  if(!v||!v.startsWith(META_PREFIX)) return {projects:[],assignee_names:[],assignee_ids:[],note:v||''}
  try{
    const x=JSON.parse(v.slice(META_PREFIX.length))
    return {
      projects:Array.isArray(x.projects)?x.projects.map(String):[],
      assignee_names:Array.isArray(x.assignee_names)?x.assignee_names.map(String):[],
      assignee_ids:Array.isArray(x.assignee_ids)?x.assignee_ids.map(String):[],
      note:String(x.note||'')
    }
  }catch{
    return {projects:[],assignee_names:[],assignee_ids:[],note:''}
  }
}
function encodeMeta(m:Meta){return META_PREFIX+JSON.stringify(m)}
function normalizeStatus(v?:string|null){return v==='보완'?'보완중':(v||'대기')}

export default function Tasks(){
 const {staff}=useAuth()
 const manager=staff?.role==='ADMIN'||staff?.role==='MANAGER'

 const [rows,setRows]=useState<Task[]>([])
 const [staffRows,setStaffRows]=useState<Staff[]>([])
 const [personLogs,setPersonLogs]=useState<any[]>([])
 const [projectLogs,setProjectLogs]=useState<any[]>([])
 const [open,setOpen]=useState(false)
 const [editingTask,setEditingTask]=useState<Task|null>(null)
 const [peopleOpen,setPeopleOpen]=useState(false)
 const [projectManageOpen,setProjectManageOpen]=useState(false)
 const [fileTask,setFileTask]=useState<Task|null>(null)
 const [newPerson,setNewPerson]=useState('')
 const [newProjectType,setNewProjectType]=useState('')
 const [editingProjectName,setEditingProjectName]=useState<string|null>(null)
 const [editingProjectValue,setEditingProjectValue]=useState('')
 const [err,setErr]=useState('')

 const [form,setForm]=useState({
   title:'',
   project_types:[] as string[],
   assignee_keys:[] as string[],
   priority:'보통',
   status:'대기',
   due_date:'',
   correction_note:''
 })

 async function load(){
  const [{data:r},{data:s},{data:l},{data:pl}]=await Promise.all([
   (()=>supabase.from('task')
      .select('*,project:project_id(project_name),assignee:assignee_id(name)')
      .is('deleted_at',null)
      .order('due_date',{ascending:true,nullsFirst:false}))(),
   supabase.from('staff').select('id,name,role,department,active').eq('active',true).order('name'),
   supabase.from('activity_log')
    .select('id,action,summary,created_at')
    .eq('entity_type','task_person')
    .order('created_at',{ascending:true})
    .limit(500),
   supabase.from('activity_log')
    .select('id,action,summary,created_at')
    .eq('entity_type','task_project_type')
    .order('created_at',{ascending:true})
    .limit(500)
  ])
  const allRows=(r||[]) as Task[]
  const filtered=staff?.role==='STAFF'&&!staff?.permissions?.all_projects
    ? allRows.filter((x:any)=>{
        const meta=decodeMeta(x.correction_note)
        return x.assignee_id===staff.id || meta.assignee_ids.includes(staff.id)
      })
    : allRows
  setRows(filtered)
  setStaffRows((s||[]) as Staff[])
  setPersonLogs(l||[])
  setProjectLogs(pl||[])
 }
 useEffect(()=>{if(staff)load()},[staff?.id])

 const people=useMemo<PersonOption[]>(()=>{
   const realByName=new Map<string,Staff>()
   staffRows.forEach(s=>{if(s.name) realByName.set(s.name,s)})
   const state=new Map<string,boolean>()
   DEFAULT_PEOPLE.forEach(n=>state.set(n,true))
   staffRows.forEach(s=>{if(s.name) state.set(s.name,true)})
   personLogs.forEach((x:any)=>{
     const name=String(x.summary||'').trim()
     if(!name)return
     state.set(name,x.action!=='delete')
   })
   return [...state.entries()]
    .filter(([,active])=>active)
    .map(([name])=>{
      const real=realByName.get(name)
      return {key:real?`staff:${real.id}`:`name:${name}`,name,staff_id:real?.id||null}
    })
 },[staffRows,personLogs])

 const projectTypes=useMemo(()=>{
   const state=new Map<string,boolean>()
   DEFAULT_PROJECT_TYPES.forEach(n=>state.set(n,true))
   projectLogs.forEach((x:any)=>{
     const summary=String(x.summary||'').trim()
     if(!summary)return
     if(x.action==='rename'){
       try{
         const p=JSON.parse(summary)
         const from=String(p.from||'').trim(),to=String(p.to||'').trim()
         if(from)state.set(from,false)
         if(to)state.set(to,true)
       }catch{}
     }else if(x.action==='delete') state.set(summary,false)
     else state.set(summary,true)
   })
   // 이미 배정된 업무에 사용 중인 프로젝트명은 언제나 목록에 유지
   rows.forEach((x:any)=>{
     const meta=decodeMeta(x.correction_note)
     meta.projects.forEach(n=>{if(n)state.set(n,true)})
     if(!meta.projects.length&&x.project?.project_name) state.set(String(x.project.project_name),true)
   })
   return [...state.entries()].filter(([,active])=>active).map(([name])=>name)
 },[projectLogs,rows])

 function resetForm(){
   setEditingTask(null)
   setForm({title:'',project_types:[],assignee_keys:[],priority:'보통',status:'대기',due_date:'',correction_note:''})
   setErr('')
 }
 function openCreate(){resetForm();setOpen(true)}
 function openEdit(x:any){
   const meta=decodeMeta(x.correction_note)
   const projects=meta.projects.length?meta.projects:(x.project?.project_name?[x.project.project_name]:[])
   const keys:string[]=[]
   meta.assignee_ids.forEach(id=>{
     const p=people.find(v=>v.staff_id===id)
     if(p&&!keys.includes(p.key))keys.push(p.key)
   })
   meta.assignee_names.forEach(name=>{
     const p=people.find(v=>v.name===name)
     if(p&&!keys.includes(p.key))keys.push(p.key)
   })
   if(!keys.length&&x.assignee_id){
     const p=people.find(v=>v.staff_id===x.assignee_id)
     if(p)keys.push(p.key)
   }
   setEditingTask(x)
   setForm({
     title:x.title||'',
     project_types:projects,
     assignee_keys:keys,
     priority:x.priority||'보통',
     status:normalizeStatus(x.status),
     due_date:x.due_date||'',
     correction_note:meta.note
   })
   setErr('')
   setOpen(true)
 }

 function toggleProject(v:string){
   setErr('')
   setForm(prev=>{
     if(prev.project_types.includes(v)) return {...prev,project_types:prev.project_types.filter(x=>x!==v)}
     if(prev.project_types.length>=3){setErr('프로젝트는 최대 3개까지 선택할 수 있습니다.');return prev}
     return {...prev,project_types:[...prev.project_types,v]}
   })
 }
 function toggleAssignee(key:string){
   setForm(prev=>({...prev,assignee_keys:prev.assignee_keys.includes(key)?prev.assignee_keys.filter(x=>x!==key):[...prev.assignee_keys,key]}))
 }

 async function save(e:FormEvent){
   e.preventDefault();setErr('')
   if(!form.project_types.length){setErr('프로젝트를 1개 이상 선택해 주세요.');return}
   if(!form.assignee_keys.length){setErr('담당자를 1명 이상 선택해 주세요.');return}
   const selected=people.filter(p=>form.assignee_keys.includes(p.key))
   const realIds=selected.map(p=>p.staff_id).filter(Boolean) as string[]
   const meta:Meta={projects:form.project_types,assignee_names:selected.map(p=>p.name),assignee_ids:realIds,note:form.correction_note.trim()}
   const payload:any={
     project_id:null,
     title:form.title,
     assignee_id:realIds[0]||null,
     priority:form.priority,
     status:form.status,
     due_date:form.due_date||null,
     correction_note:encodeMeta(meta),
     completed_at:form.status==='완료'?(editingTask?.completed_at||new Date().toISOString()):null
   }
   const result=editingTask
     ? await supabase.from('task').update(payload).eq('id',editingTask.id)
     : await supabase.from('task').insert(payload)
   if(result.error){setErr(result.error.message);return}
   setOpen(false);resetForm();load()
 }

 async function deleteTask(){
   if(!manager||!editingTask)return
   if(!confirm(`“${editingTask.title}” 업무를 삭제할까요?`))return
   const {error}=await supabase.from('task').update({deleted_at:new Date().toISOString()}).eq('id',editingTask.id)
   if(error){setErr(error.message);return}
   setOpen(false);resetForm();load()
 }

 async function setStatus(id:string,status:string){
   const row:any=rows.find((x:any)=>x.id===id)
   const meta=decodeMeta(row?.correction_note)
   if(!manager && row?.assignee_id!==staff?.id && !meta.assignee_ids.includes(staff?.id||''))return
   const {error}=await supabase.from('task').update({status,completed_at:status==='완료'?new Date().toISOString():null}).eq('id',id)
   if(error){alert('상태 변경 실패: '+error.message);return}
   load()
 }

 async function addPerson(e:FormEvent){
   e.preventDefault();if(!manager||!staff)return
   const name=newPerson.trim();if(!name)return
   if(people.some(p=>p.name===name)){alert('이미 등록된 이름입니다.');return}
   const {error}=await supabase.from('activity_log').insert({actor_id:staff.id,entity_type:'task_person',entity_id:null,action:'add',summary:name})
   if(error){alert('이름 추가 실패: '+error.message);return}
   setNewPerson('');load()
 }
 async function removePerson(name:string){
   if(!manager||!staff)return
   if(!confirm(`${name} 이름을 업무배정 담당자 목록에서 삭제할까요?`))return
   const {error}=await supabase.from('activity_log').insert({actor_id:staff.id,entity_type:'task_person',entity_id:null,action:'delete',summary:name})
   if(error){alert('이름 삭제 실패: '+error.message);return}
   setForm(prev=>({...prev,assignee_keys:prev.assignee_keys.filter(k=>people.find(x=>x.key===k)?.name!==name)}))
   load()
 }

 async function addProjectType(e:FormEvent){
   e.preventDefault();if(!manager||!staff)return
   const name=newProjectType.trim();if(!name)return
   if(projectTypes.includes(name)){alert('이미 등록된 프로젝트명입니다.');return}
   const {error}=await supabase.from('activity_log').insert({actor_id:staff.id,entity_type:'task_project_type',entity_id:null,action:'add',summary:name})
   if(error){alert('프로젝트 추가 실패: '+error.message);return}
   setNewProjectType('');load()
 }
 async function removeProjectType(name:string){
   if(!manager||!staff)return
   const inUse=(rows as any[]).some(row=>{
     const meta=decodeMeta(row.correction_note)
     return meta.projects.includes(name) || (!meta.projects.length&&row.project?.project_name===name)
   })
   if(inUse){alert('이 프로젝트명은 현재 업무에 사용 중입니다. 해당 업무의 프로젝트를 먼저 변경한 뒤 삭제해 주세요.');return}
   if(!confirm(`${name} 프로젝트명을 업무배정 목록에서 삭제할까요?`))return
   const {error}=await supabase.from('activity_log').insert({actor_id:staff.id,entity_type:'task_project_type',entity_id:null,action:'delete',summary:name})
   if(error){alert('프로젝트명 삭제 실패: '+error.message);return}
   setForm(prev=>({...prev,project_types:prev.project_types.filter(v=>v!==name)}))
   load()
 }

 async function saveProjectRename(oldName:string){
   if(!manager||!staff)return
   const newName=editingProjectValue.trim()
   if(!newName){alert('프로젝트명을 입력해 주세요.');return}
   if(newName!==oldName&&projectTypes.includes(newName)){alert('이미 등록된 프로젝트명입니다.');return}
   if(newName===oldName){setEditingProjectName(null);return}

   // 기존 업무의 프로젝트 태그도 함께 변경
   for(const row of rows as any[]){
     const meta=decodeMeta(row.correction_note)
     if(!meta.projects.includes(oldName))continue
     const changed={...meta,projects:meta.projects.map(v=>v===oldName?newName:v)}
     const {error}=await supabase.from('task').update({correction_note:encodeMeta(changed)}).eq('id',row.id)
     if(error){alert('기존 업무 프로젝트명 변경 실패: '+error.message);return}
   }
   const {error}=await supabase.from('activity_log').insert({
     actor_id:staff.id,entity_type:'task_project_type',entity_id:null,action:'rename',summary:JSON.stringify({from:oldName,to:newName})
   })
   if(error){alert('프로젝트명 저장 실패: '+error.message);return}
   setForm(prev=>({...prev,project_types:prev.project_types.map(v=>v===oldName?newName:v)}))
   setEditingProjectName(null);setEditingProjectValue('');load()
 }

 return <>
  <div className="pageHead">
   <div><h1>업무</h1><p>직원별 할 일, 프로젝트 분야, 진행상태, 마감일, 보완사항을 관리합니다.</p></div>
   {manager&&<div className="taskHeadActions">
    <button className="secondary" onClick={()=>setProjectManageOpen(true)}><FolderCog size={15}/> 프로젝트 관리</button>
    <button className="secondary" onClick={()=>setPeopleOpen(true)}><Users size={15}/> 담당자 관리</button>
    <button className="primary taskAssignPrimary" onClick={openCreate}><Plus size={15}/> 업무 배정</button>
   </div>}
  </div>

  <div className="tableWrap"><table className="taskMultiTable">
   <thead><tr><th>업무</th><th>프로젝트</th><th>담당자</th><th>상태</th><th>우선순위</th><th>마감</th></tr></thead>
   <tbody>
    {rows.map((x:any)=>{
      const meta=decodeMeta(x.correction_note)
      const projects=meta.projects.length?meta.projects:(x.project?.project_name?[x.project.project_name]:['공통업무'])
      const names=meta.assignee_names.length?meta.assignee_names:(x.assignee?.name?[x.assignee.name]:['-'])
      const editable=manager||x.assignee_id===staff?.id||meta.assignee_ids.includes(staff?.id||'')
      return <tr key={x.id}>
       <td className="taskStickyCell"><b>{x.title}</b>{meta.note&&<div className="taskCorrection">보완: {meta.note}</div>}
        <div className="taskRowActions">
         {manager&&<button className="secondary taskMiniBtn" type="button" onClick={()=>openEdit(x)}><Pencil size={12}/> 수정</button>}
         <button className="secondary taskMiniBtn" type="button" onClick={()=>setFileTask(x)}><Paperclip size={12}/> 파일첨부</button>
        </div>
       </td>
       <td><div className="taskTagList">{projects.map((v:string)=><span className="taskProjectTag" key={v}>{v}</span>)}</div></td>
       <td><div className="taskTagList">{names.map((v:string)=><span className="taskPersonTag" key={v}>{v}</span>)}</div></td>
       <td>{editable?<select value={normalizeStatus(x.status)} onChange={e=>setStatus(x.id,e.target.value)}>{TASK_STATUSES.map(v=><option key={v}>{v}</option>)}</select>:<span className="badge">{normalizeStatus(x.status)}</span>}</td>
       <td><span className={'badge '+(x.priority==='긴급'?'danger':x.priority==='높음'?'warn':'')}>{x.priority}</span></td>
       <td>{x.due_date||'-'}</td>
      </tr>
    })}
    {!rows.length&&<tr><td colSpan={6} className="empty">등록된 업무가 없습니다.</td></tr>}
   </tbody>
  </table></div>

  {open&&<div className="modalBack"><form className="modal taskAssignModal" onSubmit={save}>
   <div className="taskPeopleHead"><h2>{editingTask?'업무 수정':'업무 배정'}</h2><button type="button" className="iconBtn" onClick={()=>{setOpen(false);resetForm()}}><X size={18}/></button></div>
   <div className="formGrid">
    <label className="full">업무명<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>

    <div className="full taskMultiField">
     <div className="taskMultiFieldTitle"><b>프로젝트 <small>여러 개 선택 가능 · 최대 3개</small></b>{manager&&<button type="button" className="secondary taskMiniBtn" onClick={()=>setProjectManageOpen(true)}><FolderCog size={12}/> 추가/수정</button>}</div>
     <div className="taskChoiceGrid">
      {projectTypes.map(v=><button type="button" key={v} onClick={()=>toggleProject(v)} className={form.project_types.includes(v)?'taskChoice active':'taskChoice'}>{form.project_types.includes(v)?'✓ ':''}{v}</button>)}
     </div>
    </div>

    <div className="full taskMultiField">
     <b>담당자 <small>여러 명 선택 가능</small></b>
     <div className="taskChoiceGrid">
      {people.map(p=><button type="button" key={p.key} onClick={()=>toggleAssignee(p.key)} className={form.assignee_keys.includes(p.key)?'taskChoice active':'taskChoice'}>{form.assignee_keys.includes(p.key)?'✓ ':''}{p.name}</button>)}
     </div>
    </div>

    <label>진행상태<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{TASK_STATUSES.map(v=><option key={v}>{v}</option>)}</select></label>
    <label>우선순위<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{['낮음','보통','높음','긴급'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label className="full">마감일<input type="date" value={form.due_date} onChange={e=>setForm({...form,due_date:e.target.value})}/></label>
    <label className="full">보완사항<textarea value={form.correction_note} onChange={e=>setForm({...form,correction_note:e.target.value})}/></label>
   </div>
   {editingTask&&<div className="taskEditFileHint"><Paperclip size={14}/> 파일은 목록의 <b>파일첨부</b> 버튼에서 추가·다운로드·삭제할 수 있습니다.</div>}
   {err&&<div className="error">{err}</div>}
   <div className="actions taskEditActions">{editingTask&&manager&&<button type="button" className="dangerBtn taskDeleteBtn" onClick={deleteTask}><Trash2 size={13}/> 업무 삭제</button>}<span className="taskActionSpacer"/><button type="button" className="secondary" onClick={()=>{setOpen(false);resetForm()}}>취소</button><button className="primary">{editingTask?'수정 저장':'배정'}</button></div>
  </form></div>}

  {projectManageOpen&&<div className="modalBack"><div className="modal taskPeopleModal">
   <div className="taskPeopleHead"><h2>프로젝트 관리</h2><button className="iconBtn" onClick={()=>{setProjectManageOpen(false);setEditingProjectName(null)}}><X size={18}/></button></div>
   <p className="taskPeopleHelp">업무 배정 화면에 표시할 프로젝트명을 추가·수정·삭제합니다. 이름을 바꾸면 기존 업무의 프로젝트 태그도 함께 변경됩니다. 사용 중인 프로젝트명은 업무를 먼저 변경한 뒤 삭제할 수 있습니다.</p>
   <div className="taskPeopleList">
    {projectTypes.map(name=><div className="taskProjectManageRow" key={name}>
      {editingProjectName===name?<>
       <input autoFocus value={editingProjectValue} onChange={e=>setEditingProjectValue(e.target.value)} />
       <div className="taskProjectManageBtns"><button className="secondary taskMiniBtn" onClick={()=>{setEditingProjectName(null);setEditingProjectValue('')}}>취소</button><button className="primary taskMiniBtn" onClick={()=>saveProjectRename(name)}>저장</button></div>
      </>:<><b>{name}</b><div className="taskProjectManageBtns"><button className="secondary taskMiniBtn" onClick={()=>{setEditingProjectName(name);setEditingProjectValue(name)}}><Pencil size={12}/> 수정</button><button className="dangerBtn taskMiniBtn" onClick={()=>removeProjectType(name)}><Trash2 size={12}/> 삭제</button></div></>}
    </div>)}
   </div>
   <form className="taskPersonAdd" onSubmit={addProjectType}>
    <label>프로젝트명 추가<input value={newProjectType} onChange={e=>setNewProjectType(e.target.value)} placeholder="새 프로젝트명"/></label>
    <button className="primary"><Plus size={14}/> 추가</button>
   </form>
  </div></div>}

  {peopleOpen&&<div className="modalBack"><div className="modal taskPeopleModal">
   <div className="taskPeopleHead"><h2>업무 담당자 관리</h2><button className="iconBtn" onClick={()=>setPeopleOpen(false)}><X size={18}/></button></div>
   <p className="taskPeopleHelp">업무 배정 화면에 표시할 이름을 추가하거나 삭제합니다.</p>
   <div className="taskPeopleList">
    {people.map(p=><div className="taskPersonRow" key={p.key}><b>{p.name}</b><button className="dangerBtn" onClick={()=>removePerson(p.name)}><Trash2 size={13}/> 삭제</button></div>)}
    {!people.length&&<p className="empty">등록된 담당자가 없습니다.</p>}
   </div>
   <form className="taskPersonAdd" onSubmit={addPerson}>
    <label>이름 추가<input value={newPerson} onChange={e=>setNewPerson(e.target.value)} placeholder="새 담당자 이름"/></label>
    <button className="primary"><Plus size={14}/> 추가</button>
   </form>
  </div></div>}

  {fileTask&&<div className="modalBack"><div className="modal taskFileModal"><div className="taskPeopleHead"><div><h2>{fileTask.title}</h2><p className="taskPeopleHelp">여기서 관련 파일을 여러 개 첨부·다운로드·관리할 수 있습니다.</p></div><button className="iconBtn" onClick={()=>setFileTask(null)}><X size={18}/></button></div><FileAttachmentPanel taskId={fileTask.id} projectId={fileTask.project_id||null}/></div></div>}
 </>
}
