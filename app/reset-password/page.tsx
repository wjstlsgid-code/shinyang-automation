'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    let alive = true

    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!alive) return
      if (error) {
        setErr(`재설정 세션 확인 실패: ${error.message}`)
        return
      }
      if (data.session?.user) setReady(true)
    }

    void checkSession()

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return
      if (event === 'PASSWORD_RECOVERY' || session?.user) setReady(true)
    })

    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return

    setErr('')
    if (password.length < 8) {
      setErr('새 비밀번호는 8자 이상으로 입력해 주세요.')
      return
    }
    if (password !== confirmPassword) {
      setErr('새 비밀번호와 확인 비밀번호가 서로 다릅니다.')
      return
    }

    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      await supabase.auth.signOut()
      setTimeout(() => router.replace('/login'), 1200)
    } catch (error) {
      setErr(error instanceof Error ? `비밀번호 변경 실패: ${error.message}` : '비밀번호를 변경하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="loginWrap">
      <form className="loginCard" onSubmit={submit}>
        <div className="loginLogo"><Building2 size={26}/></div>
        <h1>새 비밀번호 설정</h1>
        <p>신양파트너스 업무자동화 시스템</p>

        {!isSupabaseConfigured && <div className="error">Supabase 환경변수가 없습니다.</div>}
        {!ready && !err && <div className="successNotice">재설정 링크를 확인하고 있습니다...</div>}
        {err && <div className="error">{err}</div>}
        {done && <div className="successNotice">비밀번호가 변경되었습니다. 로그인 화면으로 이동합니다.</div>}

        {!done && (
          <>
            <label>새 비밀번호<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete="new-password" disabled={!ready || busy}/></label>
            <label>새 비밀번호 확인<input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" disabled={!ready || busy}/></label>
            <button className="primary wide" disabled={!ready || busy || !isSupabaseConfigured}>{busy ? '변경 중...' : '비밀번호 변경'}</button>
            <button className="textButton" type="button" onClick={()=>router.replace('/login')} disabled={busy}>로그인 화면으로 돌아가기</button>
          </>
        )}
      </form>
    </main>
  )
}
