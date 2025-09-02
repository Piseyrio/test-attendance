import Sidebar from "@/components/sidebar";
import { Toaster } from "@/components/ui/sonner";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Toaster />
      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar />
        <main style={{ flex: 1 }}>
          {children}
        </main>
      </div>
    </>
  );
}
