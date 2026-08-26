import tls from 'node:tls'
import crypto from 'node:crypto'

export type MailAttachment={filename:string;content:Buffer|string;contentType?:string}
export type HiworksMail={to:string|string[];subject:string;text:string;html?:string;replyTo?:string;fromName?:string;attachments?:MailAttachment[]}

function b64(v:string|Buffer){return Buffer.isBuffer(v)?v.toString('base64'):Buffer.from(v,'utf8').toString('base64')}
function foldBase64(v:string){return v.match(/.{1,76}/g)?.join('\r\n')||''}
function encodeWord(v:string){return `=?UTF-8?B?${b64(v)}?=`}
function safeAddr(v:string){return v.replace(/[\r\n<>]/g,'').trim()}
function recipients(v:string|string[]){const a=Array.isArray(v)?v:[v];return a.flatMap(x=>x.split(/[;,]/)).map(x=>safeAddr(x)).filter(Boolean)}
function contentTypeFor(name:string){const n=name.toLowerCase();if(n.endsWith('.pdf'))return'application/pdf';if(n.endsWith('.png'))return'image/png';if(n.endsWith('.jpg')||n.endsWith('.jpeg'))return'image/jpeg';if(n.endsWith('.xlsx'))return'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';if(n.endsWith('.docx'))return'application/vnd.openxmlformats-officedocument.wordprocessingml.document';return'application/octet-stream'}

class SmtpReader{
  private buffer='';private lines:string[]=[];private waiter:null|((v:{code:number;text:string})=>void)=null
  constructor(private socket:tls.TLSSocket){socket.on('data',d=>this.feed(d.toString('utf8')))}
  private feed(s:string){this.buffer+=s;let i;while((i=this.buffer.indexOf('\r\n'))>=0){const line=this.buffer.slice(0,i);this.buffer=this.buffer.slice(i+2);this.lines.push(line);if(/^\d{3} /.test(line)&&this.waiter){const code=Number(line.slice(0,3)),text=this.lines.join('\n'),w=this.waiter;this.waiter=null;this.lines=[];w({code,text})}}}
  read(timeoutMs=15000){return new Promise<{code:number;text:string}>((resolve,reject)=>{const t=setTimeout(()=>{this.waiter=null;reject(new Error('SMTP 응답 시간이 초과되었습니다.'))},timeoutMs);this.waiter=v=>{clearTimeout(t);resolve(v)}})}
}

async function cmd(socket:tls.TLSSocket,reader:SmtpReader,command:string|undefined,expect:number|number[]){if(command!==undefined)socket.write(command+'\r\n');const r=await reader.read();const ok=(Array.isArray(expect)?expect:[expect]).includes(r.code);if(!ok)throw new Error(`SMTP ${r.code}: ${r.text}`);return r}

function buildMessage(user:string,mail:HiworksMail,messageId:string){
  const tos=recipients(mail.to),mix=`mix_${crypto.randomUUID().replace(/-/g,'')}`,alt=`alt_${crypto.randomUUID().replace(/-/g,'')}`
  const fromName=mail.fromName||process.env.HIWORKS_MAIL_FROM_NAME||'신양파트너스(주)'
  const headers=[
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${messageId}>`,
    `From: ${encodeWord(fromName)} <${safeAddr(user)}>`,
    `To: ${tos.join(', ')}`,
    ...(mail.replyTo?[`Reply-To: ${safeAddr(mail.replyTo)}`]:[]),
    `Subject: ${encodeWord(mail.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mix}"`
  ]
  const parts:string[]=[]
  parts.push(`--${mix}`)
  parts.push(`Content-Type: multipart/alternative; boundary="${alt}"`,'')
  parts.push(`--${alt}`,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',foldBase64(b64(mail.text)),'')
  if(mail.html)parts.push(`--${alt}`,'Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: base64','',foldBase64(b64(mail.html)),'')
  parts.push(`--${alt}--`,'')
  for(const a of mail.attachments||[]){const buf=Buffer.isBuffer(a.content)?a.content:Buffer.from(a.content,'base64');const encodedName=encodeWord(a.filename);parts.push(`--${mix}`,`Content-Type: ${a.contentType||contentTypeFor(a.filename)}; name="${encodedName}"`,'Content-Transfer-Encoding: base64',`Content-Disposition: attachment; filename="${encodedName}"; filename*=UTF-8''${encodeURIComponent(a.filename)}`,'',foldBase64(buf.toString('base64')),'')}
  parts.push(`--${mix}--`,'')
  return headers.join('\r\n')+'\r\n\r\n'+parts.join('\r\n')
}

export async function sendHiworksMail(mail:HiworksMail){
  const host=process.env.HIWORKS_SMTP_HOST||'smtps.hiworks.com'
  const port=Number(process.env.HIWORKS_SMTP_PORT||465)
  const user=process.env.HIWORKS_SMTP_USER||''
  const password=process.env.HIWORKS_SMTP_PASSWORD||''
  if(!user||!password)throw new Error('HIWORKS_SMTP_USER와 HIWORKS_SMTP_PASSWORD 설정이 필요합니다.')
  const tos=recipients(mail.to);if(!tos.length)throw new Error('받는 이메일이 없습니다.')
  const socket=tls.connect({host,port,servername:host,rejectUnauthorized:true})
  const reader=new SmtpReader(socket)
  await new Promise<void>((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('SMTP 연결 시간이 초과되었습니다.')),15000);socket.once('secureConnect',()=>{clearTimeout(t);resolve()});socket.once('error',e=>{clearTimeout(t);reject(e)})})
  try{
    await cmd(socket,reader,undefined,220)
    await cmd(socket,reader,'EHLO sypartners.kr',250)
    await cmd(socket,reader,'AUTH LOGIN',334)
    await cmd(socket,reader,b64(user),334)
    await cmd(socket,reader,b64(password),235)
    await cmd(socket,reader,`MAIL FROM:<${safeAddr(user)}>`,250)
    for(const to of tos)await cmd(socket,reader,`RCPT TO:<${to}>`,[250,251])
    await cmd(socket,reader,'DATA',354)
    const messageId=`${Date.now()}.${crypto.randomBytes(8).toString('hex')}@sypartners.kr`
    const raw=buildMessage(user,mail,messageId).replace(/(^|\r\n)\./g,'$1..')
    socket.write(raw+'\r\n.\r\n')
    const accepted=await reader.read(30000);if(accepted.code!==250)throw new Error(`SMTP ${accepted.code}: ${accepted.text}`)
    socket.write('QUIT\r\n')
    return {id:messageId,provider:'hiworks-smtp'}
  }finally{socket.end()}
}
