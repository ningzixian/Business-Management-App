import { useState, type FormEvent } from 'react'
import { ArrowRight, Building2, CheckCircle2, ClipboardList, LockKeyhole, ShieldCheck, UserPlus, UserRound } from 'lucide-react'
import { apiBaseUrl } from './api'

export function LoginPage({
  onLogin,
  onRegister,
}: {
  onLogin: (username: string, password: string) => Promise<void>
  onRegister: (username: string, displayName: string, password: string) => Promise<void>
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('admin')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      if (mode === 'register') {
        if (password !== passwordConfirmation) throw new Error('两次输入的密码不一致')
        await onRegister(username.trim(), displayName.trim(), password)
      } else {
        await onLogin(username.trim(), password)
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="login-brand-panel">
        <div className="login-brand"><span><ClipboardList size={26} /></span><p><strong>商务活动管理</strong><small>Business Activity Management</small></p></div>
        <div className="login-promise">
          <span>v0.2.0 · 双库协作基础版</span>
          <h1>让组织、人脉与每一项商务行动形成完整闭环。</h1>
          <p>统一记录时间、地点、人员、事项与完成结果，同时保留可追溯的历史关系快照。</p>
        </div>
        <div className="login-feature-grid">
          <article><Building2 /><span><strong>甲方组织库</strong><small>企业与部门层级独立维护</small></span></article>
          <article><UserRound /><span><strong>人脉库</strong><small>一人多职与关系历史</small></span></article>
          <article><ShieldCheck /><span><strong>权限与审计</strong><small>部门数据全程可追溯</small></span></article>
        </div>
      </section>
      <section className="login-form-panel">
        <form className="login-card" onSubmit={submit}>
          <header><span className="mobile-login-logo"><ClipboardList size={23} /></span><p><small>部门小管家</small><strong>欢迎回来</strong></p></header>
          <div className="auth-mode-tabs" aria-label="账号入口">
            <button className={mode === 'login' ? 'is-active' : ''} type="button" onClick={() => { setMode('login'); setError('') }}>登录</button>
            <button className={mode === 'register' ? 'is-active' : ''} type="button" onClick={() => { setMode('register'); setUsername(''); setPassword(''); setError('') }}>注册账号</button>
          </div>
          <div className="login-copy"><h2>{mode === 'login' ? '登录部门工作台' : '创建部门账号'}</h2><p>{mode === 'login' ? '请使用已有的内网账号登录。' : '注册后以部门成员身份进入，角色可由管理员调整。'}</p></div>
          <label><span>用户名</span><div><UserRound size={18} /><input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></div></label>
          {mode === 'register' ? <label><span>姓名</span><div><UserPlus size={18} /><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" placeholder="请输入真实姓名" required /></div></label> : null}
          <label><span>密码</span><div><LockKeyhole size={18} /><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></div></label>
          {mode === 'register' ? <label><span>确认密码</span><div><LockKeyhole size={18} /><input value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} type="password" autoComplete="new-password" required /></div><small className="password-hint">至少 12 位，包含大小写字母、数字和特殊字符</small></label> : null}
          {error ? <p className="login-error">{error}</p> : null}
          <button className="login-submit" type="submit" disabled={submitting}>{submitting ? (mode === 'login' ? '正在验证…' : '正在创建…') : (mode === 'login' ? '登录' : '注册并进入')}<ArrowRight size={18} /></button>
          <footer><span><CheckCircle2 size={14} />仅连接公司内网业务服务</span><small title={apiBaseUrl()}>服务地址已配置</small></footer>
        </form>
      </section>
    </main>
  )
}
