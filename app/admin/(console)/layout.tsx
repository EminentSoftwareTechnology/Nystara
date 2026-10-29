import Sidebar from "@/components/admin/Sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-4.25rem)] flex-col bg-page md:h-[calc(100dvh-4.25rem)] md:flex-row md:overflow-hidden">
      <Sidebar />
      <main className="min-w-0 flex-1 md:overflow-y-auto">{children}</main>
    </div>
  );
}
