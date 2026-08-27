'use client'
import {ChangeEvent,useEffect,useMemo,useState} from 'react'
import {Download,Paperclip,Trash2} from 'lucide-react'
import {supabase} from '@/lib/supabase'
import {useAuth} from './AuthProvider'
import type {ProjectFile} from '@/lib/types'

const MAX=50*1024*1024
function sizeText(n?:number|null){if(!n)return '-';if(n>=1024**3)return `${(n/1024**3).toFixed(2)} GB`;if(n>=1024**2)return `${(n/1024**2).toFixed(1)} MB`;return `${Math.ceil(n/1024)} KB`}
function safeName(name:string){return name.replace(/[^a-zA-Z0-9._가-힣-]/g,'_')}

export default function FileAttachmentPanel({projectId=null,taskId=null,compact=false}:{projectId?:string|null,taskId?:string|null,compact?:boolean}){
 const {staff}=useAuth(); const manager=staff?.role==='ADMIN'||staff?.role==='MANAGER'
 const [files,setFiles]=useState<ProjectFile[]>([]);const [uploading,setUploading]=useState(false);const [msg,setMsg]=useState('')
 async function load(){let q=supabase.from('project_file').select('*,uploader:uploaded_by(name)').is('deleted_at',null).order('created_at',{ascending:false});q=taskId?q.eq('task_id',taskId):q.eq('project_id',projectId);const {data,error}=await q;if(error){setMsg(error.message);return}setFiles((data||[]) as ProjectFile[])}
 useEffect(()=>{if(projectId||taskId)void load()},[projectId,taskId])
 async function upload(e:ChangeEvent<HTMLInputElement>){const selected=[...(e.target.files||[])];e.target.value='';if(!selected.length||!staff)return;const tooBig=selected.find(f=>f.size>MAX);if(tooBig){alert(`${tooBig.name} 파일이 50MB를 초과합니다.`);return}setUploading(true);setMsg('');for(let i=0;i<selected.length;i++){const file=selected[i];const scope=taskId?`tasks/${taskId}`:`projects/${projectId}`;const path=`${scope}/${Date.now()}-${i}-${safeName(file.name)}`;const up=await supabase.storage.from('project-files').upload(path,file,{contentType:file.type||undefined,upsert:false});if(up.error){setMsg(`${file.name}: ${up.error.message}`);continue}const ins=await supabase.from('project_file').insert({project_id:projectId||null,task_id:taskId||null,file_name:file.name,logical_name:file.name,storage_path:path,content_type:file.type||null,size_bytes:file.size,uploaded_by:staff.id});if(ins.error){await supabase.storage.from('project-files').remove([path]);setMsg(`${file.name}: ${ins.error.message}`)}}setUploading(false);await load()}
 async function download(x:ProjectFile){const {data,error}=await supabase.storage.from('project-files').createSignedUrl(x.storage_path,120);if(error)alert(error.message);else window.open(data.signedUrl,'_blank')}
 async function trash(x:ProjectFile){if(!staff||!manager)return;if(!confirm(`${x.file_name} 파일을 휴지통으로 이동할까요?\n30일 안에는 복구할 수 있습니다.`))return;const now=new Date(),purge=new Date(now.getTime()+30*24*60*60*1000);const {error}=await supabase.from('project_file').update({deleted_at:now.toISOString(),deleted_by:staff.id,purge_after:purge.toISOString()}).eq('id',x.id);if(error)alert(error.message);else load()}
 return <div className={compact?'filePanel compactFilePanel':'filePanel'}>
  <div className="filePanelHead"><div><b>첨부파일</b>{!compact&&<small> 여러 파일 동시 첨부 · 파일당 최대 50MB</small>}</div>{staff?.role!=='VIEWER'&&<label className="secondary uploadBtn"><Paperclip size={14}/>{uploading?'업로드 중...':'파일 첨부'}<input type="file" multiple hidden disabled={uploading} onChange={upload}/></label>}</div>
  {msg&&<div className="error">{msg}</div>}
  <div className="filePanelList">{files.map(x=><div className="fileRow" key={x.id}><div><b>{x.file_name}{x.version_no&&<span className="badge">v{x.version_no}{x.is_latest?' · 최신':''}</span>}</b><small>{x.uploader?.name||'-'} · {sizeText(x.size_bytes)}</small></div><div className="toolbar"><button className="secondary iconBtn" type="button" onClick={()=>download(x)}><Download size={14}/></button>{manager&&<button className="dangerBtn iconBtn" type="button" onClick={()=>trash(x)} title="휴지통"><Trash2 size={14}/></button>}</div></div>)}{!files.length&&<div className="empty">첨부파일이 없습니다.</div>}</div>
 </div>
}
