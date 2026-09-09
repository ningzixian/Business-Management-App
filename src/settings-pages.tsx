import { DialogLayer } from './dialog-layer'
import { NetworkCheck } from './network-check'
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import {
  CheckCircle2,
  DatabaseBackup,
  KeyRound,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Server,
  ShieldCheck,
  Smartphone,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react'
import { apiRequest, changePassword, type PageResponse } from './api'
import type { SessionUser } from './types'
import { Card, InitialAvatar, PageHeader } from './ui'

type UserRole = SessionUser['role']
type UserStatus = 'active' | 'disabled'

interface ManagedUser {
  id: string
  username: string
  displayName: string
  role: UserRole
  status: UserStatus
  lastLoginAt?: string | null
  passwordChangedAt?: string | null
  createdAt: string
}

interface SettingsProps {
  user: SessionUser
  demoMode: boolean
  onLogout: () => void
  onNotify: (message: string) => void
}

const roleLabels: Record<UserRole, string> = {
  admin: '系统管理员',
  manager: '部门经理',
  member: '部门成员',
  readonly: '只读用户',
}

export function SettingsPage(props: SettingsProps) {
  return <AccountSettings {...props} mobile={false} />
}

export function MobileSettingsPage(props: SettingsProps) {
  return <AccountSettings {...props} mobile />
}

function AccountSettings({ user, demoMode, onLogout, onNotify, mobile }: SettingsProps & { mobile: boolean }) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)
  const [resetUser, setResetUser] = useState<ManagedUser | null>(null)

  const loadUsers = useCallback(async () => {
    if (demoMode || user.role !== 'admin') return
    setLoadingUsers(true)
    setUsersError('')
    try {
      const response = await apiRequest<PageResponse<ManagedUser>>('/users?pageSize=100')
      setUsers(response.items)
    } catch (reason) {
      setUsersError(reason instanceof Error ? reason.message : '成员列表加载失败')
    } finally {
      setLoadingUsers(false)
    }
  }, [demoMode, user.role])

  useEffect(() => { void loadUsers() }, [loadUsers])

  const activeCount = useMemo(() => users.filter((item) => item.status === 'active').length, [users])

  function openPassword() {
    if (demoMode) {
      onNotify('演示模式不修改真实账号密码')
      return
    }
    setPasswordOpen(true)
  }

  const dialogs = (
    <>
      <ChangePasswordDialog open={passwordOpen} onClose={() => setPasswordOpen(false)} onNotify={onNotify} />
      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} onSaved={() => void loadUsers()} onNotify={onNotify} />
      <EditUserDialog user={editingUser} currentUserId={user.userId} onClose={() => setEditingUser(null)} onSaved={() => void loadUsers()} onNotify={onNotify} />
      <ResetPasswordDialog user={resetUser} onClose={() => setResetUser(null)} onSaved={() => void loadUsers()} onNotify={onNotify} />
    </>
  )

  if (mobile) {
    return (
      <div className="mobile-page mobile-settings-page account-settings-mobile">
        <div className="mobile-account-heading"><span>个人中心</span><h1>我的账号</h1><p>管理登录安全与部门账号。</p></div>
        <section className="mobile-profile-card">
          <InitialAvatar text={user.displayName} size="large" />
          <span><strong>{user.displayName}</strong><small>@{user.username} · {roleLabels[user.role]}</small><em><CheckCircle2 size={12} /> 企业账号已认证</em></span>
        </section>
        <section className="mobile-settings-group">
          <h2>账号与安全</h2>
          <div>
            <button type="button" onClick={openPassword}><span><KeyRound /></span><strong>修改登录密码</strong><small>强密码保护</small></button>
            <button type="button" onClick={onLogout}><span><LogOut /></span><strong>退出当前账号</strong><small>安全退出</small></button>
          </div>
        </section>
        {user.role === 'admin' ? (
          <section className="mobile-account-users">
            <header><div><span>账号管理</span><strong>{activeCount} 个启用账号</strong></div><button type="button" onClick={() => setCreateOpen(true)}><Plus size={16} />新增</button></header>
            {loadingUsers ? <p className="account-inline-state">正在加载成员…</p> : null}
            {usersError ? <p className="account-inline-state is-error">{usersError}</p> : null}
            <div className="mobile-user-list">
              {users.map((item) => (
                <article key={item.id} className={item.status === 'disabled' ? 'is-disabled' : ''}>
                  <InitialAvatar text={item.displayName} size="small" />
                  <span><strong>{item.displayName}{item.id === user.userId ? <i>当前</i> : null}</strong><small>@{item.username} · {roleLabels[item.role]}</small></span>
                  <b className={`account-status status-${item.status}`}>{item.status === 'active' ? '启用' : '停用'}</b>
                  {item.id !== user.userId ? <button type="button" aria-label={`管理 ${item.displayName}`} onClick={() => setEditingUser(item)}><Pencil size={15} /></button> : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
        <section className="mobile-settings-group">
          <h2>应用信息</h2>
          <div>
            <button type="button" onClick={() => onNotify('下方可检查当前配置的业务服务。换址需重新构建手机资源，API 与原生更新共用同一来源。')}><span><Server /></span><strong>内网服务</strong><small>查看连接说明</small></button>
            <button type="button" onClick={() => onNotify('部门小管家 · v0.2.0 功能修复版。安装包版本以系统应用信息为准；新功能需安装新版 APP。')}><span><Smartphone /></span><strong>部门小管家</strong><small>查看应用说明</small></button>
          </div>
        </section>
        <NetworkCheck />
        <p className="mobile-version">部门小管家 · v0.2.0</p>
        {dialogs}
      </div>
    )
  }

  return (
    <div className="page-stack account-settings-page">
      <PageHeader title="设置" description="管理个人登录安全、部门账号和系统运行信息。" />
      <NetworkCheck />
      <section className="settings-layout">
        <Card className="profile-card">
          <div className="profile-hero">
            <InitialAvatar text={user.displayName} size="large" />
            <div><strong>{user.displayName}</strong><span>@{user.username} · {roleLabels[user.role]}</span><small>账号数据归属当前商务部门</small></div>
            <button className="button button-secondary" type="button" onClick={openPassword}><KeyRound size={16} />修改密码</button>
          </div>
        </Card>

        <div className="account-summary-grid">
          <AccountInfoCard icon={<ShieldCheck />} title="登录与安全" description="密码变更会立即注销其他设备的旧会话" meta="强密码策略已启用" />
          <AccountInfoCard icon={<DatabaseBackup />} title="数据与备份" description="数据库与附件分开备份并保留校验记录" meta="独立备份目录" />
          <AccountInfoCard icon={<Server />} title="部署隔离" description="前端、接口、数据库和存储独立容器运行" meta="business-management" />
        </div>

        {user.role === 'admin' ? (
          <Card className="account-users-card">
            <header className="account-section-header">
              <div><span>系统管理</span><h2>部门账号</h2><p>新增成员、调整角色或停用离职账号。安全变更会立即使该账号的旧会话失效。</p></div>
              <button className="button button-primary" type="button" onClick={() => setCreateOpen(true)}><UserPlus size={16} />新增账号</button>
            </header>
            <div className="account-count-strip"><span><UsersRound size={16} />共 {users.length} 个账号</span><span><CheckCircle2 size={16} />{activeCount} 个启用</span></div>
            {loadingUsers ? <p className="account-inline-state">正在加载成员…</p> : null}
            {usersError ? <p className="account-inline-state is-error">{usersError}<button type="button" onClick={() => void loadUsers()}>重试</button></p> : null}
            {!loadingUsers && !usersError ? (
              <div className="account-user-table">
                <div className="account-user-row account-user-head"><span>成员</span><span>角色</span><span>状态</span><span>最近登录</span><span>操作</span></div>
                {users.map((item) => (
                  <div className={`account-user-row ${item.status === 'disabled' ? 'is-disabled' : ''}`} key={item.id}>
                    <span className="account-user-identity"><InitialAvatar text={item.displayName} size="small" /><span><strong>{item.displayName}{item.id === user.userId ? <i>当前账号</i> : null}</strong><small>@{item.username}</small></span></span>
                    <span>{roleLabels[item.role]}</span>
                    <span><b className={`account-status status-${item.status}`}>{item.status === 'active' ? '已启用' : '已停用'}</b></span>
                    <span>{formatDateTime(item.lastLoginAt)}</span>
                    <span className="account-row-actions">
                      {item.id !== user.userId ? <><button type="button" onClick={() => setEditingUser(item)}><Pencil size={14} />管理</button><button type="button" onClick={() => setResetUser(item)}><RotateCcw size={14} />重置密码</button></> : <small>通过上方修改密码</small>}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        ) : (
          <Card className="account-member-note"><ShieldCheck size={20} /><div><strong>当前角色：{roleLabels[user.role]}</strong><p>账号角色和状态由系统管理员维护；如需调整，请联系部门管理员。</p></div></Card>
        )}
      </section>
      {dialogs}
    </div>
  )
}

function AccountInfoCard({ icon, title, description, meta }: { icon: ReactNode; title: string; description: string; meta: string }) {
  return <Card className="account-info-card"><span>{icon}</span><div><strong>{title}</strong><p>{description}</p><small>{meta}</small></div></Card>
}

function ChangePasswordDialog({ open, onClose, onNotify }: { open: boolean; onClose: () => void; onNotify: (message: string) => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmation) return setError('两次输入的新密码不一致')
    setSubmitting(true)
    try {
      await changePassword(currentPassword, newPassword)
      onNotify('密码已更新，其他设备的旧会话已失效')
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '密码修改失败')
    } finally {
      setSubmitting(false)
    }
  }
  return <AccountDialog title="修改我的密码" eyebrow="账号安全" onClose={onClose}><form className="account-form" onSubmit={submit}><PasswordField label="当前密码" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" /><PasswordField label="新密码" value={newPassword} onChange={setNewPassword} /><PasswordField label="确认新密码" value={confirmation} onChange={setConfirmation} /><PasswordRule />{error ? <p className="account-form-error">{error}</p> : null}<DialogActions onClose={onClose} submitting={submitting} submitLabel="确认修改" /></form></AccountDialog>
}

function CreateUserDialog({ open, onClose, onSaved, onNotify }: { open: boolean; onClose: () => void; onSaved: () => void; onNotify: (message: string) => void }) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<UserRole>('member')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  if (!open) return null
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password !== confirmation) return setError('两次输入的初始密码不一致')
    setSubmitting(true)
    try {
      await apiRequest('/users', { method: 'POST', body: JSON.stringify({ username, displayName, role, initialPassword: password }) })
      onNotify(`账号 ${username} 已创建`)
      onSaved()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '账号创建失败')
    } finally {
      setSubmitting(false)
    }
  }
  return <AccountDialog title="新增部门账号" eyebrow="系统管理" onClose={onClose}><form className="account-form" onSubmit={submit}><TextField label="用户名" value={username} onChange={setUsername} placeholder="如 wangxiaoming" /><TextField label="姓名" value={displayName} onChange={setDisplayName} placeholder="请输入真实姓名" /><RoleField value={role} onChange={setRole} /><PasswordField label="初始密码" value={password} onChange={setPassword} /><PasswordField label="确认初始密码" value={confirmation} onChange={setConfirmation} /><PasswordRule />{error ? <p className="account-form-error">{error}</p> : null}<DialogActions onClose={onClose} submitting={submitting} submitLabel="创建账号" /></form></AccountDialog>
}

function EditUserDialog({ user, currentUserId, onClose, onSaved, onNotify }: { user: ManagedUser | null; currentUserId: string; onClose: () => void; onSaved: () => void; onNotify: (message: string) => void }) {
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<UserRole>('member')
  const [status, setStatus] = useState<UserStatus>('active')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (user) { setDisplayName(user.displayName); setRole(user.role); setStatus(user.status); setError('') }
  }, [user])
  if (!user) return null
  const target = user
  const isCurrent = target.id === currentUserId
  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await apiRequest(`/users/${target.id}`, { method: 'PATCH', body: JSON.stringify({ displayName, role, status }) })
      onNotify(`${displayName} 的账号设置已更新`)
      onSaved()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '账号更新失败')
    } finally {
      setSubmitting(false)
    }
  }
  return <AccountDialog title={`管理 ${target.displayName}`} eyebrow={`@${target.username}`} onClose={onClose}><form className="account-form" onSubmit={submit}><TextField label="姓名" value={displayName} onChange={setDisplayName} /><RoleField value={role} onChange={setRole} disabled={isCurrent} /><label className="account-field"><span>账号状态</span><select value={status} onChange={(event) => setStatus(event.target.value as UserStatus)} disabled={isCurrent}><option value="active">启用</option><option value="disabled">停用</option></select></label>{isCurrent ? <p className="account-form-note">当前登录账号不能修改自己的角色或状态。</p> : null}{error ? <p className="account-form-error">{error}</p> : null}<DialogActions onClose={onClose} submitting={submitting} submitLabel="保存设置" /></form></AccountDialog>
}

