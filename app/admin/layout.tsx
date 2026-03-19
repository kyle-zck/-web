import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1200px]">
      <AdminSidebar />
      <div className="min-h-screen flex-1 px-4 py-6 md:px-6">{children}</div>
    </div>
  );
}

