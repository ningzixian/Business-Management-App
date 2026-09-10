import { useState, type FormEvent } from 'react'
import { ArrowRight, Building2, CheckCircle2, ClipboardList, Eye, EyeOff, LockKeyhole, ShieldCheck, UserPlus, UserRound } from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { useMobileLayout } from './use-mobile-layout'
import { apiBaseUrl } from './api'

export function LoginPage({
  onLogin,
  onRegister,
}: {
  onLogin: (username: string, password: string) => Promise<void>
  onRegister: (username: string, displayName: string, password: string) => Promise<void>
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const compact = useMobileLayout()
  const mobile = Capacitor.isNativePlatform() || compact
  const [username, setUsername] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
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
    <main className={`login-shell${mobile ? ' app-auth' : ''}`}>
      {mobile ? <header className="app-auth-brand"><span className="app-auth-icon"><ClipboardList size={34} strokeWidth={1.8} /></span><div className="app-auth-brand-copy"><h1>部门小管家</h1><p>记好每次拜访，跟进每件事。</p></div><span className="app-auth-context">商务协作 · 随时在手</span></header> : null}
      <section className="login-brand-panel">
        <div className="login-brand"><span><ClipboardList size={26} /></span><p><strong>商务活动管理</strong><small>Business Activity Management</small></p></div>
        <div className="login-promise">
          <span>v0.2.0 · 双库协作基础版</span>
          <h1>让组织、人脉与每一项商务行动形成完整闭环。</h1>
          <p>统一记录时间、地点、人员、事项与完成结果，同时保留可追溯的历史关系快照。</p>
        </div>
        <div className="login-feature-grid">
          <article><Building2 /><span><strong>组织</strong><small>企业与部门层级独立维护</small></span></article>
          <article><UserRound /><span><strong>人脉</strong><small>一人多职与关系历史</small></span></article>
          <article><ShieldCheck /><span><strong>权限与审计</strong><small>部门数据全程可追溯</small></span></article>
        </div>
      </section>
      <section className="login-form-panel">
        <form className="login-card" onSubmit={submit}>
          <header><span className="mobile-login-logo"><ClipboardList size={23} /></span><p><small>部门小管家</small><strong>欢迎回来</strong></p></header>
          <div className="auth-mode-tabs" aria-label="账号入口">
            <button className={mode === 'login' ? 'is-active' : ''} aria-pressed={mode === 'login'} disabled={submitting} type="button" onClick={() => { setMode('login'); setPassword(''); setPasswordConfirmation(''); setShowPassword(false); setError('') }}>登录</button>
            <button className={mode === 'register' ? 'is-active' : ''} aria-pressed={mode === 'register'} disabled={submitting} type="button" onClick={() => { setMode('register'); setUsername(''); setPassword(''); setPasswordConfirmation(''); setShowPassword(false); setError('') }}>注册账号</button>
          </div>
          {!mobile || mode === 'register' ? <div className="login-copy"><h2>{mode === 'login' ? '登录部门工作台' : '创建部门账号'}</h2><p>{mode === 'login' ? '请使用已有的内网账号登录。' : '注册后以部门成员身份进入，角色可由管理员调整。'}</p></div> : null}
          <label><span>用户名</span><div><UserRound size={18} /><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="请输入用户名" autoCapitalize="none" spellCheck={false} autoComplete="username" required /></div></label>
          {mode === 'register' ? <label><span>姓名</span><div><UserPlus size={18} /><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" placeholder="请输入真实姓名" required /></div></label> : null}
          <label><span>密码</span><div><LockKeyhole size={18} /><input value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'login' ? '请输入密码' : '请设置至少 8 位密码'} type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 8 : undefined} maxLength={128} required />{mobile ? <button className="app-password-toggle" type="button" aria-label={showPassword ? '隐藏密码' : '显示密码'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={20} /> : <Eye size={20} />}</button> : null}</div></label>
          {mode === 'register' ? <label><span>确认密码</span><div><LockKeyhole size={18} /><input aria-label="确认密码" aria-describedby="registration-password-hint" value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></div><small id="registration-password-hint" className="password-hint">至少 8 位，包含大小写字母、数字和特殊字符</small></label> : null}
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <button className="login-submit" type="submit" disabled={submitting}>{submitting ? (mode === 'login' ? '正在验证…' : '正在创建…') : (mode === 'login' ? '登录' : '注册并进入')}<ArrowRight size={18} /></button>
          {!mobile ? <footer><span><CheckCircle2 size={14} />仅连接公司内网业务服务</span><small title={apiBaseUrl()}>服务地址已配置</small></footer> : <p className="app-auth-help">{mode === 'login' ? '忘记密码？请联系部门管理员' : '请使用真实姓名，便于团队协作'}</p>}
        </form>
        {mobile ? <footer className="app-auth-footer"><p>请先连接公司 Wi-Fi 或 VPN</p></footer> : null}
      </section>
    </main>
  )
}
