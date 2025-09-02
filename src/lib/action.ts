"use server";

import { revalidatePath } from "next/cache";
import {
  studentSchema,
  StudentSchema,
  StudentUpdateSchema,
  studentUpdateSchema,

} from "./zod";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

// export async function listClassesTeachersSubjects() {
//   const [classes, teachers, subjects] = await Promise.all([
//     prisma.class.findMany({
//       select: { id: true, name: true },
//       orderBy: { name: "asc" },
//     }),
//     prisma.teacher.findMany({
//       select: { id: true, firstname: true, lastname: true ,},
//       orderBy: [{ firstname: "asc" }, { lastname: "asc" }],
//     }),
//     prisma.subject.findMany({
//       select: { id: true, name: true },
//       orderBy: { name: "asc" },
//     }),
//   ]);
//   return {
//     classes,
//     teachers: teachers.map((t) => ({
//       id: t.id,
//       name: `${t.firstname} ${t.lastname}`,
//     })),
//     subjects,
//   };
// }

// export async function getStudentById(id: number) {
//   const student = await prisma.student.findUnique({
//     where: { id },
//     include: { class: true, teacher: true, subject: true },
//   });

//   if (!student) throw new Error("Student not found");
//   return student;
// }


//student
export async function CreateStudent(data: StudentSchema) {
  const parsed = studentSchema.safeParse(data);

  if (!parsed.success) {
    throw new Error(parsed.error?.message ?? "Invalid data");
  }
 const payload = parsed.data;

  await prisma.student.create({
    data: {
      firstname: payload.firstname,
      lastname: payload.lastname,
      biometricId: payload.biometricId,

    },
  });
  revalidatePath("/dashboard/students");
  redirect("/dashboard/students");
}

export async function updateStudent(data: StudentUpdateSchema) {
  const parsed = studentUpdateSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid data");
  }
  const { id, ...rest } = parsed.data;
  const studentId = Number(id);

  const updateData = {

    firstname: rest.firstname,
    lastname: rest.lastname,
    biometricId: rest.biometricId,
  };

  await prisma.student.update({
    where: { id: studentId },
    data: updateData,
  });

  revalidatePath("/dashboard/students");
  redirect("/dashboard/students");
}

export const deleteStudent = async (id: number) => {
  try {
    await prisma.student.delete({
      where: { id },
    });
  } catch (error) {
    console.error("Delete failed:", error);
    throw new Error("Failed to delete student");
  }

  revalidatePath("/dashboard/students");
  redirect("/dashboard/students");
};

