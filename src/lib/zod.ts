import { z } from "zod";

export const studentSchema = z.object({

  firstname: z.string().min(2, "Firstname must be at least 2 characters"),
  lastname: z.string().min(2, "Lastname must be at least 2 characters"),
  biometricId: z.string().optional(),
});

export type StudentSchema = z.infer<typeof studentSchema>;

export const studentUpdateSchema = studentSchema.partial().extend({
  id: z.coerce.number().int().positive(),
});
export type StudentUpdateSchema = z.infer<typeof studentUpdateSchema>;

