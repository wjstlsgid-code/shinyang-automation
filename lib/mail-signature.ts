function esc(v:string){
  return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]||c))
}

const companyKo='신양파트너스(주)'
const companyEn='ShinYang Partners. co., LTD'
const displayEmail='hoonrud1@sypartners.kr'
const signatureName='팀장 전유경'
const officeTel='070-8822-1854'
const fax='032-232-7362'
const website='https://sypartners.kr'

const businessLines=[
  '폐기물처리업인허가 / 환경인허가 / 자원순환관련시설 컨설팅 / 폐기물 재활용시설 제조 / 폐배터리 재활용시설 제조'
]

const noticeKo='상기 메시지와 첨부파일은 지정된 수신자만 이용 가능하며, 내용 중에는 부정경쟁방지 및 영업비밀의 보호에 관한 법률 등으로 보호대상인 영업비밀 및 기밀정보를 담고 있을 수 있습니다. 본 메일이 잘못 전송된 경우에는 즉시 송신자에게 반송해 알려 주시고, 원본 메시지와 모든 사본을 폐기해 주시기 바랍니다. 본 메일의 전부 또는 일부를 제3자 공개, 배포 및 복사 등으로 사용하는 것은 엄격히 금지됩니다. 신양파트너스(주)'

const noticeEn='The above message and any attachments to it is intended solely for the named addressee and may contain business secrets or other confidential information protected under laws pertaining to the prevention of unfair competition and the protection of business secrets. If this mail has been transmitted to you by error, please inform the sender immediately and delete the original message as well as a of copy. The unauthorized disclosure to a third party, reproduction or use of information contained in this mail either in part or in whole, is strictly prohibited. ShinYang Partners Co., Ltd.'

export function getDisplayEmail(){
  return displayEmail
}

export function buildSignatureText(senderLine:string,senderMobile?:string){
  return [
    '',
    '',
    companyKo,
    companyEn,
    ...businessLines,
    '',
    signatureName,
    `Email: ${displayEmail}`,
    `Mobile: ${senderMobile||'-'}`,
    `Office: ${officeTel}`,
    `Fax: ${fax}`,
    `Web: ${website}`,
    '',
    noticeKo,
    '',
    noticeEn,
  ].join('\n')
}

export function buildMailBodyHtml(bodyText:string,origin:string,senderLine:string,senderMobile?:string){
  const logoUrl=`${origin}/email-signature-logo.jpg`
  const businessHtml=businessLines.map(line=>`<div style="margin:0 0 6px 0;">${esc(line)}</div>`).join('')
  return `
  <div style="font-family:Arial,'Noto Sans KR','Apple SD Gothic Neo',sans-serif;color:#333;line-height:1.7;font-size:14px;max-width:680px;">
    <div style="white-space:pre-wrap;">${esc(bodyText)}</div>
    <div style="margin-top:26px;padding-top:16px;border-top:3px solid #1d5f85;max-width:680px;">
      <div>
        <img src="${esc(logoUrl)}" alt="${esc(companyKo)}" width="210" style="display:block;width:210px;max-width:60%;height:auto;border:0;outline:none;text-decoration:none;" />
      </div>

      <div style="margin-top:12px;color:#666;font-size:12.5px;line-height:1.75;">
        <div style="margin-bottom:10px;color:#666;">${esc(companyEn)}</div>
        ${businessHtml}
      </div>

      <div style="border-top:1px solid #d9dde2;margin:16px 0 14px;"></div>

      <div style="font-size:13px;line-height:1.72;color:#444;">
        <div style="font-size:13px;font-weight:600;color:#555;margin-bottom:8px;">${esc(signatureName)}</div>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;font-size:13px;color:#555;">
          <tr><td style="padding:1px 18px 1px 0;color:#777;vertical-align:top;">Email:</td><td style="padding:1px 0;"><a href="mailto:${esc(displayEmail)}" style="color:#0645ad;text-decoration:underline;">${esc(displayEmail)}</a></td></tr>
          <tr><td style="padding:1px 18px 1px 0;color:#777;vertical-align:top;">Mobile:</td><td style="padding:1px 0;">${esc(senderMobile||'-')}</td></tr>
          <tr><td style="padding:1px 18px 1px 0;color:#777;vertical-align:top;">Office:</td><td style="padding:1px 0;">${esc(officeTel)}</td></tr>
          <tr><td style="padding:1px 18px 1px 0;color:#777;vertical-align:top;">Fax:</td><td style="padding:1px 0;">${esc(fax)}</td></tr>
          <tr><td style="padding:1px 18px 1px 0;color:#777;vertical-align:top;">Web:</td><td style="padding:1px 0;"><a href="${esc(website)}" style="color:#1d5f85;text-decoration:underline;">${esc(website)}</a></td></tr>
        </table>
      </div>

      <div style="border-top:1px solid #d9dde2;margin:16px 0 12px;"></div>

      <div style="font-size:11px;line-height:1.7;color:#444;">
        <div style="margin-bottom:10px;">${esc(noticeKo)}</div>
        <div>${esc(noticeEn)}</div>
      </div>
    </div>
  </div>`
}
