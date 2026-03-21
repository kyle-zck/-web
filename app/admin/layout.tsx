import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { ToastProvider } from "@/components/ui/toast";

export default function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full">
      <AdminSidebar />
      <div className="min-h-screen flex-1 px-4 py-6 md:px-6">{children}</div>
      <ToastProvider />
    </div>
  );
}

