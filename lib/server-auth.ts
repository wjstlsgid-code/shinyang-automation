import { createClient } from '@supabase/supabase-js'

export async function requireInternalUser(req: Request, roles?: string[]) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!token || !url || !publicKey) {
    return { ok: false as const, status: 401, error: '인증 설정이 필요합니다.' }
  }

  // 사용자 JWT로 인증 및 RLS를 그대로 적용한다.
  const userClient = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data, error } = await userClient.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false as const, status: 401, error: '로그인이 필요합니다.' }
  }

  const { data: staff, error: staffError } = await userClient
    .from('staff')
    .select('id,name,role,department,active,email,phone')
    .eq('id', data.user.id)
    .maybeSingle()

  if (staffError) {
    return {
      ok: false as const,
      status: 403,
      error: `직원 권한 확인에 실패했습니다: ${staffError.message}`,
    }
  }
  if (!staff?.active) {
    return { ok: false as const, status: 403, error: '활성 직원 계정이 아닙니다.' }
  }
  if (roles && !roles.includes(staff.role)) {
    return { ok: false as const, status: 403, error: '권한이 없습니다.' }
  }

  // service_role은 관리자용 서버 작업에서만 선택적으로 사용한다.
  const admin = service
    ? createClient(url, service, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null

  return { ok: true as const, user: data.user, staff, userClient, admin }
}
