import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminSessionHeartbeat } from "@/components/admin/admin-session-heartbeat";

export default function AdminPanelLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AdminSessionHeartbeat />
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        <div className="min-h-screen flex-1 px-4 py-6 md:px-6">{children}</div>
      </div>
    </>
  );
}
