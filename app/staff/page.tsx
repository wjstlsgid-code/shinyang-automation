'use client'
import { FormEvent,useEffect,useMemo,useState } from 'react'
import { Plus,Power,Settings2,UserRoundPlus,UsersRound } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/components/AuthProvider'
import { roleDefaultPermissions } from '@/lib/types'
import type { Role,Staff,StaffPermissionKey,StaffPermissions } from '@/lib/types'

const emptyForm={email:'',name:'',role:'STAFF' as Role,department:'환경컨설팅',phone:'',password:''}
const representative={email:'zeushoon@sypartners.kr',name:'박세훈',role:'ADMIN' as Role,department:'대표이사',phone:'010-4527-1854',password:''}
const employeePresets=[
 {email:'ljw@sypartners.kr',name:'임지원',role:'STAFF' as Role,department:'프로',phone:'010-6771-1422',password:''},
 {email:'imyu@sypartners.kr',name:'임유진',role:'STAFF' as Role,department:'프로',phone:'',password:''},
 {email:'yjl0121@sypartners.kr',name:'이유진',role:'STAFF' as Role,department:'프로',phone:'',password:''},
 {email:'juni9431@sypartners.kr',name:'김주현',role:'STAFF' as Role,department:'프로',phone:'',password:''},
]
const permissionOptions:{key:StaffPermissionKey;label:string;help:string}[]=[
 {key:'clients',label:'거래처',help:'거래처 기본정보와 담당자 조회'},
 {key:'projects',label:'프로젝트',help:'프로젝트/인허가 업무 조회'},
 {key:'tasks',label:'업무·체크리스트',help:'업무 확인 및 완료처리'},
 {key:'quotes',label:'견적서',help:'견적 조회 (작성·수정은 ADMIN/MANAGER)'},
 {key:'finance',label:'계약·수금',help:'계약금액·수금·세금계산서'},
 {key:'documents',label:'문서·메일',help:'문서 자동작성 및 메일 발송'},
 {key:'files',label:'파일',help:'프로젝트 파일 조회·업로드'},
 {key:'all_projects',label:'전체 프로젝트',help:'본인 담당이 아닌 프로젝트까지 조회'},
 {key:'staff_admin',label:'직원관리',help:'직원 목록/권한 관리 화면 접근'},
 {key:'approvals',label:'전자결재',help:'승인 요청 및 결재현황 조회'},
 {key:'audit',label:'감사로그',help:'전체 변경이력 조회'},
 {key:'backup',label:'백업·복원',help:'업무데이터 백업과 복원'},
]

