import Sidebar from "@/components/admin/Sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
