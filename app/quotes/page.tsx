'use client'
import { FormEvent,useEffect,useMemo,useRef,useState } from 'react'
import { Copy,Download,FileCheck2,Mail,Pencil,Plus,Printer,Send,Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/components/AuthProvider'
import type { Client,Project,Quote,QuoteItem } from '@/lib/types'

type DraftItem={item_name:string;description:string;quantity:string;unit:string;unit_price:string;remark:string}
const emptyItem:DraftItem={item_name:'환경인허가 컨설팅',description:'',quantity:'1',unit:'식',unit_price:'0',remark:''}
const defaultCustomerNote='상기 합계 금액은 부가가치세(VAT)가 포함된 금액입니다.\n본 견적서는 제공된 요구사항을 기준으로 작성되었으며, 추가 요청 사항 발생 시 견적 금액이 변경될 수 있습니다.\n본 견적서는 견적일로부터 1개월간 유효합니다.'
const company={bizNo:'140-81-90037',name:'신양파트너스(주)',ceo:'박세훈',address:'인천광역시 남동구 호구포로 194, 더마크원 IT동 1302호',business:'전문기술서비스 및 제조',category:'환경컨설팅·환경기술개발\n자원순환관련시설컨설팅',manager:'전유경',mobile:'010-5822-0737'}

export default function Quotes(){
 const {staff}=useAuth(); const can=staff?.role==='ADMIN'||staff?.role==='MANAGER'; const quoteRef=useRef<HTMLDivElement|null>(null); const quoteViewportRef=useRef<HTMLDivElement|null>(null); const [quoteScale,setQuoteScale]=useState(1); const [quoteHeight,setQuoteHeight]=useState(0); const [pdfBusy,setPdfBusy]=useState(false),[mailBusy,setMailBusy]=useState(false)
 const [rows,setRows]=useState<Quote[]>([]),[clients,setClients]=useState<Client[]>([]),[projects,setProjects]=useState<Project[]>([])
 const [open,setOpen]=useState(false),[selected,setSelected]=useState<Quote|null>(null),[editingId,setEditingId]=useState<string|null>(null),[busy,setBusy]=useState(false),[err,setErr]=useState('')
 const [items,setItems]=useState<DraftItem[]>([{...emptyItem}])
 const [form,setForm]=useState({client_id:'',project_id:'',title:'환경컨설팅 용역',quote_date:new Date().toISOString().slice(0,10),validity_days:'30',vat_mode:'포함',payment_terms:'착수금 60% / 잔금 40%',status:'작성',discount_amount:'0',customer_note:defaultCustomerNote,internal_note:''})
 async function load(){
  const [{data:q},{data:c},{data:p}]=await Promise.all([
   supabase.from('quote').select('*,client:client_id(name,biz_no,contact_name,email,address,phone),project:project_id(project_name),creator:created_by(name,phone,email,department)').is('deleted_at',null).order('created_at',{ascending:false}),
   supabase.from('client').select('*').is('deleted_at',null).order('name'),
   supabase.from('project').select('*').is('deleted_at',null).order('created_at',{ascending:false})
  ]);setRows((q||[]) as Quote[]);setClients((c||[]) as Client[]);setProjects((p||[]) as Project[])
 }
 useEffect(()=>{load()},[])
 useEffect(()=>{
  if(!selected)return
  const host=quoteViewportRef.current, sheet=quoteRef.current
  if(!host||!sheet)return
  const fit=()=>{
   const naturalWidth=sheet.offsetWidth||1
   const naturalHeight=sheet.scrollHeight||sheet.offsetHeight||0
   const available=Math.max(0,host.clientWidth)
   const next=Math.min(1,available/naturalWidth)
   setQuoteScale(Number.isFinite(next)&&next>0?next:1)
   setQuoteHeight(naturalHeight*(Number.isFinite(next)&&next>0?next:1))
  }
  const ro=new ResizeObserver(fit); ro.observe(host); ro.observe(sheet)
  const raf=requestAnimationFrame(fit)
  return()=>{cancelAnimationFrame(raf);ro.disconnect()}
 },[selected,selected?.items?.length])
 function calcDraft(ds=items){
  const raw=ds.reduce((a,x)=>a+(Number(x.quantity)||0)*(Number(x.unit_price)||0),0);const discount=Math.max(0,Number(form.discount_amount)||0);const after=Math.max(0,raw-discount)
  if(form.vat_mode==='포함'){const supply=Math.round(after/1.1),vat=after-supply;return {raw,discount,supply,vat,total:after}}
  if(form.vat_mode==='면세')return {raw,discount,supply:after,vat:0,total:after}
  const vat=Math.round(after*.1);return {raw,discount,supply:after,vat,total:after+vat}
 }
 const totals=useMemo(()=>calcDraft(items),[items,form.discount_amount,form.vat_mode])
 function editQuote(q:Quote){
  const its=q.items||[]
  setEditingId(q.id)
  setForm({
   client_id:q.client_id||'',
   project_id:q.project_id||'',
   title:q.title||'환경컨설팅 용역',
   quote_date:q.quote_date||new Date(q.created_at).toISOString().slice(0,10),
   validity_days:String(q.validity_days||30),
   vat_mode:q.vat_mode||'포함',
   payment_terms:q.payment_terms||'착수금 60% / 잔금 40%',
   status:q.status||'작성',
   discount_amount:String(q.discount_amount||0),
   customer_note:q.customer_note||q.note||defaultCustomerNote,
   internal_note:q.internal_note||''
  })
  setItems(its.length?its.map(x=>({
   item_name:x.item_name,
   description:x.description||'',
   quantity:String(x.quantity),
   unit:x.unit||'식',
   unit_price:String(x.unit_price),
   remark:x.remark||''
  })):[{...emptyItem}])
  setSelected(null)
  setErr('')
  setOpen(true)
 }
 async function nextQuoteNo(date:string){const ym=date.slice(0,7);const {data}=await supabase.from('quote').select('quote_no').like('quote_no',`${ym}-%`).order('quote_no',{ascending:false}).limit(1);const last=(data?.[0]?.quote_no||'').split('-').pop();return `${ym}-${String((Number(last)||0)+1).padStart(3,'0')}`}
 function reset(){setForm({client_id:'',project_id:'',title:'환경컨설팅 용역',quote_date:new Date().toISOString().slice(0,10),validity_days:'30',vat_mode:'포함',payment_terms:'착수금 60% / 잔금 40%',status:'작성',discount_amount:'0',customer_note:defaultCustomerNote,internal_note:''});setItems([{...emptyItem}]);setErr('')}
 async function save(e:FormEvent){e.preventDefault();setBusy(true);setErr('');try{
  if(!form.client_id)throw new Error('거래처를 선택해 주세요.'); if(items.some(x=>!x.item_name.trim()))throw new Error('품목명을 입력해 주세요.')
  const t=calcDraft(items)
  const quotePayload={client_id:form.client_id,project_id:form.project_id||null,quote_date:form.quote_date,title:form.title,supply_amount:t.supply,vat_amount:t.vat,total_amount:t.total,discount_amount:t.discount,validity_days:Number(form.validity_days)||30,vat_mode:form.vat_mode,payment_terms:form.payment_terms,customer_note:form.customer_note||null,internal_note:form.internal_note||null,note:form.customer_note||null,status:form.status}
  let quoteId=editingId
  let quoteNo=''
  if(editingId){
   const current=rows.find(x=>x.id===editingId)
   quoteNo=current?.quote_no||''
   const {error}=await supabase.from('quote').update(quotePayload).eq('id',editingId);if(error)throw error
   const {error:de}=await supabase.from('quote_item').delete().eq('quote_id',editingId);if(de)throw new Error('기존 견적 품목 정리에 실패했습니다. ('+de.message+')')
  }else{
   quoteNo=await nextQuoteNo(form.quote_date)
   const {data:q,error}=await supabase.from('quote').insert({...quotePayload,quote_no:quoteNo,created_by:staff?.id}).select().single();if(error)throw error
   quoteId=q.id
  }
  const qi=items.map((x,i)=>{const base=(Number(x.quantity)||0)*(Number(x.unit_price)||0);let supply=base,vat=0;if(form.vat_mode==='포함'){supply=Math.round(base/1.1);vat=base-supply}else if(form.vat_mode==='별도')vat=Math.round(base*.1);return {quote_id:quoteId,sort_order:(i+1)*10,item_name:x.item_name,description:x.description||null,quantity:Number(x.quantity)||1,unit:x.unit||'식',unit_price:Number(x.unit_price)||0,supply_amount:supply,vat_amount:vat,remark:x.remark||null}})
  const {error:ie}=await supabase.from('quote_item').insert(qi);if(ie)throw new Error('견적 품목 저장 실패: '+ie.message)
  await supabase.from('activity_log').insert({actor_id:staff?.id,entity_type:'quote',entity_id:quoteId,action:editingId?'update':'create',summary:`${quoteNo||'견적서'} ${editingId?'직접 수정':'견적 작성'}`})
  setOpen(false);setEditingId(null);reset();await load()
 }catch(e:any){setErr(e.message||'저장 실패')}finally{setBusy(false)}}
 async function openQuote(q:Quote){const {data}=await supabase.from('quote_item').select('*').eq('quote_id',q.id).order('sort_order');setSelected({...q,items:(data||[]) as QuoteItem[]})}
 async function setStatus(q:Quote,status:string){const patch:any={status};if(status==='발송')patch.sent_at=new Date().toISOString();if(status==='수주')patch.accepted_at=new Date().toISOString();const {error}=await supabase.from('quote').update(patch).eq('id',q.id);if(error)alert(error.message);else{setSelected(s=>s?{...s,...patch}:s);load()}}
 async function deleteQuote(q:Quote){if(!can)return;const linked=q.converted_project_id?'\n\n※ 이 견적에서 생성된 계약 프로젝트/수금자료는 삭제되지 않습니다.':'';if(!confirm(`${q.quote_no} 견적서를 삭제할까요?${linked}`))return;const now=new Date().toISOString();const {error}=await supabase.from('quote').update({deleted_at:now}).eq('id',q.id);if(error){alert('견적서 삭제 실패: '+error.message);return}await supabase.from('activity_log').insert({actor_id:staff?.id,entity_type:'quote',entity_id:q.id,action:'delete',summary:`${q.quote_no} 견적서 삭제`});setSelected(null);await load()}
 async function clone(q:Quote){const its=q.items||[];setForm({client_id:q.client_id,project_id:q.project_id||'',title:q.title,quote_date:new Date().toISOString().slice(0,10),validity_days:String(q.validity_days||30),vat_mode:q.vat_mode||'포함',payment_terms:q.payment_terms||'착수금 60% / 잔금 40%',status:'작성',discount_amount:String(q.discount_amount||0),customer_note:q.customer_note||q.note||defaultCustomerNote,internal_note:q.internal_note||''});setItems(its.length?its.map(x=>({item_name:x.item_name,description:x.description||'',quantity:String(x.quantity),unit:x.unit,unit_price:String(x.unit_price),remark:x.remark||''})):[{...emptyItem}]);setSelected(null);setOpen(true)}
 function splitTerms(text:string,total:number){if(text.includes('60%')&&text.includes('40%'))return [['계약금',.6],['잔금',.4]] as const;if(text.includes('50%'))return [['계약금',.5],['잔금',.5]] as const;return [['계약금',1]] as const}
 async function makePdf(){
  if(!selected||!quoteRef.current)throw new Error('견적서를 확인할 수 없습니다.')
  const [{default:html2canvas},{jsPDF}]=await Promise.all([import('html2canvas'),import('jspdf')])
  const el=quoteRef.current
  const canvas=await html2canvas(el,{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,windowWidth:el.scrollWidth,windowHeight:el.scrollHeight})
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true})
  const pageW=210,pageH=297,pxPerMm=canvas.width/pageW,pagePx=Math.floor(pageH*pxPerMm)
  // A4 한 장보다 3% 이내로만 넘는 경우 브라우저 렌더링 오차로 보고 1페이지에 맞춘다.
  if(canvas.height<=pagePx*1.03){pdf.addImage(canvas.toDataURL('image/jpeg',0.97),'JPEG',0,0,pageW,pageH,undefined,'FAST');return pdf}
  let y=0,page=0
  while(y<canvas.height){const sliceH=Math.min(pagePx,canvas.height-y);const part=document.createElement('canvas');part.width=canvas.width;part.height=pagePx;const ctx=part.getContext('2d');if(!ctx)throw new Error('PDF 캔버스를 만들지 못했습니다.');ctx.fillStyle='#fff';ctx.fillRect(0,0,part.width,part.height);ctx.drawImage(canvas,0,y,canvas.width,sliceH,0,0,canvas.width,sliceH);if(page>0)pdf.addPage('a4','portrait');pdf.addImage(part.toDataURL('image/jpeg',0.97),'JPEG',0,0,pageW,pageH,undefined,'FAST');y+=sliceH;page++}
  return pdf
 }
 async function downloadPdf(){
  if(!selected||pdfBusy)return;setPdfBusy(true)
  try{const pdf=await makePdf();const safe=(selected.client?.name||'거래처').replace(/[\\/:*?"<>|]/g,'_');pdf.save(`${selected.quote_no}_${safe}_견적서.pdf`)}catch(e:any){alert(e?.message||'PDF 생성에 실패했습니다.')}finally{setPdfBusy(false)}
 }
 async function sendQuoteMail(){
  if(!selected||mailBusy)return;const to=selected.client?.email;if(!to){alert('거래처 이메일이 등록되어 있지 않습니다.');return}if(!confirm(`${to}로 견적서 PDF를 실제 발송할까요?`))return;setMailBusy(true)
  try{const pdf=await makePdf(),pdfBase64=pdf.output('datauristring').split(',')[1];const {data:{session}}=await supabase.auth.getSession();const r=await fetch('/api/quotes/send',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token||''}`},body:JSON.stringify({quoteId:selected.id,pdfBase64})});const d=await r.json();if(!r.ok)throw new Error(d.error||'메일 발송 실패');setSelected(x=>x?{...x,status:'발송',sent_at:new Date().toISOString()}:x);void load();alert('견적서를 발송했습니다.')}catch(e:any){alert(e?.message||'메일 발송 실패')}finally{setMailBusy(false)}
 }
 async function convert(q:Quote){if(q.converted_project_id){alert('이미 프로젝트로 전환된 견적입니다.');return}if(!confirm('이 견적을 계약 프로젝트와 청구 일정으로 전환할까요?'))return;const {data:p,error}=await supabase.from('project').insert({client_id:q.client_id,project_name:q.title,permit_type:'기타',status:'계약',manager_id:staff?.id,contract_amount:q.total_amount}).select().single();if(error){alert(error.message);return}const terms=splitTerms(q.payment_terms||'',Number(q.total_amount));let assigned=0;for(let i=0;i<terms.length;i++){const [name,ratio]=terms[i];const amount=i===terms.length-1?Number(q.total_amount)-assigned:Math.round(Number(q.total_amount)*ratio);assigned+=amount;await supabase.from('billing').insert({project_id:p.id,billing_type:name,amount,tax_invoice_status:'미발행'})}await supabase.from('quote').update({status:'수주',accepted_at:new Date().toISOString(),converted_project_id:p.id}).eq('id',q.id);await supabase.from('activity_log').insert({actor_id:staff?.id,entity_type:'quote',entity_id:q.id,action:'convert',summary:`${q.quote_no} → 계약 프로젝트 전환`});alert('계약 프로젝트와 청구 일정이 생성되었습니다.');setSelected(null);load()}
 const selectedItems=selected?.items||[]
 const quoteManagerName=(selected?.creator?.name&&selected.creator.name!=='관리자')?selected.creator.name:((staff?.name&&staff.name!=='관리자')?staff.name:company.manager)
 const quoteManagerPhone=(selected?.creator?.phone&&selected?.creator?.name!=='관리자')?selected.creator.phone:((staff?.phone&&staff?.name!=='관리자')?staff.phone:company.mobile)
 return <><div className="pageHead"><div><h1>견적서</h1><p>신양파트너스 실제 견적 양식으로 작성·PDF 출력·계약 전환까지 관리합니다.</p></div>{can&&<button className="primary" onClick={()=>{setEditingId(null);reset();setOpen(true)}}><Plus size={15}/> 견적서 작성</button>}</div>
 <div className="tableWrap"><table><thead><tr><th>견적번호</th><th>거래처</th><th>제목</th><th>합계</th><th>상태</th><th>작성일</th></tr></thead><tbody>{rows.map(x=><tr key={x.id} className="clickRow" onClick={()=>openQuote(x)}><td>{x.quote_no}</td><td>{x.client?.name||'-'}</td><td><b>{x.title}</b></td><td className="money"><b>{Number(x.total_amount).toLocaleString()}원</b></td><td><span className={'badge '+(x.status==='수주'?'ok':x.status==='발송'?'warn':'')}>{x.status}</span></td><td>{x.quote_date||new Date(x.created_at).toLocaleDateString('ko-KR')}</td></tr>)}{!rows.length&&<tr><td colSpan={6} className="empty">작성된 견적서가 없습니다.</td></tr>}</tbody></table></div>
 {open&&<div className="modalBack"><form className="modal quoteEditor" onSubmit={save}><h2>{editingId?'견적서 직접 수정':'견적서 작성'}</h2><p className="desktopEditGuide">{editingId?'PC에서 아래 항목을 수정한 뒤 저장하면 견적서/PDF/메일에 바로 반영됩니다.':'견적 내용을 입력해 주세요.'}</p><div className="formGrid"><label>거래처<select required value={form.client_id} onChange={e=>setForm({...form,client_id:e.target.value,project_id:''})}><option value="">선택</option>{clients.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>프로젝트<select value={form.project_id} onChange={e=>setForm({...form,project_id:e.target.value})}><option value="">선택 안 함</option>{projects.filter(x=>!form.client_id||x.client_id===form.client_id).map(x=><option key={x.id} value={x.id}>{x.project_name}</option>)}</select></label><label>견적일<input type="date" value={form.quote_date} onChange={e=>setForm({...form,quote_date:e.target.value})}/></label><label>유효기간<input type="number" min="1" value={form.validity_days} onChange={e=>setForm({...form,validity_days:e.target.value})}/></label><label className="full">견적명<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label></div>
 <div className="quoteItemEditor"><div className="quoteItemHead"><b>품목</b><button type="button" className="secondary smallBtn" onClick={()=>setItems([...items,{...emptyItem,item_name:''}])}><Plus size={13}/> 품목 추가</button></div>{items.map((x,i)=><div className="quoteItemRow" key={i}><input aria-label="품목명" placeholder="품목명" value={x.item_name} onChange={e=>setItems(items.map((v,n)=>n===i?{...v,item_name:e.target.value}:v))}/><input aria-label="내용" placeholder="규격 / 내용" value={x.description} onChange={e=>setItems(items.map((v,n)=>n===i?{...v,description:e.target.value}:v))}/><input aria-label="수량" type="number" min="0.01" step="0.01" value={x.quantity} onChange={e=>setItems(items.map((v,n)=>n===i?{...v,quantity:e.target.value}:v))}/><input aria-label="단위" value={x.unit} onChange={e=>setItems(items.map((v,n)=>n===i?{...v,unit:e.target.value}:v))}/><input aria-label="단가" type="number" min="0" value={x.unit_price} onChange={e=>setItems(items.map((v,n)=>n===i?{...v,unit_price:e.target.value}:v))}/><button type="button" className="dangerBtn" disabled={items.length===1} onClick={()=>setItems(items.filter((_,n)=>n!==i))}><Trash2 size={14}/></button></div>)}</div>
 <div className="formGrid"><label>VAT<select value={form.vat_mode} onChange={e=>setForm({...form,vat_mode:e.target.value})}><option>포함</option><option>별도</option><option>면세</option></select></label><label>할인액<input type="number" min="0" value={form.discount_amount} onChange={e=>setForm({...form,discount_amount:e.target.value})}/></label><label>결제조건<select value={form.payment_terms} onChange={e=>setForm({...form,payment_terms:e.target.value})}><option>착수금 60% / 잔금 40%</option><option>착수금 50% / 잔금 50%</option><option>일시불 100%</option></select></label><label>상태<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>작성</option><option>발송</option><option>보류</option></select></label><label className="full">고객용 유의사항<textarea rows={4} value={form.customer_note} onChange={e=>setForm({...form,customer_note:e.target.value})}/></label><label className="full">내부 메모 (PDF 미표시)<textarea rows={2} value={form.internal_note} onChange={e=>setForm({...form,internal_note:e.target.value})}/></label></div>
 <div className="quoteCalc"><span>공급가액 <b>{totals.supply.toLocaleString()}원</b></span><span>VAT <b>{totals.vat.toLocaleString()}원</b></span><span className="grand">합계 <b>{totals.total.toLocaleString()}원</b></span></div>{err&&<div className="error">{err}</div>}<div className="actions stickyActions"><button type="button" className="secondary" onClick={()=>{setOpen(false);setEditingId(null)}}>취소</button><button className="primary" disabled={busy}>{busy?'저장 중...':editingId?'수정내용 저장':'저장'}</button></div></form></div>}
 {selected&&<div className="modalBack"><div className="quoteSheet"><div className="noPrint toolbar quoteTools"><button className="secondary" onClick={()=>setSelected(null)}>닫기</button>{can&&<button className="secondary desktopDirectEdit" onClick={()=>editQuote(selected)}><Pencil size={14}/> 직접 수정</button>}{can&&<button className="secondary" onClick={()=>clone(selected)}><Copy size={14}/> 복제</button>}{can&&selected.status!=='발송'&&<button className="secondary" onClick={()=>setStatus(selected,'발송')}><Send size={14}/> 발송처리</button>}{can&&<button className="secondary" onClick={()=>convert(selected)}><FileCheck2 size={14}/> 계약 프로젝트 전환</button>}{can&&<button className="secondary" onClick={()=>{location.href=`/contracts?quote=${selected.id}`}}><FileCheck2 size={14}/> 계약서 작성</button>}<button className="secondary" disabled={mailBusy} onClick={sendQuoteMail}><Mail size={14}/> {mailBusy?'발송 중...':'견적서 메일발송'}</button><button className="secondary" disabled={pdfBusy} onClick={downloadPdf}><Download size={14}/> {pdfBusy?'PDF 생성 중...':'PDF 다운로드'}</button>{can&&<button className="dangerBtn" onClick={()=>void deleteQuote(selected)}><Trash2 size={14}/> 삭제</button>}<button className="primary" onClick={()=>window.print()}><Printer size={14}/> 인쇄</button></div>
 <div className="syQuoteViewport" ref={quoteViewportRef} style={{height:quoteHeight?`${quoteHeight}px`:undefined}}>
  <div className="syQuote syQuotePdfTemplate" ref={quoteRef} style={{transform:`scale(${quoteScale})`}}>
   <img className="tplQuoteLogo" src="/email-signature-logo.jpg" alt="신양파트너스(주)"/>
   <div className="tplQuoteTitle">견 적 서</div>
   <div className="tplQuoteNo">No. {selected.quote_no}</div>
<table className="tplQuoteInfoTable"><tbody>
    <tr>
     <td className="tplInput tplDate">{(()=>{const d=new Date(selected.quote_date||selected.created_at);return `${d.getFullYear()}년 ${String(d.getMonth()+1).padStart(2,'0')}월 ${String(d.getDate()).padStart(2,'0')}일`})()}</td>
     <th>사업자<br/>번호</th><td colSpan={3}>{company.bizNo}</td>
    </tr>
    <tr>
     <td className="tplInput tplCustomer">{selected.client?.name} 귀하</td>
     <th>상 호</th><td className="tplCompanyName"><b>{company.name}</b></td><th>대표이사</th><td>{company.ceo} <span className="tplSeal">(인)</span></td>
    </tr>
    <tr>
     <td className="tplReceiverSpacer">&nbsp;</td>
     <th>소재지</th><td colSpan={3}>{company.address}</td>
    </tr>
    <tr>
     <td className="tplReceiverSpacer tplReceiverTall">&nbsp;</td>
     <th>업 태</th><td>{company.business}</td><th>종 목</th><td className="tplCategory">{company.category}</td>
    </tr>
    <tr>
     <td className="tplInput tplReference">참조 : {selected.client?.contact_name||''}</td>
     <th>담당자</th><td>팀장 {company.manager}</td><th>번 호</th><td className="tplPhone">{company.mobile}</td>
    </tr>
    <tr>
     <td className="tplQuoteIntro">아래와 같이 견적합니다.</td><td colSpan={4}></td>
    </tr>
   </tbody></table>

   <div className="tplQuoteTotal">
    <span>합계 금액</span>
    <strong>₩{Number(selected.total_amount).toLocaleString()}원정</strong>
    <em>(VAT {selected.vat_mode==='별도'?'별도':selected.vat_mode==='면세'?'면세':'포함'})</em>
   </div>

   <table className="tplQuoteItems"><thead><tr><th>품 명</th><th>수 량</th><th>단 가</th><th>공급가액</th><th>세 액</th><th>비 고</th></tr></thead><tbody>
    {selectedItems.map((x,i)=><tr key={x.id||i}><td className="tplInput">{x.item_name}</td><td className="tplInput">{Number(x.quantity).toLocaleString()}</td><td className="tplInput">{Number(x.unit_price).toLocaleString()}</td><td>{Number(x.supply_amount).toLocaleString()}</td><td>{Number(x.vat_amount).toLocaleString()}</td><td>{x.remark||''}</td></tr>)}
    {Array.from({length:Math.max(0,8-selectedItems.length)}).map((_,i)=><tr key={'e'+i}><td>&nbsp;</td><td/><td/><td/><td/><td/></tr>)}
   </tbody></table>

   <div className="tplQuoteNotice">
    <h3>유의사항</h3>
    {(selected.customer_note||selected.note||'').split('\n').map(x=>x.trim()).filter(Boolean).map((x,i)=>
     <div className="tplNoticeRow" key={i}>▸ {x.replace(/^[▸▶•·-]\s*/, '')}</div>
    )}
    <div className="tplNoticeRow">▸ 대금조건 : {selected.payment_terms||'협의'}</div>
   </div>
  </div>
 </div>
 </div></div>}</>
}