function ResetPasswordDialog({ user, onClose, onSaved, onNotify }: { user: ManagedUser | null; onClose: () => void; onSaved: () => void; onNotify: (message: string) => void }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (user) { setPassword(''); setConfirmation(''); setError('') } }, [user])
  if (!user) return null
  const target = user
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password !== confirmation) return setError('两次输入的新密码不一致')
    setSubmitting(true)
    try {
      await apiRequest(`/users/${target.id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword: password }) })
      onNotify(`${target.displayName} 的密码已重置，旧会话已失效`)
      onSaved()
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '密码重置失败')
    } finally {
      setSubmitting(false)
    }
  }
  return <AccountDialog title={`重置 ${target.displayName} 的密码`} eyebrow="安全操作" onClose={onClose}><form className="account-form" onSubmit={submit}><p className="account-form-warning"><LockKeyhole size={17} />重置后，该账号在其他设备上的登录会话会立即失效。</p><PasswordField label="新密码" value={password} onChange={setPassword} /><PasswordField label="确认新密码" value={confirmation} onChange={setConfirmation} /><PasswordRule />{error ? <p className="account-form-error">{error}</p> : null}<DialogActions onClose={onClose} submitting={submitting} submitLabel="确认重置" /></form></AccountDialog>
}

function AccountDialog({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode }) {
  return <DialogLayer className="modal-backdrop account-modal-backdrop" onClose={onClose}><section className="record-modal account-dialog" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><header className="modal-header"><div><span>{eyebrow}</span><h2>{title}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="关闭"><X size={19} /></button></header>{children}</section></DialogLayer>
}

function TextField({ label, value, onChange, placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="account-field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required /></label>
}

function PasswordField({ label, value, onChange, autoComplete = 'new-password' }: { label: string; value: string; onChange: (value: string) => void; autoComplete?: string }) {
  return <label className="account-field"><span>{label}</span><input type="password" value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} minLength={8} maxLength={128} required /></label>
}

function RoleField({ value, onChange, disabled = false }: { value: UserRole; onChange: (value: UserRole) => void; disabled?: boolean }) {
  return <label className="account-field"><span>角色</span><select value={value} onChange={(event) => onChange(event.target.value as UserRole)} disabled={disabled}><option value="admin">系统管理员</option><option value="manager">部门经理</option><option value="member">部门成员</option><option value="readonly">只读用户</option></select></label>
}

function PasswordRule() {
  return <p className="account-form-note">密码至少 8 位，并同时包含大小写字母、数字和特殊字符。</p>
}

function DialogActions({ onClose, submitting, submitLabel }: { onClose: () => void; submitting: boolean; submitLabel: string }) {
  return <footer className="account-dialog-actions"><button className="button button-secondary" type="button" onClick={onClose}>取消</button><button className="button button-primary" type="submit" disabled={submitting}>{submitting ? '正在提交…' : submitLabel}</button></footer>
}

function formatDateTime(value?: string | null) {
  if (!value) return '尚未登录'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}
