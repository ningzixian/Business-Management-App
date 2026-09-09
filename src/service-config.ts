export function serviceConfig(value: string, mobile = false) {
  if (value === '/api/v1' && !mobile) return { apiBase: value, origin: '' }
  let url: URL
  try { url = new URL(value) } catch { throw new Error('手机 API 地址必须是完整 URL，例如 https://商务域名/api/v1') }
  const ip = url.hostname.split('.').map(Number)
  const privateHost = url.hostname === 'localhost' || url.hostname === '[::1]' ||
    (ip.length === 4 && ip.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
      (ip[0] === 10 || ip[0] === 127 || (ip[0] === 192 && ip[1] === 168) || (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31)))
  if (url.username || url.password || url.search || url.hash || !/^\/api\/v1\/?$/.test(url.pathname)) throw new Error('API 地址不能包含账号、密码、查询参数或非 /api/v1 路径')
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && privateHost)) throw new Error('公网必须使用 HTTPS；HTTP 仅允许公司私有 IPv4 地址或本机测试地址')
  return { apiBase: `${url.origin}/api/v1`, origin: url.origin }
}
