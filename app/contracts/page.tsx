'use client'
import {FormEvent,useEffect,useRef,useState} from 'react'
import {Download,Mail,Pencil,Plus,Printer} from 'lucide-react'
import {supabase} from '@/lib/supabase'
import {useAuth} from '@/app/components/AuthProvider'
import type {Client,Project,Quote} from '@/lib/types'

type Contract={id:string;contract_no:string;client_id:string;project_id:string|null;quote_id:string|null;title:string;contract_date:string;start_date:string|null;end_date:string|null;service_name:string;service_scope:string;service_location:string|null;supply_amount:number;vat_mode:string;payment_terms:string;payment_account:string|null;special_terms:string|null;customer_representative:string|null;customer_contact_name:string|null;customer_contact_phone:string|null;status:string;version_no:number;sent_at:string|null;created_at:string;created_by?:string|null;client?:any;project?:any;quote?:any;creator?:{name?:string|null;phone?:string|null;email?:string|null;department?:string|null}|null}
const company={name:'신양파트너스(주)',bizNo:'140-81-90037',ceo:'박세훈',address1:'인천광역시 남동구 호구포로 194,',address2:'더마크원 IT동 1302호',manager:'전유경',mobile:'010-5822-0737'}
const defaultScope='폐기물처분시설 또는 재활용시설 설치허가/신고서 작성 및 관련 인허가 업무\n폐기물처분시설 또는 재활용시설 가동개시신고 업무\n화평법 면제확인(한국환경공단 화학물질 등록 등 면제 신청) 업무\n상기 업무 수행에 필요한 관계기관 협의 및 보완 대응'
const defaultSpecial=`1) “을”은 성과품 납품 후에도 하자사항 등 수정이 요구되거나 누락된 사항에 대해서는 수정·보완하여야 한다.
2) 양질의 성과품을 위하여 “갑”은 “을”의 과업진행 상황 및 성과품을 검토할 수 있으며, 수정·보완해야 할 사항이 있으면 “을”은 협의 후 수정·보완하여야 한다.
3) 견적서의 공급가액을 본 계약금액으로 확정한다.
4) 견적서에 기재된 제공 요구사항을 기준으로 하며 추가 요청사항 발생 시 계약금액은 상호 협의하여 변경할 수 있다.`
const initial=()=>({client_id:'',project_id:'',quote_id:'',title:'환경컨설팅 용역계약',contract_date:new Date().toISOString().slice(0,10),start_date:new Date().toISOString().slice(0,10),end_date:'',service_name:'환경컨설팅 용역',service_scope:defaultScope,service_location:'',supply_amount:'0',vat_mode:'별도',payment_terms:'계약금 60% / 잔금 40% (세금계산서 발행 후 15일 이내 현금 지급)',payment_account:'',special_terms:defaultSpecial,customer_representative:'',customer_contact_name:'',customer_contact_phone:'',status:'작성'})
function koDate(v:string|null|undefined){if(!v)return '';const [y,m,d]=v.slice(0,10).split('-');return `${y}년 ${m}월 ${d}일`}

function pctAmount(total:number,pct:number){return Math.round(total*pct)}
function money(v:number){return `₩${Number(v||0).toLocaleString()}원`}
function vatLabel(v:string){return v==='별도'?'VAT 별도':v==='포함'?'VAT 포함':'면세'}