export default function StaffPage(){
 const {staff:me}=useAuth(); const admin=me?.role==='ADMIN';
 const [rows,setRows]=useState<Staff[]>([]); const [open,setOpen]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [form,setForm]=useState(emptyForm); const [presetOpen,setPresetOpen]=useState(false)
 const [permStaff,setPermStaff]=useState<Staff|null>(null); const [permDraft,setPermDraft]=useState<StaffPermissions>({})
 useEffect(()=>{void load()},[])
 async function load(){const {data}=await supabase.from('staff').select('id,name,role,department,active,email,phone,permissions,created_at').order('name');setRows((data||[]) as Staff[])}
 async function update(id:string,patch:any){const {error}=await supabase.from('staff').update(patch).eq('id',id);if(error){alert(error.message);return}void load()}
 async function invite(e:FormEvent){e.preventDefault();setBusy(true);setError('');const {data:{session}}=await supabase.auth.getSession();const r=await fetch('/api/staff/invite',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token||''}`},body:JSON.stringify(form)});const d=await r.json();setBusy(false);if(!r.ok){setError(d.error||'계정 추가 실패');return}setOpen(false);setForm(emptyForm);void load();alert(form.password?'직원 계정을 생성했습니다.':'초대메일을 발송했습니다.')}
 function quickRepresentative(){setForm(representative);setOpen(true);setPresetOpen(false);setError('')}
 function quickEmployee(p:typeof employeePresets[number]){setForm({...p});setOpen(true);setPresetOpen(false);setError('')}
 function openPermissions(x:Staff){setPermStaff(x);setPermDraft({...roleDefaultPermissions(x.role),...(x.permissions||{})})}
 async function savePermissions(){if(!permStaff)return;setBusy(true);const {error}=await supabase.from('staff').update({permissions:permDraft}).eq('id',permStaff.id);setBusy(false);if(error){alert(error.message);return}setPermStaff(null);void load()}
 const permTitle=useMemo(()=>permStaff?`${permStaff.name} 세부 권한`:'' ,[permStaff])
 return <><div className="pageHead"><div><h1>직원 관리</h1><p>직원 계정, 역할, 세부 접근권한을 ADMIN이 언제든 수정할 수 있습니다.</p></div>{admin&&<div className="toolbar"><button className="secondary" onClick={quickRepresentative}><UserRoundPlus size={15}/> 대표이사 빠른 추가</button><div style={{position:'relative'}}><button type="button" className="secondary" onClick={()=>setPresetOpen(v=>!v)}><UsersRound size={15}/> 직원 빠른 추가</button>{presetOpen&&<div className="presetMenu">{employeePresets.map(p=><button type="button" key={p.email} onClick={()=>quickEmployee(p)}><b>{p.name}</b><span>{p.department} · {p.email}</span></button>)}</div>}</div><button className="primary" onClick={()=>{setForm(emptyForm);setPresetOpen(false);setOpen(true)}}><Plus size={15}/> 직원 초대</button></div>}</div>
 <div className="tableWrap staffDesktopTable"><table><thead><tr><th>이름</th><th>이메일</th><th>부서/직책</th><th>역할</th><th>세부권한</th><th>연락처</th><th>상태</th></tr></thead><tbody>{rows.map(x=><tr key={x.id}><td><b>{x.name}</b>{x.id===me?.id&&' (나)'}</td><td>{x.email||'-'}</td><td>{admin?<input className="compactInput" defaultValue={x.department||''} onBlur={e=>update(x.id,{department:e.target.value||null})}/>:x.department||'-'}</td><td>{admin?<select className="staffRoleSelect" value={x.role} onChange={e=>{const role=e.target.value as Role;void update(x.id,{role,permissions:roleDefaultPermissions(role)})}}>{['ADMIN','MANAGER','STAFF','VIEWER'].map(v=><option key={v}>{v}</option>)}</select>:x.role}</td><td>{admin?<button className="secondary compactBtn" onClick={()=>openPermissions(x)}><Settings2 size={14}/> 수정</button>:<span className="badge">기본</span>}</td><td>{admin||x.id===me?.id?<input className="compactInput" defaultValue={x.phone||''} placeholder="연락처" onBlur={e=>update(x.id,{phone:e.target.value||null})}/>:x.phone||'-'}</td><td><button className={x.active?'badge ok':'badge danger'} disabled={!admin||x.id===me?.id} onClick={()=>update(x.id,{active:!x.active})}><Power size={12}/> {x.active?'사용중':'중지'}</button></td></tr>)}{!rows.length&&<tr><td colSpan={7} className="empty">등록된 직원이 없습니다.</td></tr>}</tbody></table></div>
 <div className="staffMobileList">{rows.map(x=><section className="staffMobileCard" key={x.id}><div className="staffMobileHead"><div><b>{x.name}</b>{x.id===me?.id&&<span className="meTag">나</span>}<small>{x.email||'-'}</small></div><button className={x.active?'badge ok':'badge danger'} disabled={!admin||x.id===me?.id} onClick={()=>update(x.id,{active:!x.active})}><Power size={12}/> {x.active?'사용중':'중지'}</button></div><div className="staffMobileGrid"><label><span>부서/직책</span>{admin?<input defaultValue={x.department||''} onBlur={e=>update(x.id,{department:e.target.value||null})}/>:<b>{x.department||'-'}</b>}</label><label><span>역할</span>{admin?<select className="staffRoleSelect" value={x.role} onChange={e=>{const role=e.target.value as Role;void update(x.id,{role,permissions:roleDefaultPermissions(role)})}}>{['ADMIN','MANAGER','STAFF','VIEWER'].map(v=><option key={v}>{v}</option>)}</select>:<b>{x.role}</b>}</label><label><span>연락처</span>{admin||x.id===me?.id?<input defaultValue={x.phone||''} placeholder="연락처" onBlur={e=>update(x.id,{phone:e.target.value||null})}/>:<b>{x.phone||'-'}</b>}</label><label><span>세부권한</span>{admin?<button className="secondary staffPermissionBtn" onClick={()=>openPermissions(x)}><Settings2 size={14}/> 권한 수정</button>:<span className="badge">기본</span>}</label></div></section>)}{!rows.length&&<div className="empty staffMobileEmpty">등록된 직원이 없습니다.</div>}</div>
 {open&&<div className="modalBack"><form className="modal" onSubmit={invite}><h2>{form.email===representative.email?'대표이사 계정 추가':employeePresets.some(p=>p.email===form.email)?`${form.name} 프로 계정 추가`:'직원 초대'}</h2><div className="formGrid"><label>이름<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>이메일<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>부서/직책<input value={form.department} onChange={e=>setForm({...form,department:e.target.value})}/></label><label>연락처<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label><label className="full">권한<select value={form.role} onChange={e=>setForm({...form,role:e.target.value as Role})}>{['ADMIN','MANAGER','STAFF','VIEWER'].map(v=><option key={v}>{v}</option>)}</select></label><label className="full">초기 비밀번호 (선택)<input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="입력하면 초대메일 없이 바로 계정을 생성합니다." autoComplete="new-password"/></label></div><p className="hint">초기 비밀번호를 비워두면 초대메일을 발송합니다. 입력하면 이메일 인증 완료 상태의 계정을 바로 생성합니다.</p>{error&&<p className="error">{error}</p>}<div className="actions"><button type="button" className="secondary" onClick={()=>setOpen(false)}>취소</button><button className="primary" disabled={busy}>{busy?'처리 중...':form.password?'계정 생성':'초대메일 보내기'}</button></div></form></div>}
 {permStaff&&<div className="modalBack"><div className="modal"><h2>{permTitle}</h2><p className="hint">역할의 기본권한을 기준으로 직원별 예외를 직접 켜고 끌 수 있습니다. ADMIN은 안전을 위해 전체 권한을 유지합니다.</p><div className="permissionGrid">{permissionOptions.map(p=><label className="permissionRow" key={p.key}><div><b>{p.label}</b><span>{p.help}</span></div><input type="checkbox" disabled={permStaff.role==='ADMIN'} checked={permStaff.role==='ADMIN'||!!permDraft[p.key]} onChange={e=>setPermDraft({...permDraft,[p.key]:e.target.checked})}/></label>)}</div><div className="actions"><button className="secondary" onClick={()=>setPermDraft(roleDefaultPermissions(permStaff.role))}>역할 기본값</button><button className="secondary" onClick={()=>setPermStaff(null)}>취소</button><button className="primary" disabled={busy||permStaff.role==='ADMIN'} onClick={savePermissions}>권한 저장</button></div></div></div>}
 </>
}
