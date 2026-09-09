import { z } from "zod";

const jobTypeEnum = z.enum([
  "Full-time",
  "Part-time",
  "Contract",
  "Internship",
]);

const workLocationEnum = z.enum(["On-site", "Remote", "Hybrid"]);
const applicationStatusEnum = z.enum(["Submitted", "Rejected", "Hired"]);
const stageStatusEnum = z.enum([
  "upcoming",
  "in_progress",
  "completed",
  "rejected",
]);


export const createCompanySchema = z.object({
  name: z.string().trim().min(1, "Company name is required"),
  description: z.string().trim().min(1, "Description is required"),
  website: z.string().trim().url("Invalid website URL"),
});


// Recruiter-defined hiring pipeline. At least one round is required — the
// Job Detail page's Hiring Process stepper and the Tracker timeline are both
// driven entirely by this list, there's no hardcoded fallback pipeline.
const jobRoundSchema = z.object({
  name: z.string().trim().min(1, "Round name is required"),
  description: z.string().trim().optional(),
});


const jobDetailsFields = {
  apply_by: z.coerce.date({ required_error: "Apply-by deadline is required" }),
  role_type: z.string().trim().min(1, "Role type is required"),
  duration: z.string().trim().min(1, "Duration is required"),
  qualification: z.string().trim().min(1, "Qualification is required"),
  working_days: z.string().trim().min(1, "Working days is required"),
  min_hires: z.coerce.number().int().positive().optional(),
  expected_offers: z.coerce.number().int().positive().optional(),
  stipend: z.coerce.number().positive().optional(),
  ctc_min: z.coerce.number().positive().optional(),
  ctc_max: z.coerce.number().positive().optional(),
  category: z.string().trim().optional(),
  conversion_note: z.string().trim().optional(),
  eligible_gender: z.string().trim().optional(),
  eligible_grad_years: z.string().trim().optional(),
  criteria: z.string().trim().optional(),
  job_start_date: z.coerce.date().optional(),
  date_of_visit: z.coerce.date().optional(),
  internship_mode: z.string().trim().optional(),
  internship_start_date: z.coerce.date().optional(),
  internship_duration: z.string().trim().optional(),
  internship_season: z.string().trim().optional(),
};


export const createJobSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().min(1, "Description is required"),
  salary: z.coerce.number().positive("Salary must be a positive number"),
  location: z.string().trim().min(1, "Location is required"),
  role: z.string().trim().min(1, "Role is required"),
  job_type: jobTypeEnum,
  work_location: workLocationEnum,
  company_id: z.coerce.number().int().positive(),
  openings: z.coerce.number().positive("Openings must be a positive number"),
  rounds: z
    .array(jobRoundSchema)
    .min(1, "Define at least one hiring round"),
  tags: z.array(z.string().trim().min(1)).optional().default([]),
  skills: z.array(z.string().trim().min(1)).optional().default([]),
  questions: z.array(z.string().trim().min(1)).optional().default([]),
  ...jobDetailsFields,
});


export const updateJobSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().min(1, "Description is required"),
  salary: z.coerce.number().positive("Salary must be a positive number"),
  location: z.string().trim().min(1, "Location is required"),
  role: z.string().trim().min(1, "Role is required"),
  job_type: jobTypeEnum,
  work_location: workLocationEnum,
  openings: z.coerce.number().positive("Openings must be a positive number"),
  is_active: z.boolean().optional(),
  rounds: z
    .array(jobRoundSchema)
    .min(1, "Define at least one hiring round"),
  tags: z.array(z.string().trim().min(1)).optional().default([]),
  skills: z.array(z.string().trim().min(1)).optional().default([]),
  questions: z.array(z.string().trim().min(1)).optional().default([]),
  ...jobDetailsFields,
});


export const updateApplicationStatusSchema = z.object({
  status: applicationStatusEnum,
});


export const updateApplicationStageSchema = z.object({
  applicationIds: z
    .array(z.coerce.number().int().positive())
    .min(1, "At least one application id is required"),
  round_id: z.coerce.number().int().positive(),
  status: stageStatusEnum,
  note: z.string().trim().optional(),
});


export const jobListQuerySchema = z.object({
  title: z.string().trim().optional(),
  location: z.string().trim().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});


export const applicationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});


export const adminJobActiveSchema = z.object({
  is_active: z.boolean(),
});
