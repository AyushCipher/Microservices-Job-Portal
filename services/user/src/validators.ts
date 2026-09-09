import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phoneNumber: z.string().trim().min(7).optional(),
  bio: z.string().trim().optional(),
});


export const skillSchema = z.object({
  skillName: z.string().trim().min(1, "Please provide a skill name"),
});


// export const experienceSchema = z.object({
//   company: z.string().trim().min(1, "Please provide a company name"),
//   position: z.string().trim().min(1, "Please provide a position"),
//   startDate: z.string().trim().min(1, "Please provide a start date"),
//   endDate: z.string().trim().optional(),
// });


export const applyForJobSchema = z.object({
  job_id: z.coerce.number().int().positive(),   // coerce.number() converts the input to a number like "42" -> 42
  resume_name: z.string().trim().min(1).max(255).optional(),
  answers: z.array(z.object({
        question_id: z.coerce.number().int().positive(),
        answer_text: z.string().trim().min(1).max(5000),
      })
    )
    .optional()
    .default([]),
});


export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
