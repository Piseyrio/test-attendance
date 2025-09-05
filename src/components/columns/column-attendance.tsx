"use client";

import Image from "next/image";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import type { StudentAttendanceRow } from "@/lib/attendance-list";

export const columns: ColumnDef<StudentAttendanceRow>[] = [
  {
    id: "avatar",
    header: "Image",
    cell: ({ row }) => {
      const s = row.original.student;
      const img = s.img || "/noAvatar.png";
      return (
        <div className="relative h-10 w-10 overflow-hidden rounded-full">
          <Image src={img} alt={`${s.firstname} ${s.lastname}`} fill sizes="40px" className="object-cover" />
        </div>
      );
    },
  },
  {
    id: "student",
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    accessorFn: (row) => `${row.student.firstname} ${row.student.lastname}`,
    cell: ({ row }) => {
      const s = row.original.student;
      return (
        <Link href={`/dashboard/list/students/${s.id}`} className="flex flex-col leading-tight">
          <span className="font-medium">{s.firstname}</span>
          <span className="text-gray-500 text-sm">{s.lastname}</span>
        </Link>
      );
    },
  },
  {
  accessorKey: "biometricId",
        header: "Biometric ID",
        accessorFn: (row) => row.student.biometricId,
        cell: ({ row }) => row.original.student.biometricId ,
        meta: { className: "hidden md:table-cell" },
        },
  { accessorKey: "totalAttendance", header: "Present",   meta: { className: "hidden md:table-cell" } },
  { accessorKey: "totalAbsent",     header: "Absent",    meta: { className: "hidden lg:table-cell" } },
  { accessorKey: "totalLate",       header: "Late",      meta: { className: "hidden lg:table-cell" } },
  { accessorKey: "totalExcused",    header: "Excused",   meta: { className: "hidden md:table-cell lg:table-cell" } },

  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const s = row.original.student;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="text-red-500">Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(String(s.id))}>
              Copy student ID
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-green-500">Edit</DropdownMenuItem>
            <DropdownMenuItem>Details</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
