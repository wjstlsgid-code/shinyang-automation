import { NextResponse } from 'next/server'
import { requireInternalUser } from '@/lib/server-auth'

export async function POST(req:Request){
  const auth=await requireInternalUser(req,['ADMIN','MANAGER','STAFF','VIEWER'])
  if(!auth.ok) return NextResponse.json({error:auth.error},{status:auth.status})
  const key=process.env.ANTHROPIC_API_KEY
  if(!key) return NextResponse.json({error:'ANTHROPIC_API_KEY가 설정되지 않았습니다.'},{status:503})
  const {prompt,context}=await req.json()
  if(!prompt) return NextResponse.json({error:'질문을 입력해 주세요.'},{status:400})
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:process.env.ANTHROPIC_MODEL||'claude-opus-5',max_tokens:1200,system:'당신은 신양파트너스 환경컨설팅 사내 업무비서입니다. 제공된 내부 데이터만 사실로 단정하고, 데이터에 없으면 없다고 말합니다. 답변은 한국어로 짧고 실무적으로 작성합니다.',messages:[{role:'user',content:`[회사 DB 요약]\n${JSON.stringify(context).slice(0,50000)}\n\n[질문]\n${prompt}`} ]})})
  const data=await r.json().catch(()=>({}))
  if(!r.ok) return NextResponse.json({error:data?.error?.message||'Claude API 호출 실패'},{status:r.status})
  const text=(data.content||[]).filter((x:any)=>x.type==='text').map((x:any)=>x.text).join('\n')
  return NextResponse.json({ok:true,text})
}
