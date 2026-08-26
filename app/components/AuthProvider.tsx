'use client'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Staff } from '@/lib/types'

type Ctx = {
  user: User | null
  staff: Staff | null
  loading: boolean
  configured: boolean
  authError: string | null
  refreshStaff: () => Promise<void>
}

const AuthContext = createContext<Ctx>({
  user: null,
  staff: null,
  loading: true,
  configured: isSupabaseConfigured,
  authError: null,
  refreshStaff: async () => {},
})

const withTimeout = async <T,>(promise: PromiseLike<T>, ms = 12000): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Supabase 응답 시간이 초과되었습니다. 네트워크와 환경변수를 확인해 주세요.')), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [staff, setStaff] = useState<Staff | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  const loadStaff = useCallback(async (id: string) => {

    const result = await withTimeout(
      supabase
        .from('staff')
        .select('id,name,role,department,active,email,phone,permissions')
        .eq('id', id)
        .maybeSingle()
    )

    if (result.error) throw result.error
    setStaff((result.data as Staff) || null)
  }, [])

  useEffect(() => {
    let alive = true

    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    const applySession = async (sessionUser: User | null) => {
      if (!alive) return
      setUser(sessionUser)
      setAuthError(null)

      if (!sessionUser) {
        setStaff(null)
        return
      }

      await loadStaff(sessionUser.id)
    }

    const initialize = async () => {
      setLoading(true)
      try {
        const { data, error } = await withTimeout(supabase.auth.getSession())
        if (error) throw error
        await applySession(data.session?.user || null)
      } catch (error) {
        if (!alive) return
        setUser(null)
        setStaff(null)
        setAuthError(error instanceof Error ? error.message : '로그인 상태를 확인하지 못했습니다.')
      } finally {
        if (alive) setLoading(false)
      }
    }

    void initialize()

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        try {
          await applySession(session?.user || null)
        } catch (error) {
          if (!alive) return
          setStaff(null)
          setAuthError(error instanceof Error ? error.message : '직원 권한 정보를 불러오지 못했습니다.')
        } finally {
          if (alive) setLoading(false)
        }
      })()
    })

    return () => {
      alive = false
      subscription.subscription.unsubscribe()
    }
  }, [loadStaff])

  const refreshStaff = useCallback(async () => {
    setAuthError(null)
    try {
      if (!user?.id) {
        setStaff(null)
        return
      }
      await loadStaff(user.id)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : '직원 권한 정보를 불러오지 못했습니다.')
      throw error
    }
  }, [loadStaff, user?.id])

  return (
    <AuthContext.Provider
      value={{
        user,
        staff,
        loading,
        configured: isSupabaseConfigured,
        authError,
        refreshStaff,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
