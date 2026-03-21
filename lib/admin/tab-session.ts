/**
 * 与 HttpOnly Cookie 配合：仅当前浏览器标签页在登录成功后写入 sessionStorage。
 * 新开标签、复制链接打开均无此标记 → 会清 Cookie 并退回登录页。
 */
export const ADMIN_TAB_SESSION_KEY = "admin_tab_session";
