/** 密码：长度 >8（至少 9 位），且同时包含字母与数字 */
/** 返回 i18n 键后缀：t(`admin.${key}`) */
export function validateNewPassword(password: string): string | null {
  if (password.length <= 8) {
    return "passwordTooShort";
  }
  if (!/[a-zA-Z]/.test(password)) {
    return "passwordNeedLetter";
  }
  if (!/[0-9]/.test(password)) {
    return "passwordNeedDigit";
  }
  return null;
}
