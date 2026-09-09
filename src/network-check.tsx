import { useState } from 'react'
import { apiBaseUrl } from './api'
import { AppUpdateCheck } from './app-updates'

export async function checkBusinessNetwork(base: string, request: typeof fetch = fetch) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)
  try {
    const response = await request(`${base}/health/ready`, { signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error' })
    if (!response.ok) throw new Error(`业务服务尚未就绪（HTTP ${response.status}），请联系管理员检查服务及依赖。`)
    const body = await response.json()
    if (body.status !== 'ready' || !body.checks?.database?.ready) throw new Error('返回内容不是业务就绪响应，请检查地址、代理或 Wi-Fi 登录页面。')
    return '连接成功：业务 API 和数据库已就绪。此检查不代表账号具有访问权限。'
  } catch (reason) {
    if (reason instanceof Error && /业务服务|返回内容/.test(reason.message)) throw reason
    throw new Error('无法验证连接。请检查公司 Wi-Fi/VPN、服务器地址、防火墙、证书及跨域设置；连接失败不能直接判定为密码错误。')
  } finally { clearTimeout(timer) }
}

export function NetworkCheck() {
  const [busy, setBusy] = useState(false), [result, setResult] = useState('')
  return <section className="network-check"><small>业务地址：{apiBaseUrl()}</small><AppUpdateCheck /><button type="button" disabled={busy} onClick={async () => {
    setBusy(true); setResult('')
    try { setResult(await checkBusinessNetwork(apiBaseUrl())) } catch (reason) { setResult((reason as Error).message) } finally { setBusy(false) }
  }}>{busy ? '检查连接中…' : '检查网络与服务'}</button>{result ? <p role="status">{result}</p> : null}<small>内网 HTTP 仅限可信公司网络；公网必须使用 HTTPS。检查不会发送账号或密码。</small></section>
}
