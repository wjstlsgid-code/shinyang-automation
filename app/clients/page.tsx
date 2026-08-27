'use client'
import { FormEvent,useEffect,useState } from 'react'
import { Pencil,Plus,Save,Trash2,Users,X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../components/AuthProvider'
import type { Client,ClientContact } from '@/lib/types'

const empty={name:'',biz_no:'',contact_name:'',phone:'',email:'',address:'',memo:''}
const emptyContact={name:'',position:'',phone:'',email:'',memo:'',is_primary:false}

function formatBizNo(v?:string|null){
 const n=(v||'').replace(/\D/g,'')
 if(n.length===10)return `${n.slice(0,3)}-${n.slice(3,5)}-${n.slice(5)}`
 return v||'-'
}

export default function Clients(){
 const {staff}=useAuth()
 const can=staff?.role==='ADMIN'||staff?.role==='MANAGER'

 const [rows,setRows]=useState<Client[]>([])
 const [open,setOpen]=useState(false)
 const [form,setForm]=useState(empty)
 const [err,setErr]=useState('')

 const [selected,setSelected]=useState<Client|null>(null)
 const [contacts,setContacts]=useState<ClientContact[]>([])
 const [contact,setContact]=useState(emptyContact)

 const [editingBasic,setEditingBasic]=useState(false)
 const [basic,setBasic]=useState(empty)
 const [basicErr,setBasicErr]=useState('')
 const [savingBasic,setSavingBasic]=useState(false)

 async function load(){
  const {data}=await supabase.from('client').select('*').is('deleted_at',null).order('created_at',{ascending:false})
  setRows((data||[]) as Client[])
 }
 useEffect(()=>{load()},[])

 async function save(e:FormEvent){
  e.preventDefault()
  setErr('')
  const payload={...form,biz_no:form.biz_no.replace(/\D/g,'')||null}
  const {error}=await supabase.from('client').insert(payload)
  if(error){
   setErr(error.code==='23505'?'이미 등록된 사업자등록번호입니다.':error.message)
   return
  }
  setForm(empty);setOpen(false);load()
 }

 async function del(id:string){
  if(!confirm('이 거래처를 삭제 처리할까요?'))return
  await supabase.from('client').update({deleted_at:new Date().toISOString()}).eq('id',id)
  load()
 }

 async function openClient(c:Client){
  setSelected(c)
  setEditingBasic(false)
  setBasicErr('')
  setBasic({
   name:c.name||'',
   biz_no:c.biz_no||'',
   contact_name:c.contact_name||'',
   phone:c.phone||'',
   email:c.email||'',
   address:c.address||'',
   memo:c.memo||''
  })
  const {data,error}=await supabase.from('client_contact').select('*').eq('client_id',c.id).is('deleted_at',null).order('is_primary',{ascending:false}).order('created_at')
  if(error&&error.code!=='42P01')console.warn(error)
  setContacts((data||[]) as ClientContact[])
 }

 function startBasicEdit(){
  if(!selected)return
  setBasic({
   name:selected.name||'',
   biz_no:selected.biz_no||'',
   contact_name:selected.contact_name||'',
   phone:selected.phone||'',
   email:selected.email||'',
   address:selected.address||'',
   memo:selected.memo||''
  })
  setBasicErr('')
  setEditingBasic(true)
 }

 async function saveBasic(e:FormEvent){
  e.preventDefault()
  if(!selected)return
  setSavingBasic(true)
  setBasicErr('')
  try{
   const payload={
    name:basic.name.trim(),
    biz_no:basic.biz_no.replace(/\D/g,'')||null,
    contact_name:basic.contact_name.trim()||null,
    phone:basic.phone.trim()||null,
    email:basic.email.trim()||null,
    address:basic.address.trim()||null,
    memo:basic.memo.trim()||null
   }
   if(!payload.name)throw new Error('업체명을 입력해 주세요.')
   const {data,error}=await supabase.from('client').update(payload).eq('id',selected.id).select('*').single()
   if(error)throw error
   const updated=data as Client
   setSelected(updated)
   setRows(prev=>prev.map(x=>x.id===updated.id?updated:x))
   setEditingBasic(false)
  }catch(e:any){
   setBasicErr(e?.code==='23505'?'이미 등록된 사업자등록번호입니다.':(e?.message||'기본정보 수정에 실패했습니다.'))
  }finally{
   setSavingBasic(false)
  }
 }

 async function addContact(e:FormEvent){
  e.preventDefault()
  if(!selected)return
  const {error}=await supabase.from('client_contact').insert({...contact,client_id:selected.id,position:contact.position||null,phone:contact.phone||null,email:contact.email||null,memo:contact.memo||null})
  if(error){
   alert('담당자 저장 실패: DB 업그레이드 SQL을 먼저 실행해 주세요.\n'+error.message)
   return
  }
  setContact(emptyContact)
  openClient(selected)
 }

 async function delContact(id:string){
  if(!confirm('이 담당자를 삭제할까요?'))return
  await supabase.from('client_contact').update({deleted_at:new Date().toISOString()}).eq('id',id)
  if(selected)openClient(selected)
 }

 return <>
  <div className="pageHead">
   <div><h1>거래처</h1><p>고객사 기본정보와 여러 담당자를 함께 관리합니다.</p></div>
   {can&&<button className="primary" onClick={()=>{setForm(empty);setErr('');setOpen(true)}}><Plus size={15}/> 거래처 등록</button>}
  </div>

  <div className="tableWrap"><table>
   <thead><tr><th>업체명</th><th>사업자번호</th><th>대표 담당자</th><th>전화</th><th>이메일</th>{can&&<th/>}</tr></thead>
   <tbody>
    {rows.map(x=><tr key={x.id} className="clickRow" onClick={()=>openClient(x)}>
     <td><b>{x.name}</b></td>
     <td>{formatBizNo(x.biz_no)}</td>
     <td>{x.contact_name||'-'}</td>
     <td>{x.phone||'-'}</td>
     <td>{x.email||'-'}</td>
     {can&&<td onClick={e=>e.stopPropagation()}><button className="dangerBtn" onClick={()=>del(x.id)}><Trash2 size={13}/></button></td>}
    </tr>)}
    {!rows.length&&<tr><td colSpan={6} className="empty">등록된 거래처가 없습니다.</td></tr>}
   </tbody>
  </table></div>

  {open&&<div className="modalBack"><form className="modal" onSubmit={save}>
   <h2>거래처 등록</h2>
   <div className="formGrid">
    <label>업체명<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
    <label>사업자등록번호<input value={form.biz_no} onChange={e=>setForm({...form,biz_no:e.target.value})} placeholder="숫자만 입력해도 됩니다"/></label>
    <label>대표 담당자<input value={form.contact_name} onChange={e=>setForm({...form,contact_name:e.target.value})}/></label>
    <label>전화번호<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
    <label>이메일<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
    <label>주소<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
    <label className="full">메모<textarea value={form.memo} onChange={e=>setForm({...form,memo:e.target.value})}/></label>
   </div>
   {err&&<div className="error">{err}</div>}
   <div className="actions"><button type="button" className="secondary" onClick={()=>setOpen(false)}>취소</button><button className="primary">저장</button></div>
  </form></div>}

  {selected&&<div className="modalBack"><div className="modal clientDetail">
   <div className="clientDetailHead">
    <div>
     <h2>{selected.name}</h2>
     <p><b>{selected.biz_no?formatBizNo(selected.biz_no):'사업자번호 미등록'}</b>{selected.address&&<> · {selected.address}</>}</p>
    </div>
    <div className="clientHeadActions">
     {can&&!editingBasic&&<button className="secondary" onClick={startBasicEdit}><Pencil size={14}/> 기본정보 수정</button>}
     <button className="secondary" onClick={()=>setSelected(null)}>닫기</button>
    </div>
   </div>

   {editingBasic&&can&&<form className="clientBasicEdit" onSubmit={saveBasic}>
    <div className="clientEditTitle"><b>거래처 기본정보 수정</b><button type="button" className="iconBtn" onClick={()=>setEditingBasic(false)} aria-label="수정 닫기"><X size={18}/></button></div>
    <div className="formGrid">
     <label>업체명<input required value={basic.name} onChange={e=>setBasic({...basic,name:e.target.value})}/></label>
     <label>사업자등록번호<input value={basic.biz_no} onChange={e=>setBasic({...basic,biz_no:e.target.value})} placeholder="예: 1408190037"/></label>
     <label>대표 담당자<input value={basic.contact_name} onChange={e=>setBasic({...basic,contact_name:e.target.value})}/></label>
     <label>전화번호<input value={basic.phone} onChange={e=>setBasic({...basic,phone:e.target.value})}/></label>
     <label>이메일<input type="email" value={basic.email} onChange={e=>setBasic({...basic,email:e.target.value})}/></label>
     <label>주소<input value={basic.address} onChange={e=>setBasic({...basic,address:e.target.value})}/></label>
     <label className="full">메모<textarea value={basic.memo} onChange={e=>setBasic({...basic,memo:e.target.value})}/></label>
    </div>
    {basicErr&&<div className="error">{basicErr}</div>}
    <div className="actions">
     <button type="button" className="secondary" onClick={()=>setEditingBasic(false)}>취소</button>
     <button className="primary" disabled={savingBasic}><Save size={14}/>{savingBasic?' 저장 중...':' 수정내용 저장'}</button>
    </div>
   </form>}

   <h3 className="subTitle"><Users size={16}/> 담당자</h3>
   <div className="contactList">
    {contacts.map(c=><div className="contactCard" key={c.id}>
     <div><b>{c.name}</b> {c.position&&<span>{c.position}</span>} {c.is_primary&&<span className="badge ok">대표</span>}<small>{c.phone||'-'} · {c.email||'-'}</small></div>
     {can&&<button className="dangerBtn" onClick={()=>delContact(c.id)}><Trash2 size={13}/></button>}
    </div>)}
    {!contacts.length&&<p className="empty">등록된 추가 담당자가 없습니다.</p>}
   </div>

   {can&&<form onSubmit={addContact} className="contactAdd">
    <b>담당자 추가</b>
    <div className="formGrid">
     <label>이름<input required value={contact.name} onChange={e=>setContact({...contact,name:e.target.value})}/></label>
     <label>직책<input value={contact.position} onChange={e=>setContact({...contact,position:e.target.value})}/></label>
     <label>전화<input value={contact.phone} onChange={e=>setContact({...contact,phone:e.target.value})}/></label>
     <label>이메일<input type="email" value={contact.email} onChange={e=>setContact({...contact,email:e.target.value})}/></label>
     <label className="full checkLabel"><input type="checkbox" checked={contact.is_primary} onChange={e=>setContact({...contact,is_primary:e.target.checked})}/> 대표 담당자</label>
    </div>
    <div className="actions"><button className="primary"><Plus size={14}/> 추가</button></div>
   </form>}
  </div></div>}
 </>
}
