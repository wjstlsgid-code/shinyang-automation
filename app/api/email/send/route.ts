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
        ? '담당자'
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

  const {
    to,
    subject,
    text,
    projectId = null,
    documentType = '일반 메일',
    attachmentIds = [],
  } = await req.json()

  if (!to || !subject || !text) {
    return NextResponse.json(
      { error: '받는 사람, 제목, 본문은 필수입니다.' },
      { status: 400 }
    )
  }

  let project: any = null

  if (projectId) {
    const { data: p, error: pError } = await auth.userClient
      .from('project')
      .select('id,client_id,manager_id')
      .eq('id', projectId)
      .maybeSingle()

    if (pError || !p) {
      return NextResponse.json(
        { error: '프로젝트를 확인할 수 없습니다.' },
        { status: 400 }
      )
    }

    if (
      auth.staff.role === 'STAFF' &&
      p.manager_id !== auth.user.id
    ) {
      return NextResponse.json(
        { error: '본인 담당 프로젝트만 메일 발송할 수 있습니다.' },
        { status: 403 }
      )
    }

    project = p
  }

  const attachments: any[] = []

  if (Array.isArray(attachmentIds) && attachmentIds.length) {
    if (!projectId) {
      return NextResponse.json(
        { error: '첨부파일 발송에는 프로젝트 선택이 필요합니다.' },
        { status: 400 }
      )
    }

    const { data: meta, error: mError } = await auth.userClient
      .from('project_file')
      .select(
        'id,project_id,file_name,storage_path,size_bytes'
      )
      .in('id', attachmentIds)
      .eq('project_id', projectId)

    if (mError) {
      return NextResponse.json(
        { error: mError.message },
        { status: 400 }
      )
    }

    const total = (meta || []).reduce(
      (a: any, x: any) =>
        a + Number(x.size_bytes || 0),
      0
    )

    if (total > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          error:
            '첨부파일 총 용량은 10MB 이하로 선택해 주세요.',
        },
        { status: 400 }
      )
    }

    for (const f of meta || []) {
      const { data: blob, error: dError } =
        await auth.userClient.storage
          .from('project-files')
          .download(f.storage_path)

      if (dError || !blob) {
        return NextResponse.json(
          {
            error:
              `첨부파일을 읽지 못했습니다: ${f.file_name}`,
          },
          { status: 400 }
        )
      }

      const b = Buffer.from(await blob.arrayBuffer())

      attachments.push({
        filename: f.file_name,
        content: b,
      })
    }
  }

  const senderProfile: any = auth.staff

  const senderLine = roleLabel(
    auth.staff.role,
    auth.staff.department
  )

  const senderMobile =
    senderProfile?.mobile ||
    senderProfile?.phone ||
    ''

  const displayEmail = getDisplayEmail()
  const origin = new URL(req.url).origin

  const fullText =
    `${text}${buildSignatureText(
      senderLine,
      senderMobile
    )}`

  const htmlBody = buildMailBodyHtml(
    text,
    origin,
    senderLine,
    senderMobile
  )

  try {
    const sent = await sendHiworksMail({
      to,
      subject,
      text: fullText,
      html: htmlBody,
      replyTo: displayEmail,
      fromName: senderLine
        ? `${senderLine} | 신양파트너스(주)`
        : '신양파트너스(주)',
      attachments,
    })

    await auth.userClient
      .from('email_send_log')
      .insert({
        actor_id: auth.user.id,
        project_id: projectId || null,
        client_id: project?.client_id || null,
        to_email: to,
        subject,
        document_type: documentType,
        attachment_count: attachments.length,
        provider_message_id: sent.id,
        status: '발송완료',
      })

    await auth.userClient
      .from('activity_log')
      .insert({
        actor_id: auth.user.id,
        entity_type: 'project',
        entity_id: projectId || null,
        action: 'EMAIL_SENT',
        summary:
          `${documentType} · ${to} · ${subject}`,
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