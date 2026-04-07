import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTabSessionGate } from "@/components/admin/admin-tab-session-gate";

export default function AdminPanelLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminTabSessionGate>
      <div className="flex min-h-screen w-full">
        <AdminSidebar />
        <div className="min-h-screen flex-1 px-4 py-6 md:px-6">{children}</div>
      </div>
    </AdminTabSessionGate>
  );
}
