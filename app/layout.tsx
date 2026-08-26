import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from './components/AuthProvider'
import AppShell from './components/AppShell'

export const metadata: Metadata = {
  title: '신양파트너스',
  description: '신양파트너스 환경컨설팅 업무 통합 관리',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: '신양파트너스',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#0f4f8a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body>
        <AuthProvider><AppShell>{children}</AppShell></AuthProvider>
      </body>
    </html>
  )
}
