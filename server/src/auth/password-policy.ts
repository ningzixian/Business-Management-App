export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

export function passwordPolicyViolations(password: string) {
  const violations: string[] = []
  if (password.length < PASSWORD_MIN_LENGTH) violations.push(`至少 ${PASSWORD_MIN_LENGTH} 位`)
  if (password.length > PASSWORD_MAX_LENGTH) violations.push(`不超过 ${PASSWORD_MAX_LENGTH} 位`)
  if (!/[a-z]/.test(password)) violations.push('包含小写字母')
  if (!/[A-Z]/.test(password)) violations.push('包含大写字母')
  if (!/\d/.test(password)) violations.push('包含数字')
  if (!/[^A-Za-z0-9]/.test(password)) violations.push('包含特殊字符')
  return violations
}
