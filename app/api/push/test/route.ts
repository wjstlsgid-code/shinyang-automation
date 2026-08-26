import {NextResponse} from 'next/server'
import webpush from 'web-push'
import {requireInternalUser} from '@/lib/server-auth'
export async function POST(req:Request){
 const a=await requireInternalUser(req);if(!a.ok)return NextResponse.json({error:a.error},{status:a.status});if(!a.admin)return NextResponse.json({error:'SUPABASE_SERVICE_ROLE_KEY 설정이 필요합니다.'},{status:503});
 const {data:key}=await a.admin.from('app_secret').select('secret_value').eq('secret_key','webpush_vapid').maybeSingle();const v:any=key?.secret_value;if(!v?.publicKey||!v?.privateKey)return NextResponse.json({error:'먼저 ‘앱 종료 후 푸시’를 등록해 주세요.'},{status:400});
 webpush.setVapidDetails('mailto:admin@sypartners.kr',v.publicKey,v.privateKey);const {data}=await a.admin.from('push_subscription').select('endpoint,p256dh,auth_key').eq('staff_id',a.staff.id);let sent=0,failed=0;
 for(const x of data||[]){try{await webpush.sendNotification({endpoint:x.endpoint,keys:{p256dh:x.p256dh,auth:x.auth_key}},JSON.stringify({title:'신양파트너스 테스트 알림',body:'앱을 닫아도 받을 수 있는 푸시 연결이 정상입니다.',url:'/alerts'}));sent++}catch{failed++}}
 return NextResponse.json({sent,failed})
}
