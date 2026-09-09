export const attachmentTypes = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
  'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/3gpp',
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
])
export function cleanAttachmentName(name: string) {
  // Multipart headers may be decoded as Latin-1 by Multer. Only repair a valid UTF-8 round trip.
  if (/^[\u0000-\u00ff]*$/.test(name)) {
    const decoded = Buffer.from(name, 'latin1').toString('utf8')
    if (!decoded.includes('\ufffd') && Buffer.from(decoded, 'utf8').equals(Buffer.from(name, 'latin1'))) name = decoded
  }
  return name.split(/[\\/]/).at(-1)!.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_').slice(0, 240).trim() || '附件'
}
