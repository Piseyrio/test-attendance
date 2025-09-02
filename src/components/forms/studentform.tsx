"use client";

import { CreateStudent } from "@/lib/action";
import { studentSchema, StudentSchema } from "@/lib/zod";
import {  useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod";


export default function StudentForm() {
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
    // reset,
  } = useForm<StudentSchema>({
    resolver: zodResolver(studentSchema),
    
  });



  const onSubmit = async (value: StudentSchema) => {
    startTransition(() => {
      void (async () => {


        try {
          const payload = {
            firstname: value.firstname,
            lastname: value.lastname,
            biometricId: value.biometricId,
          };
          await CreateStudent(payload);
          toast.success("✅ Student has been created.");
          // reset();
          // setImgUrl("");
        } catch (error) {
          toast.error("❌ Failed to create student.");
          console.error(error);
        }
      })();
    });
  };

  return (
    <div className="flex flex-col">
      <span className="mb-4 font-semibold">Students Information</span>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 rounded p-4 "
      >
        

        <div>
          <label className="block mb-1">FirstName</label>
          <input
            {...register("firstname")}
            type="text"
            placeholder="First Name here..."
            className="w-full border rounded p-2 hover:border-gray-400 hover:shadow-sm transition duration-150 ease-in-out"
          />
          {errors.firstname && (
            <span className="text-red-500">{errors.firstname.message}</span>
          )}
        </div>

        <div>
          <label className="block mb-1">LastName</label>
          <input
            {...register("lastname")}
            type="text"
            placeholder="Last Name here..."
            className="w-full border rounded p-2 hover:border-gray-400 hover:shadow-sm transition duration-150 ease-in-out"
          />
          {errors.lastname && (
            <span className="text-red-500">{errors.lastname.message}</span>
          )}
        </div>

        <div>
          <label className="block mb-1">BiometricId</label>
          <input
            {...register("biometricId")}
            type="number"
            placeholder="biometricId here..."
            className="w-full border rounded p-2 hover:border-gray-400 hover:shadow-sm transition duration-150 ease-in-out"
          />
          {errors.biometricId && (
            <span className="text-red-500">{errors.biometricId.message}</span>
          )}
        </div>

        
        <div className="md:col-span-2 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center rounded-md bg-green-500 text-white px-4 py-2 disabled:opacity-60 hover:bg-green-600 hover:shadow-md transform hover:scale-102 transition duration-150"
          >
            {isPending ? "Saving..." : "Create Student"}
          </button>
        </div>
      </form>
    </div>
  );
}
