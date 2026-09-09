import { useState } from 'react'
import { PreviewDialog } from './ui'
import { Phone, Navigation } from 'lucide-react'
import { callablePhone, dialPhone, openMapSearch } from './client-actions'
export function PhoneAction({ phone, label = '联系' }: { phone: string; label?: string }) {
  const valid = Boolean(callablePhone(phone))
  return <button type="button" disabled={!valid} title={valid ? `拨打 ${phone}` : '未录入完整有效电话'} onClick={() => dialPhone(phone, () => undefined)}><Phone size={16} />{valid ? label : '暂无有效电话'}</button>
}
export function MapAction({ address, label = '导航' }: { address?: string; label?: string }) {
  const [confirm, setConfirm] = useState(false)
  const valid = Boolean(address?.trim() && address !== '待补充')
  return <><button type="button" disabled={!valid} title={valid ? address : '未录入详细地址'} onClick={() => setConfirm(true)}><Navigation size={16} />{valid ? label : '暂无地址'}</button>
    {confirm ? <PreviewDialog title="打开外部地图" onClose={() => setConfirm(false)}><div className="map-consent"><p>将把以下地址发送至高德地图，需要公网连接：{address}</p><button type="button" onClick={() => { openMapSearch(address!, () => undefined); setConfirm(false) }}>继续打开地图</button><button type="button" onClick={() => setConfirm(false)}>取消</button></div></PreviewDialog> : null}</>
}
