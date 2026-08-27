import { NextResponse } from 'next/server'
import { requireInternalUser } from '@/lib/server-auth'

export async function POST(req:Request){
  const auth=await requireInternalUser(req,['ADMIN'])
  if(!auth.ok) return NextResponse.json({error:auth.error},{status:auth.status})
  if(!auth.admin) return NextResponse.json({error:'직원 초대/생성 기능에는 SUPABASE_SERVICE_ROLE_KEY 설정이 필요합니다.'},{status:503})
  const body=await req.json()
  const {email,name,role='STAFF',department='',phone='',password='',permissions=null,signature_title='',signature_email='',signature_enabled=true}=body
  if(!email||!name) return NextResponse.json({error:'이메일과 이름은 필수입니다.'},{status:400})
  let userId:string|undefined
  if(password){
    if(String(password).length<8) return NextResponse.json({error:'초기 비밀번호는 8자 이상이어야 합니다.'},{status:400})
    const {data,error}=await auth.admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{name}})
    if(error){
      // 이미 Auth 사용자가 있으면 해당 계정의 staff 정보만 연결할 수 있도록 찾는다.
      if(!/already|registered|exists/i.test(error.message)) return NextResponse.json({error:error.message},{status:400})
      const {data:list,error:listError}=await auth.admin.auth.admin.listUsers({page:1,perPage:1000})
      if(listError) return NextResponse.json({error:listError.message},{status:400})
      userId=list.users.find(u=>u.email?.toLowerCase()===String(email).toLowerCase())?.id
      if(!userId) return NextResponse.json({error:'기존 Auth 계정을 찾지 못했습니다.'},{status:400})
    }else userId=data.user?.id
  }else{
    const origin=req.headers.get('origin') || undefined
    const {data,error}=await auth.admin.auth.admin.inviteUserByEmail(email,{redirectTo:origin?`${origin}/login`:undefined,data:{name}})
    if(error) return NextResponse.json({error:error.message},{status:400})
    userId=data.user?.id
  }
  if(!userId) return NextResponse.json({error:'계정을 만들지 못했습니다.'},{status:500})
  const {error:upsertError}=await auth.admin.from('staff').upsert({id:userId,name,role,department:department||null,email,phone:phone||null,active:true,permissions,signature_title:signature_title||department||null,signature_email:signature_email||email,signature_enabled,deleted_at:null})
  if(upsertError) return NextResponse.json({error:upsertError.message},{status:400})
  return NextResponse.json({ok:true,id:userId,mode:password?'created':'invited'})
}
