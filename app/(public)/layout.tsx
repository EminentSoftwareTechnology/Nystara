import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { auth } from "@/lib/auth";
import AppShell from "@/components/layout/AppShell";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (session?.user?.id) return <AppShell>{children}</AppShell>;
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-page focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <Header signedIn={Boolean(session?.user?.id)} />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <Footer />
    </>
  );
}
