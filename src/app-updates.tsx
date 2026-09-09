import { useState } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
const updater = registerPlugin<{ check(): Promise<void> }>('AppUpdates')
export function AppUpdateCheck() {
  const [message, setMessage] = useState('')
  if (!Capacitor.isNativePlatform()) return null
  return <div><button type="button" onClick={async () => {
    try {
      if (!Capacitor.isPluginAvailable('AppUpdates')) throw new Error('当前旧 APK 不支持手动检查，请使用公司下载页覆盖升级')
      await updater.check(); setMessage('已发起原生更新检查')
    } catch (reason) { setMessage((reason as Error).message) }
  }}>检查 APP 更新</button>{message ? <p role="status">{message}</p> : null}</div>
}
