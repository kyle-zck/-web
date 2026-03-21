import { redirect } from "next/navigation";

/** 兼容旧路径，统一进入剧目资源管理下的标签管理 */
export default function AdminTagsRedirectPage() {
  redirect("/admin/series/tags");
}
