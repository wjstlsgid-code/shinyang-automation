import {NextResponse} from 'next/server'
import {requireInternalUser} from '@/lib/server-auth'

const tableDefs=[
 {name:'staff',key:'id'},{name:'client',key:'id'},{name:'client_contact',key:'id'},{name:'permit_checklist_template',key:'id'},
 {name:'project',key:'id'},{name:'project_checklist',key:'id'},{name:'task',key:'id'},{name:'quote',key:'id'},{name:'quote_item',key:'id'},{name:'service_contract',key:'id'},
 {name:'billing',key:'id'},{name:'payment',key:'id'},{name:'project_file',key:'id'},{name:'approval_request',key:'id'},
 {name:'alert_preference',key:'staff_id'},{name:'email_send_log',key:'id'},{name:'activity_log',key:'id'}
] as const

export async function POST(req:Request){
 const a=await requireInternalUser(req,['ADMIN']);if(!a.ok)return NextResponse.json({error:a.error},{status:a.status});if(!a.admin)return NextResponse.json({error:'SUPABASE_SERVICE_ROLE_KEY 설정이 필요합니다.'},{status:500})
 const snapshot:Record<string,unknown[]>={};let count=0
 for(const {name} of tableDefs){const {data,error}=await a.admin.from(name).select('*');if(error)return NextResponse.json({error:`${name}: ${error.message}`},{status:500});snapshot[name]=data||[];count+=(data||[]).length}
 const label=`수동 업무백업 ${new Date().toLocaleString('ko-KR')}`;const {data,error}=await a.admin.from('app_backup').insert({label,row_count:count,data:snapshot,created_by:a.staff.id}).select('id').single();if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({id:data.id,row_count:count})
}
export async function GET(req:Request){
 const a=await requireInternalUser(req,['ADMIN']);if(!a.ok)return NextResponse.json({error:a.error},{status:a.status});if(!a.admin)return NextResponse.json({error:'관리자 서버키가 필요합니다.'},{status:500});const id=new URL(req.url).searchParams.get('id');if(!id)return NextResponse.json({error:'id 필요'},{status:400});const {data,error}=await a.admin.from('app_backup').select('label,data,created_at').eq('id',id).single();if(error)return NextResponse.json({error:error.message},{status:404});return new NextResponse(JSON.stringify(data,null,2),{headers:{'content-type':'application/json; charset=utf-8','content-disposition':`attachment; filename="shinyang-backup-${id}.json"`}})
}
export async function PUT(req:Request){
 const a=await requireInternalUser(req,['ADMIN']);if(!a.ok)return NextResponse.json({error:a.error},{status:a.status});if(!a.admin)return NextResponse.json({error:'관리자 서버키가 필요합니다.'},{status:500});const {id}=await req.json();const {data,error}=await a.admin.from('app_backup').select('data').eq('id',id).single();if(error||!data)return NextResponse.json({error:error?.message||'백업 없음'},{status:404});const snap=data.data as Record<string,any[]>
 for(const {name,key} of tableDefs){const rs=snap?.[name]||[];if(!rs.length)continue;const {error:e}=await a.admin.from(name).upsert(rs,{onConflict:key});if(e)return NextResponse.json({error:`${name} 복원 실패: ${e.message}`},{status:500})}
 return NextResponse.json({ok:true})
}
