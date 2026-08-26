'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/login')
  }, [router])

  return <main className="center">로그인 화면으로 이동 중...</main>
}
