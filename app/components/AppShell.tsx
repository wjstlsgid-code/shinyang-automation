'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Building2, LayoutDashboard, Users, FolderKanban, CheckSquare, WalletCards, LogOut, ClipboardCheck, Bell, Bot, FileText, UserCog, ReceiptText, FileSignature, Menu, X, Stamp, ShieldCheck, DatabaseBackup, HardDrive } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from './AuthProvider'
import { supabase } from '@/lib/supabase'
import { hasPermission } from '@/lib/types'
import type { StaffPermissionKey } from '@/lib/types'

const items:[string,string,any,StaffPermissionKey|null][]=[
 ['/dashboard','대시보드',LayoutDashboard,null],['/clients','거래처',Users,'clients'],['/projects','인허가 프로젝트',FolderKanban,'projects'],['/checklists','인허가 체크리스트',ClipboardCheck,'tasks'],['/tasks','업무',CheckSquare,'tasks'],['/files','자료실',HardDrive,'files'],['/finance','계약·수금',WalletCards,'finance'],['/quotes','견적서',ReceiptText,'quotes'],['/contracts','계약서',FileSignature,'quotes'],['/alerts','알림센터',Bell,null],['/documents','문서자동작성',FileText,'documents'],['/assistant','AI 업무비서',Bot,'documents'],['/approvals','전자결재',Stamp,'approvals'],['/audit','감사로그',ShieldCheck,'audit'],['/backup','백업·복원',DatabaseBackup,'backup'],['/staff','직원관리',UserCog,'staff_admin']
]

export default function AppShell({children}:{children:React.ReactNode}){
 const path=usePathname(); const router=useRouter(); const {user,staff,loading,configured,authError}=useAuth(); const [open,setOpen]=useState(false); const [alertCount,setAlertCount]=useState(0)
 const isPublicAuthPage=path==='/login'||path==='/reset-password'||path.startsWith('/portal/')
 const visibleItems=staff?items.filter(([, , ,permission])=>!permission||hasPermission(staff,permission)):[]
 useEffect(()=>{if(!isPublicAuthPage&&configured&&!loading&&!user) router.replace('/login')},[isPublicAuthPage,configured,loading,user,router])
 useEffect(()=>{if(!staff)return;void refreshAlertCount();const id=setInterval(()=>void refreshAlertCount(),60000);return()=>clearInterval(id)},[staff?.id,staff?.role])
 async function refreshAlertCount(){if(!staff)return;const today=new Date();const limit=new Date();limit.setDate(today.getDate()+7);const end=limit.toISOString().slice(0,10);let tq=supabase.from('task').select('id',{count:'exact',head:true}).is('deleted_at',null).neq('status','완료').lte('due_date',end);let pq=supabase.from('project').select('id',{count:'exact',head:true}).is('deleted_at',null).eq('status','보완');if(staff.role==='STAFF'){tq=tq.eq('assignee_id',staff.id);pq=pq.eq('manager_id',staff.id)}const [t,p]=await Promise.all([tq,pq]);let count=(t.count||0)+(p.count||0);if(staff.role!=='STAFF'){const [r,b]=await Promise.all([supabase.from('v_receivables').select('*',{count:'exact',head:true}).gt('receivable',0),supabase.from('billing').select('id',{count:'exact',head:true}).is('deleted_at',null).eq('tax_invoice_status','미발행')]);count+=(r.count||0)+(b.count||0)}setAlertCount(count)}
 if(isPublicAuthPage) return <>{children}</>
 if(!configured) return <main className="center"><div className="notice"><b>Supabase 연결이 필요합니다.</b><p>env.local 또는 .env.local 파일에 URL과 ANON KEY를 입력한 뒤 다시 실행하세요.</p></div></main>
 if(loading) return <main className="center">로그인 확인 중...</main>
 if(!user) return <main className="center">로그인 화면으로 이동 중...</main>
 if(authError) return <main className="center"><div className="notice"><b>직원 권한 정보를 불러오지 못했습니다.</b><p>{authError}</p><button className="primary" onClick={()=>location.reload()}>다시 시도</button></div></main>
 if(!staff) return <main className="center"><div className="notice"><b>직원 권한 등록이 필요합니다.</b><p>현재 로그인 계정과 연결된 활성 staff 정보가 없습니다.</p></div></main>
 const current=items.find(([href])=>path===href||path.startsWith(href+'/')); if(current?.[3]&&!hasPermission(staff,current[3])) return <div className="app"><main className="center"><div className="notice"><b>접근 권한이 없습니다.</b><p>관리자가 이 메뉴의 권한을 켜면 바로 사용할 수 있습니다.</p><button className="primary" onClick={()=>router.replace('/dashboard')}>대시보드로</button></div></main></div>
 const logout=async()=>{await supabase.auth.signOut();router.replace('/login')}
 return <div className="app">
   <header className="mobileHeader"><button className="iconOnly" onClick={()=>setOpen(true)} aria-label="메뉴 열기"><Menu size={22}/></button><div className="mobileBrand"><Building2 size={19}/><b>SHINYANG</b></div><Link className="mobileAlertButton" href="/alerts" aria-label={`알림 ${alertCount}건`}><Bell size={20}/>{alertCount>0&&<span>{alertCount>99?'99+':alertCount}</span>}</Link><button className="iconOnly" onClick={logout} aria-label="로그아웃"><LogOut size={20}/></button></header>
   {open&&<button className="drawerBackdrop" aria-label="메뉴 닫기" onClick={()=>setOpen(false)}/>} 
   <aside className={'sidebar '+(open?'open':'')}>
    <div className="brand"><Building2 size={22}/><div><strong>SHINYANG</strong><small>업무자동화 v5.12.7</small></div><button className="drawerClose" onClick={()=>setOpen(false)} aria-label="메뉴 닫기"><X size={20}/></button></div>
    <nav>{visibleItems.map(([href,label,Icon])=><Link key={href} href={href} onClick={()=>setOpen(false)} className={path===href||path.startsWith(href+'/')?'active':''}><span className="navIconWrap"><Icon size={18}/>{href==='/alerts'&&alertCount>0&&<i className="navBadge">{alertCount>99?'99+':alertCount}</i>}</span><span>{label}</span></Link>)}</nav>
    <div className="profile"><div><b>{staff.name}</b><small>{staff.department||'-'} · {staff.role}</small></div><button onClick={logout} title="로그아웃"><LogOut size={18}/></button></div>
   </aside>
   <main className="content">{children}</main>
   <nav className="mobileBottomNav" aria-label="모바일 주요 메뉴">{visibleItems.slice(0,5).map(([href,label,Icon])=><Link key={href} href={href} className={path===href||path.startsWith(href+'/')?'active':''}><Icon size={19}/><span>{label.replace('인허가 ','')}</span></Link>)}</nav>
 </div>
}
