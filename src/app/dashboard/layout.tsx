import { cookies } from "next/headers";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";


export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // cookieStore = await import("next/headers").then((mod) => mod.cookies())
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Toaster />
      {children}
    </SidebarProvider>
  );
}
