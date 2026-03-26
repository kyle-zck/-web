import { redirect } from "next/navigation";

/**
 * 后台入口是 /admin，不是 /series/admin。
 * 误访问 /series/admin 会命中 [id] 动态段（id=admin），剧目不存在则 404；
 * 此处显式接管并重定向，避免书签/手滑写错路径。
 */
export default function SeriesAdminTypoRedirect() {
  redirect("/admin");
}
