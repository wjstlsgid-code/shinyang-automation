'use client'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useAuth } from '../components/AuthProvider'

export default function Login() {
  const router = useRouter()
  const { user, loading, authError } = useAuth()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [recoveryMode, setRecoveryMode] = useState(false)

  const hasRecoveryMarker = useMemo(() => {
    if (typeof window === 'undefined') return false
    const hash = window.location.hash
    const query = window.location.search
    return /(?:type=|type%3D)recovery/i.test(hash + query)
  }, [])

  useEffect(() => {
    if (hasRecoveryMarker) setRecoveryMode(true)

    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryMode(true)
        router.replace('/reset-password')
      }
    })

    return () => data.subscription.unsubscribe()
  }, [hasRecoveryMarker, router])

  useEffect(() => {
    if (!loading && user && !recoveryMode && !hasRecoveryMarker) router.replace('/dashboard')
  }, [loading, user, recoveryMode, hasRecoveryMarker, router])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return

    setBusy(true)
    setErr('')
    setNotice('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw })
      if (error) throw error
      if (!data.session?.user) throw new Error('로그인 세션을 만들지 못했습니다.')
      router.replace('/dashboard')
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      setErr(`로그인 실패: ${message}`)
    } finally {
      setBusy(false)
    }
  }

  async function requestPasswordReset() {
    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setErr('비밀번호를 재설정할 이메일을 먼저 입력해 주세요.')
      return
    }

    setResetBusy(true)
    setErr('')
    setNotice('')
    try {
      const redirectTo = `${window.location.origin}/reset-password`
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo })
      if (error) throw error
      setNotice('비밀번호 재설정 메일을 보냈습니다. 메일의 링크를 눌러 새 비밀번호를 설정해 주세요.')
    } catch (error) {
      const message = error instanceof Error ? error.message : '비밀번호 재설정 메일을 보내지 못했습니다.'
      setErr(`재설정 요청 실패: ${message}`)
    } finally {
      setResetBusy(false)
    }
  }

  return (
    <main className="loginWrap">
      <form className="loginCard" onSubmit={submit}>
        <div className="loginLogo"><Building2 size={26}/></div>
        <h1>신양파트너스</h1>
        <p>업무자동화 시스템</p>
        {!isSupabaseConfigured && <div className="error">Supabase 환경변수가 없습니다.</div>}
        {authError && <div className="error">연결 확인 오류: {authError}</div>}
        <label>이메일<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="name@company.com" autoComplete="email"/></label>
        <label>비밀번호<input type="password" value={pw} onChange={e=>setPw(e.target.value)} required autoComplete="current-password"/></label>
        {err && <div className="error">{err}</div>}
        {notice && <div className="successNotice">{notice}</div>}
        <button className="primary wide" disabled={busy || !isSupabaseConfigured}>{busy ? '로그인 중...' : '로그인'}</button>
        <button className="textButton" type="button" onClick={requestPasswordReset} disabled={resetBusy || !isSupabaseConfigured}>
          {resetBusy ? '재설정 메일 보내는 중...' : '비밀번호를 잊으셨나요?'}
        </button>
      </form>
    </main>
  )
}