export default function Contracts(){
 const {staff}=useAuth();const can=staff?.role==='ADMIN'||staff?.role==='MANAGER';const paperRef=useRef<HTMLDivElement|null>(null);const contractViewportRef=useRef<HTMLDivElement|null>(null);const [contractScale,setContractScale]=useState(1);const [contractHeight,setContractHeight]=useState(0)
 const [rows,setRows]=useState<Contract[]>([]),[clients,setClients]=useState<Client[]>([]),[projects,setProjects]=useState<Project[]>([]),[quotes,setQuotes]=useState<Quote[]>([])
 const [open,setOpen]=useState(false),[selected,setSelected]=useState<Contract|null>(null),[editingId,setEditingId]=useState<string|null>(null),[busy,setBusy]=useState(false),[pdfBusy,setPdfBusy]=useState(false),[mailBusy,setMailBusy]=useState(false),[err,setErr]=useState('')
 const [form,setForm]=useState(initial())
 async function load(){const [{data:r},{data:c},{data:p},{data:q}]=await Promise.all([supabase.from('service_contract').select('*,client:client_id(name,biz_no,contact_name,email,address,phone),project:project_id(project_name,manager_id),quote:quote_id(quote_no,quote_date,total_amount,payment_terms),creator:created_by(name,phone,email,department)').is('deleted_at',null).order('created_at',{ascending:false}),supabase.from('client').select('*').is('deleted_at',null).order('name'),supabase.from('project').select('*').is('deleted_at',null).order('created_at',{ascending:false}),supabase.from('quote').select('*,client:client_id(name,biz_no,contact_name,email,address,phone)').is('deleted_at',null).order('created_at',{ascending:false})]);setRows((r||[]) as any);setClients((c||[]) as Client[]);setProjects((p||[]) as Project[]);setQuotes((q||[]) as Quote[])}
 useEffect(()=>{void load()},[])
 useEffect(()=>{
  if(!selected)return
  const host=contractViewportRef.current,sheet=paperRef.current
  if(!host||!sheet)return
  const fit=()=>{
   if(window.matchMedia('(max-width:760px)').matches){
    setContractScale(1);setContractHeight(0);return
   }
   const naturalWidth=sheet.offsetWidth||1
   const naturalHeight=sheet.scrollHeight||sheet.offsetHeight||0
   const available=Math.max(0,host.clientWidth)
   const next=Math.min(1,available/naturalWidth)
   const scale=Number.isFinite(next)&&next>0?next:1
   setContractScale(scale);setContractHeight(naturalHeight*scale)
  }
  const ro=new ResizeObserver(fit);ro.observe(host);ro.observe(sheet)
  const raf=requestAnimationFrame(fit)
  return()=>{cancelAnimationFrame(raf);ro.disconnect()}
 },[selected])
 useEffect(()=>{if(typeof window==='undefined'||!quotes.length)return;const qid=new URLSearchParams(window.location.search).get('quote');if(!qid)return;const q=quotes.find(x=>x.id===qid);if(q){void prefillQuote(q);history.replaceState({},'',location.pathname)}},[quotes])
 async function nextNo(date:string){const y=date.slice(0,4);const {data}=await supabase.from('service_contract').select('contract_no').like('contract_no',`${y}-CT-%`).order('contract_no',{ascending:false}).limit(1);const last=(data?.[0]?.contract_no||'').split('-').pop();return `${y}-CT-${String((Number(last)||0)+1).padStart(3,'0')}`}
 async function prefillQuote(q:Quote){const project=projects.find(p=>p.id===q.project_id);const {data:its}=await supabase.from('quote_item').select('item_name,description').eq('quote_id',q.id).order('sort_order');const scope=(its||[]).map((x:any)=>[x.item_name,x.description].filter(Boolean).join(' - ')).filter(Boolean).join('\n')||q.title||defaultScope;setForm(v=>({...v,client_id:q.client_id,project_id:q.project_id||'',quote_id:q.id,title:q.title||'환경컨설팅 용역계약',service_name:q.title||'환경컨설팅 용역',service_scope:scope,service_location:project?.project_name||'',supply_amount:String(q.vat_mode==='별도'?q.supply_amount:q.total_amount),vat_mode:q.vat_mode==='포함'?'포함':'별도',payment_terms:q.payment_terms||v.payment_terms,customer_contact_name:q.client?.contact_name||'',customer_contact_phone:q.client?.phone||''}));setOpen(true)}
 function editContract(c:Contract){
  setEditingId(c.id)
  setForm({client_id:c.client_id,project_id:c.project_id||'',quote_id:c.quote_id||'',title:c.title||'환경컨설팅 용역계약',contract_date:(c.contract_date||'').slice(0,10),start_date:(c.start_date||'').slice(0,10),end_date:(c.end_date||'').slice(0,10),service_name:c.service_name||'',service_scope:c.service_scope||'',service_location:c.service_location||'',supply_amount:String(c.supply_amount||0),vat_mode:c.vat_mode||'별도',payment_terms:c.payment_terms||'',payment_account:c.payment_account||'',special_terms:c.special_terms||'',customer_representative:c.customer_representative||'',customer_contact_name:c.customer_contact_name||'',customer_contact_phone:c.customer_contact_phone||'',status:c.status||'작성'})
  setSelected(null);setErr('');setOpen(true)
 }
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setErr('');try{if(!form.client_id)throw new Error('거래처를 선택해 주세요.');const payload={...form,project_id:form.project_id||null,quote_id:form.quote_id||null,start_date:form.start_date||null,end_date:form.end_date||null,service_location:form.service_location||null,supply_amount:Number(form.supply_amount)||0,payment_account:form.payment_account||null,special_terms:form.special_terms||null};if(editingId){const current=rows.find(x=>x.id===editingId);const {error}=await supabase.from('service_contract').update(payload).eq('id',editingId);if(error)throw error;await supabase.from('activity_log').insert({actor_id:staff?.id,entity_type:'contract',entity_id:editingId,action:'update',summary:`${current?.contract_no||'계약서'} 수정`})}else{const contract_no=await nextNo(form.contract_date);const {data:created,error}=await supabase.from('service_contract').insert({...payload,contract_no,created_by:staff?.id}).select('id').single();if(error)throw error;await supabase.from('activity_log').insert({actor_id:staff?.id,entity_type:'contract',entity_id:created?.id,action:'create',summary:`${contract_no} 계약서 작성`})}setOpen(false);setEditingId(null);setForm(initial());await load()}catch(e:any){setErr(e.message||'저장 실패')}finally{setBusy(false)}}
 async function setStatus(c:Contract,status:string){const patch:any={status};if(status==='발송')patch.sent_at=new Date().toISOString();if(status==='체결')patch.signed_at=new Date().toISOString();const {error}=await supabase.from('service_contract').update(patch).eq('id',c.id);if(error)alert(error.message);else{setSelected(s=>s?{...s,...patch}:s);void load()}}
 async function makePdf(){if(!selected||!paperRef.current)throw new Error('계약서를 먼저 열어 주세요.');const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')]);const root=paperRef.current;const pages=Array.from(root.querySelectorAll<HTMLElement>('.ownContractPage'));if(!pages.length)throw new Error('계약서 페이지를 찾을 수 없습니다.');const prevTransform=root.style.transform;root.classList.add('contractPdfCapture');root.style.transform='none';await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});try{for(let i=0;i<pages.length;i++){const pg=pages[i];const canvas=await html2canvas(pg,{scale:2,useCORS:true,backgroundColor:'#fff',logging:false,windowWidth:pg.scrollWidth,windowHeight:pg.scrollHeight});if(i>0)pdf.addPage('a4','portrait');pdf.addImage(canvas.toDataURL('image/jpeg',0.96),'JPEG',0,0,210,297,undefined,'FAST')}}finally{root.classList.remove('contractPdfCapture');root.style.transform=prevTransform}return pdf}
 async function downloadPdf(){if(pdfBusy)return;setPdfBusy(true);try{const pdf=await makePdf(),safe=(selected?.client?.name||'거래처').replace(/[\\/:*?"<>|]/g,'_');pdf.save(`${selected?.contract_no}_${safe}_용역계약서.pdf`)}catch(e:any){alert(e.message||'PDF 생성 실패')}finally{setPdfBusy(false)}}
 async function sendMail(){if(!selected||mailBusy)return;const to=selected.client?.email;if(!to){alert('거래처 이메일이 등록되어 있지 않습니다.');return}if(!confirm(`${to}로 계약서 PDF를 실제 발송할까요?`))return;setMailBusy(true);try{const pdf=await makePdf(),base64=pdf.output('datauristring').split(',')[1];const {data:{session}}=await supabase.auth.getSession();const r=await fetch('/api/contracts/send',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token||''}`},body:JSON.stringify({contractId:selected.id,pdfBase64:base64})});const d=await r.json();if(!r.ok)throw new Error(d.error||'메일 발송 실패');await setStatus(selected,'발송');alert('계약서를 발송했습니다.')}catch(e:any){alert(e.message||'메일 발송 실패')}finally{setMailBusy(false)}}
 const client=selected?.client
 const managerName=(selected?.creator?.name&&selected.creator.name!=='관리자')?selected.creator.name:((staff?.name&&staff.name!=='관리자')?staff.name:company.manager)
 const managerTitle=(selected?.creator?.department||staff?.department||'').includes('대표')?'대표이사':'팀장'
 const managerPhone=selected?.creator?.phone||staff?.phone||company.mobile
 const contractAmount=Number(selected?.supply_amount||0)
 const downPayment=pctAmount(contractAmount,.6)
 const finalPayment=contractAmount-downPayment
 const quoteNo=selected?.quote?.quote_no||''
 const quoteDate=selected?.quote?.quote_date||''
 const scopeLines=(selected?.service_scope||'').split('\n').map((x:string)=>x.trim()).filter(Boolean)
 return <><div className="pageHead"><div><h1>계약서</h1><p>환경컨설팅 용역계약서를 견적에서 자동 생성하고 PDF·메일 발송까지 관리합니다.</p></div>{can&&<button className="primary" onClick={()=>{setEditingId(null);setForm(initial());setOpen(true)}}><Plus size={15}/> 계약서 작성</button>}</div>
 <div className="tableWrap"><table><thead><tr><th>계약번호</th><th>거래처</th><th>용역명</th><th>계약금액</th><th>상태</th><th>계약일</th></tr></thead><tbody>{rows.map(x=><tr className="clickRow" key={x.id} onClick={()=>setSelected(x)}><td>{x.contract_no}</td><td>{x.client?.name||'-'}</td><td><b>{x.service_name}</b></td><td className="money">{Number(x.supply_amount).toLocaleString()}원</td><td><span className={'badge '+(x.status==='체결'?'ok':x.status==='발송'?'warn':'')}>{x.status}</span></td><td>{x.contract_date}</td></tr>)}{!rows.length&&<tr><td colSpan={6} className="empty">작성된 계약서가 없습니다.</td></tr>}</tbody></table></div>
 {open&&<div className="modalBack"><form className="modal contractEditor" onSubmit={save}><h2>{editingId?'계약서 직접 수정':'용역계약서 작성'}</h2><p className="desktopEditGuide">{editingId?'PC에서 아래 항목을 수정한 뒤 저장하면 계약서/PDF/메일에 바로 반영됩니다.':'계약 내용을 입력해 주세요.'}</p><div className="formGrid"><label>견적 불러오기<select value={form.quote_id} onChange={e=>{const q=quotes.find(x=>x.id===e.target.value);if(q)void prefillQuote(q);else setForm({...form,quote_id:''})}}><option value="">선택 안 함</option>{quotes.map(q=><option key={q.id} value={q.id}>{q.quote_no} · {q.client?.name} · {q.title}</option>)}</select></label><label>거래처<select required value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value,project_id:''})}><option value="">선택</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>프로젝트<select value={form.project_id} onChange={e=>setForm({...form,project_id:e.target.value})}><option value="">선택 안 함</option>{projects.filter(p=>!form.client_id||p.client_id===form.client_id).map(p=><option key={p.id} value={p.id}>{p.project_name}</option>)}</select></label><label>계약일<input type="date" value={form.contract_date} onChange={e=>setForm({...form,contract_date:e.target.value})}/></label><label>계약 시작일<input type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></label><label>계약 종료일<input type="date" value={form.end_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></label><label>갑 대표자<input value={form.customer_representative} onChange={e=>setForm({...form,customer_representative:e.target.value})} placeholder="대표이사 성명"/></label><label>갑 담당자<input value={form.customer_contact_name} onChange={e=>setForm({...form,customer_contact_name:e.target.value})}/></label><label>갑 담당자 연락처<input value={form.customer_contact_phone} onChange={e=>setForm({...form,customer_contact_phone:e.target.value})}/></label><label className="full">용역명<input value={form.service_name} onChange={e=>setForm({...form,service_name:e.target.value})}/></label><label className="full">용역 범위<textarea value={form.service_scope} onChange={e=>setForm({...form,service_scope:e.target.value})}/></label><label className="full">용역 장소<input value={form.service_location} onChange={e=>setForm({...form,service_location:e.target.value})}/></label><label>용역대금<input type="number" min="0" value={form.supply_amount} onChange={e=>setForm({...form,supply_amount:e.target.value})}/></label><label>VAT<select value={form.vat_mode} onChange={e=>setForm({...form,vat_mode:e.target.value})}><option>별도</option><option>포함</option><option>면세</option></select></label><label className="full">지급방법<input value={form.payment_terms} onChange={e=>setForm({...form,payment_terms:e.target.value})}/></label><label className="full">지급계좌<input value={form.payment_account} onChange={e=>setForm({...form,payment_account:e.target.value})} placeholder="은행 / 계좌번호 / 예금주"/></label><label className="full">특약·실무 보완조항<textarea rows={9} value={form.special_terms} onChange={e=>setForm({...form,special_terms:e.target.value})}/></label></div>{err&&<div className="error">{err}</div>}<div className="actions stickyActions"><button type="button" className="secondary" onClick={()=>{setOpen(false);setEditingId(null)}}>취소</button><button className="primary" disabled={busy}>{busy?'저장 중...':editingId?'수정내용 저장':'계약서 저장'}</button></div></form></div>}
 {selected&&<div className="modalBack"><div className="quoteSheet contractSheet"><div className="noPrint toolbar quoteTools"><button className="secondary" onClick={()=>setSelected(null)}>닫기</button>{can&&<button className="secondary desktopDirectEdit" onClick={()=>editContract(selected)}><Pencil size={14}/> 직접 수정</button>}{can&&<select value={selected.status} onChange={e=>void setStatus(selected,e.target.value)}><option>작성</option><option>발송</option><option>회신대기</option><option>체결</option><option>해지</option></select>}<button className="secondary" disabled={pdfBusy} onClick={downloadPdf}><Download size={14}/> {pdfBusy?'PDF 생성 중':'PDF 다운로드'}</button><button className="secondary" disabled={mailBusy} onClick={sendMail}><Mail size={14}/> {mailBusy?'발송 중':'계약서 메일발송'}</button><button className="primary" onClick={()=>window.print()}><Printer size={14}/> 인쇄</button></div>
 <div className="syContractViewport" ref={contractViewportRef} style={{height:contractHeight?`${contractHeight}px`:undefined}}>
 <div className="syContract ownContract" ref={paperRef} style={{transform:`scale(${contractScale})`}}>

  <section className="ownContractPage ownCoverPage">
   <header className="ownHeader">
    <img className="ownLogo" src="/email-signature-logo.jpg" alt="신양파트너스(주)"/>
    <div className="ownTitleWrap">
     <h1>환경컨설팅 용역 계약서</h1>
     <div className="ownContractNo">No. {selected.contract_no}</div>
    </div>
   </header>

   <p className="ownIntro">신양파트너스(주)(이하 “을”)와 {client?.name||'고객사'}(이하 “갑”)는 아래와 같이 환경컨설팅 용역계약을 체결한다.</p>

   <table className="ownPartyTable"><thead><tr><th>갑 (발주자)</th><th>을 (수행자)</th></tr></thead><tbody>
    <tr><td><span className="ownLabel">상호</span><b>{client?.name||'-'}</b></td><td><span className="ownLabel">상호</span><b>{company.name}</b></td></tr>
    <tr><td><span className="ownLabel">사업자등록번호</span>{client?.biz_no||'-'}</td><td><span className="ownLabel">사업자등록번호</span>{company.bizNo}</td></tr>
    <tr><td><span className="ownLabel">대표자</span>{selected.customer_representative||'-'} <span className="ownSeal">(인)</span></td><td><span className="ownLabel">대표이사</span>{company.ceo} <span className="ownSeal">(인)</span></td></tr>
    <tr>
      <td>
        <div className="ownFieldPair">
          <span className="ownLabel">소재지</span>
          <div className="ownAddressValue">{String(client?.address||'-').split('\n').map((line,i)=><span key={i}>{line}</span>)}</div>
        </div>
      </td>
      <td>
        <div className="ownFieldPair">
          <span className="ownLabel">소재지</span>
          <div className="ownAddressValue"><span>{company.address1}</span><span>{company.address2}</span></div>
        </div>
      </td>
    </tr>
    <tr className="ownContactRow">
      <td><span className="ownLabel">담당자</span><span className="ownContactValue"><b>{selected.customer_contact_name||client?.contact_name||'-'}</b><span>{selected.customer_contact_phone||client?.phone||'-'}</span></span></td>
      <td><span className="ownLabel">담당자</span><span className="ownContactValue"><b>{managerTitle} {managerName}</b><span>{managerPhone}</span></span></td>
    </tr>
   </tbody></table>

   <div className="ownSummaryGrid">
    <div><span>용역명</span><b>{selected.service_name}</b></div>
    <div><span>용역장소</span><b>{selected.service_location||`${client?.name||'갑'} 사업장`}</b></div>
    <div><span>계약기간</span><b>{selected.end_date?`${koDate(selected.start_date||selected.contract_date)} ~ ${koDate(selected.end_date)}`:'계약체결일 ~ 완료 시까지'}</b></div>
    <div className={contractAmount<=0?'ownAmountWarning':''}><span>계약금액</span><b>{money(contractAmount)} <small>{vatLabel(selected.vat_mode)}</small></b>{contractAmount<=0&&<em>계약금액을 입력해 주세요</em>}</div>
   </div>

   <section className="ownScopeBox">
    <h2>용역 범위</h2>
    <ol>{scopeLines.map((x:string,i:number)=><li key={i}>{x}</li>)}</ol>
   </section>

   <section className="ownPaymentBox">
    <h2>대금 조건</h2>
    <div className="ownPaymentRow"><span>착수금 60%</span><b>{money(downPayment)}</b></div>
    <div className="ownPaymentRow"><span>잔금 40%</span><b>{money(finalPayment)}</b></div>
    <p>{selected.payment_terms||'계약금 60% / 잔금 40%'}</p>
   </section>

   <div className="ownDateRow"><span>계약일</span><b>{koDate(selected.contract_date)}</b></div>
  </section>

  <section className="ownContractPage ownTermsPage">
   <div className="ownPageHead"><span>SHINYANG PARTNERS</span><b>계약 일반조건</b><em>2 / 3</em></div>
   <section className="ownClause"><h2>제1조 (목적)</h2><p>본 계약은 “을”이 “갑”에게 환경컨설팅 관련 용역을 제공함에 있어 당사자의 권리와 의무를 정함을 목적으로 한다.</p></section>
   <section className="ownClause"><h2>제2조 (용역의 범위)</h2><p>1. 용역명: {selected.service_name}<br/>2. 용역 범위는 본 계약서의 용역 범위 및 관련 견적서에 따른다.<br/>3. 용역 장소는 {selected.service_location||'갑과 을이 협의한 사업장'}으로 한다.</p></section>
   <section className="ownClause"><h2>제3조 (계약기간)</h2><p>계약기간은 {selected.end_date?`${koDate(selected.start_date||selected.contract_date)}부터 ${koDate(selected.end_date)}까지`:'계약체결일부터 용역 완료 시까지'}로 하며, 자료제출·관할기관 협의 및 당사자 협의에 따라 조정할 수 있다.</p></section>
   <section className="ownClause"><h2>제4조 (용역대금 및 지급방법)</h2><p>1. 용역대금은 {money(contractAmount)} ({vatLabel(selected.vat_mode)})으로 한다.<br/>2. 지급방법은 {selected.payment_terms||'착수금 60% / 잔금 40%'}로 한다.<br/>3. 지급계좌는 {selected.payment_account||'을이 지정하여 통지하는 계좌'}로 한다.</p></section>
   <section className="ownClause"><h2>제5조 (갑의 의무)</h2><p>“갑”은 용역 수행에 필요한 자료와 정보를 정확하고 적시에 제공하고, “을”의 정당한 요청 및 관할기관의 보완요청에 협조하여야 한다.</p></section>
   <section className="ownClause"><h2>제6조 (을의 의무)</h2><p>“을”은 관계 법령 및 제반 기준에 따라 선량한 관리자의 주의의무로 용역을 성실히 수행하고 주요 진행사항 및 보완사항을 “갑”에게 안내한다.</p></section>
   <section className="ownClause"><h2>제7조 (비밀유지)</h2><p>당사자는 계약 수행 과정에서 알게 된 상대방의 영업상·기술상 비밀을 계약기간 및 종료 후에도 제3자에게 누설하지 아니한다.</p></section>
   <section className="ownClause"><h2>제8조 (계약의 변경)</h2><p>용역범위, 일정 또는 비용의 변경이 필요한 경우 당사자 간 서면 또는 전자문서 협의로 변경할 수 있다.</p></section>
   <section className="ownClause"><h2>제9조 (계약의 해지)</h2><p>일방이 계약을 중대하게 위반하고 상당한 기간을 정한 시정 요구에도 이를 시정하지 아니하는 경우 상대방은 서면 또는 전자문서 통지로 계약을 해지할 수 있다.</p></section>
   <section className="ownClause"><h2>제10조 (손해배상)</h2><p>당사자의 귀책사유로 상대방에게 직접적인 손해가 발생한 경우 귀책 당사자는 관계 법령 및 본 계약에 따라 그 손해를 배상한다.</p></section>
  </section>

  <section className="ownContractPage ownTermsPage ownTermsLast">
   <div className="ownPageHead"><span>SHINYANG PARTNERS</span><b>계약 일반조건</b><em>3 / 3</em></div>
   <section className="ownClause"><h2>제11조 (추가업무)</h2><p>관할기관의 추가 보완, 최초 계약범위를 초과하는 자료 작성, 별도 조사·측정·분석 등 추가업무가 발생하는 경우 별도 견적 및 협의 후 수행한다.</p></section>
   <section className="ownClause"><h2>제12조 (제3자 비용)</h2><p>측정·분석·검사·공증·외부전문기관·관공서 수수료 등 제3자 비용은 별도 명시가 없는 한 용역대금에 포함되지 않는다.</p></section>
   <section className="ownClause"><h2>제13조 (자료 및 결과물)</h2><p>“갑”이 제공한 자료의 권리는 “갑”에게 있으며, “을”이 작성한 결과물의 사용 범위는 본 용역 목적에 따른다.</p></section>
   <section className="ownClause"><h2>제14조 (전자문서)</h2><p>전자메일, PDF 및 기타 전자문서에 의한 계약·통지·자료전달도 서면과 동일한 효력을 가진다.</p></section>
   <section className="ownClause"><h2>제15조 (관할 및 해석)</h2><p>본 계약에 정하지 아니한 사항은 관계 법령과 상관례에 따르며, 해석상 이견은 상호 협의하여 해결한다.</p></section>
   <section className="ownClause ownSpecial"><h2>특약사항</h2><p className="ctPre">{selected.special_terms||defaultSpecial}</p></section>

   <div className="ownSignature">
    <div><strong>갑</strong><span>{client?.name||'-'}</span><span>대표이사 {selected.customer_representative||'____________'} (인)</span></div>
    <div><strong>을</strong><span>{company.name}</span><span>대표이사 {company.ceo} (인)</span></div>
   </div>
   <div className="ownFooterDate">{koDate(selected.contract_date)}</div>
  </section>

 </div></div></div></div>}
 </>
 }