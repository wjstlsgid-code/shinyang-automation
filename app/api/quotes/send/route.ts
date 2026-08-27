import { NextResponse } from 'next/server'
import { requireInternalUser } from '@/lib/server-auth'
import { sendHiworksMail } from '@/lib/hiworks-smtp'
import {
  buildMailBodyHtml,
  buildSignatureText,
  getDisplayEmail,
} from '@/lib/mail-signature'

export const runtime = 'nodejs'

function roleLabel(role: string, department?: string | null) {
  if (department) return department
  return role === 'ADMIN'
    ? '관리자'
    : role === 'MANAGER'
      ? '팀장'
      : role === 'STAFF'
        ? '프로'
        : ''
}

export async function POST(req: Request) {
  const auth = await requireInternalUser(req, [
    'ADMIN',
    'MANAGER',
    'STAFF',
  ])

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    )
  }

  const { quoteId, pdfBase64 } = await req.json()

  if (!quoteId || !pdfBase64) {
    return NextResponse.json(
      { error: '견적서 정보 또는 PDF가 없습니다.' },
      { status: 400 }
    )
  }

  const { data: q, error } = await auth.userClient
    .from('quote')
    .select(
      '*,client:client_id(name,email),project:project_id(id,manager_id)'
    )
    .eq('id', quoteId)
    .maybeSingle()

  if (error || !q) {
    return NextResponse.json(
      { error: '견적서를 확인할 수 없습니다.' },
      { status: 404 }
    )
  }

  if (
    auth.staff.role === 'STAFF' &&
    q.project?.manager_id &&
    q.project.manager_id !== auth.user.id
  ) {
    return NextResponse.json(
      { error: '본인 담당 프로젝트 견적서만 발송할 수 있습니다.' },
      { status: 403 }
    )
  }

  const to = q.client?.email

  if (!to) {
    return NextResponse.json(
      { error: '거래처 이메일이 등록되어 있지 않습니다.' },
      { status: 400 }
    )
  }

  const senderProfile: any = auth.staff
  const displayEmail = getDisplayEmail()
  const origin = new URL(req.url).origin

  const senderLine = roleLabel(
    auth.staff.role,
    auth.staff.department
  )

  const senderMobile =
    senderProfile?.mobile ||
    senderProfile?.phone ||
    ''

  const quoteMailTitle = String(q.title || '견적')
    .replace(/\s*견적서\s*$/, '')
    .trim()

  const subject =
    `[신양파트너스] ${quoteMailTitle} 견적서 송부`

  const text =
`${q.client?.name || ''} 담당자님, 안녕하세요.
신양파트너스입니다.

요청하신 「${quoteMailTitle}」 관련 견적서를 송부드립니다.
첨부 견적서의 업무범위, 금액 및 조건을 확인 부탁드립니다.

감사합니다.`

  const html = buildMailBodyHtml(
    text,
    origin,
    senderLine,
    senderMobile
  )

  const signatureText = buildSignatureText(
    senderLine,
    senderMobile
  )

  const filename =
    `${q.quote_no}_${String(q.client?.name || '거래처')
      .replace(/[\\/:*?"<>|]/g, '_')}_견적서.pdf`

  try {
    const sent = await sendHiworksMail({
      to,
      subject,
      text: `${text}${signatureText}`,
      html,
      replyTo: displayEmail,
      fromName: senderLine
        ? `${senderLine} | 신양파트너스(주)`
        : '신양파트너스(주)',
      attachments: [
        {
          filename,
          content: pdfBase64,
          contentType: 'application/pdf',
        },
      ],
    })

    await auth.userClient
      .from('quote')
      .update({
        status: '발송',
        sent_at: new Date().toISOString(),
      })
      .eq('id', quoteId)

    await auth.userClient
      .from('email_send_log')
      .insert({
        actor_id: auth.user.id,
        project_id: q.project_id || null,
        client_id: q.client_id,
        to_email: to,
        subject,
        document_type: '견적서 발송 메일',
        attachment_count: 1,
        provider_message_id: sent.id,
        status: '발송완료',
      })

    await auth.userClient
      .from('activity_log')
      .insert({
        actor_id: auth.user.id,
        entity_type: 'quote',
        entity_id: q.id,
        action: 'EMAIL_SENT',
        summary: `${q.quote_no} 견적서 발송 · ${to}`,
      })

    return NextResponse.json({
      ok: true,
      id: sent.id,
      provider: sent.provider,
    })
  } catch (e: any) {
    return NextResponse.json(
      {
        error:
          e?.message ||
          '하이웍스 SMTP 메일 발송 실패',
      },
      { status: 502 }
    )
  }
}