
import { columns } from "@/components/columns/column-students";
import { DataTableStudents } from "@/components/data-table/data-table-student";


import { prisma } from "@/lib/prisma";

export default async function StudentPage() {
  const student = await prisma.student.findMany();

  return (
    <div className="p-4">

            <h1 className="mb-4 text-2xl font-bold">Student List</h1>

      <DataTableStudents columns={columns} data={student}/>
    </div>
  );
}
