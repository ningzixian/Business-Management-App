import { Capacitor, registerPlugin } from '@capacitor/core'
export const fileTypes: Record<string, string> = {
  jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',heic:'image/heic',heif:'image/heif',
  mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',wav:'audio/wav',ogg:'audio/ogg',webm:'audio/webm','3gp':'audio/3gpp',
  pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',txt:'text/plain',csv:'text/csv',
}
export const fileAccept = Object.keys(fileTypes).map(ext => '.' + ext).join(',')
export function checkedFile(file: File, maxBytes: number) {
  if (!file.size) throw new Error('不能上传空文件')
  if (file.size > maxBytes) throw new Error(`文件超过 ${Math.floor(maxBytes / 1024 / 1024)} MB 限制`)
  const mime = fileTypes[file.name.split('.').at(-1)?.toLowerCase() || '']
  if (!mime) throw new Error('不支持该格式，请选择图片、Office/PDF 文档、文本或录音文件')
  return new File([file], file.name, { type: mime })
}
const NativeFiles = registerPlugin<{ save(options: {name: string; mime: string; base64: string; checksum: string}): Promise<{cancelled?: boolean}> }>('AttachmentFiles')
export async function saveAttachment(blob: Blob, name: string, checksum: string) {
  if (Capacitor.isNativePlatform()) {
    if (!Capacitor.isPluginAvailable('AttachmentFiles')) throw new Error('当前 APP 版本暂不支持附件保存，请升级安装包或使用手机浏览器下载')
    const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob) })
    const result = await NativeFiles.save({ name, mime: blob.type, base64, checksum })
    return result.cancelled ? '已取消保存' : '附件已保存到所选位置'
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name
  document.body.appendChild(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
  return '已交给浏览器下载，请查看下载列表'
}
