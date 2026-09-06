ALTER TABLE users
  ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 1 CHECK (auth_version > 0),
  ADD COLUMN password_changed_at TIMESTAMPTZ;

COMMENT ON COLUMN users.auth_version IS '账号安全版本；密码、角色或状态变化时递增，使旧访问令牌立即失效';
COMMENT ON COLUMN users.password_changed_at IS '用户最近一次主动修改或管理员重置密码的时间';
