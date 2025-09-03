// src/app/dashboard/attendance/monthly/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/dark-mode";
import { NavUser } from "@/components/nav-user";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import MonthlyAttendanceGrid from "@/components/attendance/MonthlyAttendanceGrid";

function monthLabel(year: number, month: number) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
function prevYM(y: number, m: number) { const d = new Date(Date.UTC(y, m - 1, 1)); d.setUTCMonth(d.getUTCMonth() - 1); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }; }
function nextYM(y: number, m: number) { const d = new Date(Date.UTC(y, m - 1, 1)); d.setUTCMonth(d.getUTCMonth() + 1); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 }; }

export default function MonthlyPage({ searchParams }: { searchParams?: { y?: string; m?: string } }) {
  const now = new Date();
  const year = Number(searchParams?.y ?? now.getUTCFullYear());
  const month = Number(searchParams?.m ?? now.getUTCMonth() + 1);
  const prev = prevYM(year, month);
  const next = nextYM(year, month);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-5" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/dashboard/attendance">Attendance</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem><BreadcrumbPage>Monthly Editor</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Separator orientation="vertical" className="mr-2 h-5" />
            <NavUser user={{ name: "", email: "", avatar: "" }} />
          </div>
        </header>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/attendance/monthly?y=${prev.y}&m=${prev.m}`}>
              <Button variant="outline">Prev</Button>
            </Link>
            <div className="text-xl font-semibold">{monthLabel(year, month)}</div>
            <Link href={`/dashboard/attendance/monthly?y=${next.y}&m=${next.m}`}>
              <Button variant="outline">Next</Button>
            </Link>
            <Link href="/dashboard/attendance" className="ml-auto">
              <Button variant="outline">Summary</Button>
            </Link>
          </div>

          <MonthlyAttendanceGrid year={year} month={month} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
