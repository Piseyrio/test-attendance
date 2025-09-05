import { AppSidebar } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/dark-mode";
import { NavUser } from "@/components/nav-user";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DataTableAttendance } from "@/components/data-table/data-table-attendance";
import { columns } from "@/components/columns/column-attendance";
import { getStudentAttendanceRows } from "@/lib/attendance-list";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function Attendance() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const data = await getStudentAttendanceRows({ start, end });

  
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
                  <BreadcrumbLink href="#">Attendance</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem><BreadcrumbPage>Monthly Summary</BreadcrumbPage></BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Separator orientation="vertical" className="mr-2 h-5" />
            <NavUser user={{ name: "", email: "", avatar: "" }} />
          </div>
        </header>

        <div className="p-4">
          <DataTableAttendance columns={columns} data={data} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
