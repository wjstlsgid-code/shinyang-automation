import {NextResponse} from 'next/server'
import webpush from 'web-push'
import {requireInternalUser} from '@/lib/server-auth'

const KEY_NAME='webpush_vapid'

export async function GET(req:Request){
  const a=await requireInternalUser(req,['ADMIN','MANAGER','STAFF'])
  if(!a.ok)return NextResponse.json({error:a.error},{status:a.status})
  if(!a.admin)return NextResponse.json({error:'SUPABASE_SERVICE_ROLE_KEY 설정이 필요합니다.'},{status:503})
  let {data,error}=await a.admin.from('app_secret').select('secret_value').eq('secret_key',KEY_NAME).maybeSingle()
  if(error)return NextResponse.json({error:error.message},{status:500})
  if(!data?.secret_value){
    const keys=webpush.generateVAPIDKeys()
    const secret={publicKey:keys.publicKey,privateKey:keys.privateKey,createdAt:new Date().toISOString()}
    const saved=await a.admin.from('app_secret').insert({secret_key:KEY_NAME,secret_value:secret})
    if(saved.error)return NextResponse.json({error:saved.error.message},{status:500})
    data={secret_value:secret}
  }
  const value=data.secret_value as any
  return NextResponse.json({publicKey:value.publicKey})
}
