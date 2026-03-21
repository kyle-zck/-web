import { redirect } from "next/navigation";

/** 原「剧目列表」已下线，统一进入剧目详情 */
export default function AdminSeriesIndexPage() {
  redirect("/admin/series/detail");
}
