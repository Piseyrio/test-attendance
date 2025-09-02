"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, MoreHorizontal } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import Link from "next/link";
import { Student } from "../../../generated/prisma";



function fmtDate(d: Date | string | null) {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function titleCase(s: string | null | undefined){
  if (!s) return "-";
  return s.charAt(0) + s.slice(1).toLowerCase();
}

// For fetch Data form prisma check database name , for FakeData check FakeData.ts at lib
export const columns: ColumnDef<Student>[] = [

  {
    accessorKey: "id",
    header: "ID",
    meta: { className: "hidden md:table-cell" },
  },
  
  {
    id: "firstname",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    accessorFn: (row) => `${row.firstname} ${row.lastname}`, // needed for sorting
    filterFn: (row, columnId, filterValue) => {
      const fullName = row.getValue(columnId) as string;
      return fullName.toLowerCase().includes(filterValue.toLowerCase());
    },
    cell: ({ row }) => {
      const firstname = row.original.firstname;
      const lastname = row.original.lastname;
      return (
        <Link href={`/dashboard/students/${row.original.id}`}>
          <div className="flex flex-col leading-tight">
            <span className="font-medium">{firstname}</span>
            <span className="text-gray-500 text-sm">{lastname}</span>
          </div>
        </Link>
      );
    },
  },
  {
    accessorKey: "biometricId",
    header: "BiometricId",
    meta: { className: "hidden md:table-cell " },
  },

  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const payment = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg p-1 transition-colors duration-150"
            >
              <DropdownMenuLabel className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              Actions
              </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1" />

              <DropdownMenuItem asChild>
              <Link
                href={`/dashboard/list/students/${payment.id}`}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white rounded-md transition-colors duration-150"
              >
                Details
              </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
              <Link
                href={`/dashboard/list/students/${payment.id}/edit`}
                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white rounded-md transition-colors duration-150"
              >
                Edit
              </Link>
              </DropdownMenuItem>

              <DropdownMenuItem asChild>
              
              </DropdownMenuItem>


            </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
