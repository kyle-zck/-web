import { ToastProvider } from "@/components/ui/toast";

export default function AdminRootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ToastProvider />
      {children}
    </>
  );
}
