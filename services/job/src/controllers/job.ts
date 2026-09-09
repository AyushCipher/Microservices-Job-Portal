import axios from "axios";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import getBuffer from "../utils/buffer.js";
import { sql } from "../utils/db.js";
import { ErrorHandler, TryCatch } from "@hireheaven/common";
import { applicationStatusUpdateTemplate } from "../tempelete.js";
import { publishToTopic } from "../producer.js";
import { cache } from "../utils/redisClient.js";

const { getCache, setCache, invalidateByPrefix } = cache;

const JOB_LIST_CACHE_PREFIX = "cache:job:all:";
const JOB_SINGLE_CACHE_PREFIX = "cache:job:single:";
const COMPANY_CACHE_PREFIX = "cache:job:company:";


// This function handles the creation of a new company by a recruiter
export const createCompany = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    if (user.role !== "recruiter") {
      throw new ErrorHandler(403,"Forbidden: Only recruiter can create a company");
    }

    const { name, description, website } = req.body;

    if (!name || !description || !website) {
      throw new ErrorHandler(400, "All fields are required");
    }

    const existingCompanies =
      await sql`SELECT company_id FROM companies WHERE name = ${name}`;

    if (existingCompanies.length > 0) {
      throw new ErrorHandler(409, `A company with the name ${name} already exists`);
    }

    // Converts the file(logo -> from Multer) into the format expected by the Utils Service
    const file = req.file;

    if (!file) {
      throw new ErrorHandler(400, "Company logo file is required");
    }

    // The getBuffer function takes the file object (which contains the raw binary data of the uploaded file) and converts it into a Data URI format
    const fileBuffer = getBuffer(file);

    if (!fileBuffer || !fileBuffer.content) {
      throw new ErrorHandler(500, "Failed to create file buffer");
    }

    // Job service sends the file buffer to the Utils service for uploading to cloud storage (like AWS S3 or Cloudinary). The Utils service returns a URL and public ID for the uploaded file, which is then stored in the database.
    const { data } = await axios.post(
      `${process.env.UPLOAD_SERVICE}/api/utils/upload`,
      { buffer: fileBuffer.content }
    );

    const [newCompany] =
      await sql`INSERT INTO companies (name, description, website, logo, logo_public_id, recruiter_id) VALUES (${name}, ${description}, ${website}, ${data.url}, ${data.public_id}, ${req.user?.user_id}) RETURNING *`;

    res.json({
      message: "Company created successfully",
      company: newCompany,
    });
  }
);


// This function handles the deletion of a company and all associated jobs
export const deleteCompany = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    const { companyId } = req.params;

    const [company] =
      await sql`SELECT logo_public_id, recruiter_id FROM companies WHERE company_id = ${companyId}`;

    if (!company) {
      throw new ErrorHandler(404, "Company not found");
    }

    if (company.recruiter_id !== user?.user_id && user?.role !== "admin") {
      throw new ErrorHandler(403,"You're not authorized to delete this company");
    }

    await sql`DELETE FROM companies WHERE company_id = ${companyId}`;

    await Promise.all([
      invalidateByPrefix(COMPANY_CACHE_PREFIX),
      invalidateByPrefix(JOB_LIST_CACHE_PREFIX),
      invalidateByPrefix(JOB_SINGLE_CACHE_PREFIX),
    ]);

    res.json({
      message: "Company and all associated jobs have been deleted",
    });
  }
);

interface JobRoundInput {
  name: string;
  description?: string;
}


// This function handles the creation of a new job by a recruiter
export const createJob = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;

  if (!user) {
    throw new ErrorHandler(401, "Authentication required");
  }

  if (user.role !== "recruiter") {
    throw new ErrorHandler(403,"Forbidden: Only recruiter can create a company");
  }

  const {
    title,
    description,
    salary,
    location,
    role,
    job_type,
    work_location,
    company_id,
    openings,
    rounds,
    tags,
    skills,
    questions,
    apply_by,
    role_type,
    duration,
    qualification,
    working_days,
    min_hires,
    expected_offers,
    stipend,
    ctc_min,
    ctc_max,
    category,
    conversion_note,
    eligible_gender,
    eligible_grad_years,
    criteria,
    job_start_date,
    date_of_visit,
    internship_mode,
    internship_start_date,
    internship_duration,
    internship_season,
  } = req.body;

  const [company] =
    await sql`SELECT company_id FROM companies WHERE company_id = ${company_id} AND recruiter_id = ${user.user_id}`;

  if (!company) {
    throw new ErrorHandler(404, "Company not found");
  }

  const [newJob] =
    await sql`INSERT INTO jobs (title, description, salary, location, role, job_type, work_location, company_id, posted_by_recuriter_id, openings) VALUES (${title}, ${description}, ${salary}, ${location}, ${role}, ${job_type}, ${work_location}, ${company_id}, ${user.user_id}, ${openings}) RETURNING *`;

  // job_details + the recruiter-defined pipeline/tags/skills/questions are
  // written atomically; if any of it fails, the jobs row is rolled back by
  // hand (the neon HTTP driver's transaction() can't span a statement that
  // depends on newJob.job_id existing first, so this is a two-phase write).
  try {
    const detailInsert = sql`
      INSERT INTO job_details (
        job_id, apply_by, role_type, min_hires, expected_offers, duration, stipend,
        ctc_min, ctc_max, qualification, working_days, category, conversion_note,
        eligible_gender, eligible_grad_years, criteria, job_start_date, date_of_visit,
        internship_mode, internship_start_date, internship_duration, internship_season,
        last_modified_by
      ) VALUES (
        ${newJob.job_id}, ${apply_by}, ${role_type}, ${min_hires ?? null}, ${expected_offers ?? null},
        ${duration}, ${stipend ?? null}, ${ctc_min ?? null}, ${ctc_max ?? null}, ${qualification},
        ${working_days}, ${category ?? null}, ${conversion_note ?? null}, ${eligible_gender ?? null},
        ${eligible_grad_years ?? null}, ${criteria ?? null}, ${job_start_date ?? null}, ${date_of_visit ?? null},
        ${internship_mode ?? null}, ${internship_start_date ?? null}, ${internship_duration ?? null},
        ${internship_season ?? null}, ${user.user_id}
      )`;

    const roundInserts = (rounds as JobRoundInput[]).map(
      (round, index) =>
        sql`INSERT INTO job_rounds (job_id, round_order, name, description) VALUES (${newJob.job_id}, ${index + 1}, ${round.name}, ${round.description ?? null})`
    );

    const tagInserts = (tags as string[]).map(
      (tag) =>
        sql`INSERT INTO job_tags (job_id, tag) VALUES (${newJob.job_id}, ${tag})`
    );

    const skillInserts = (skills as string[]).map(
      (skill) =>
        sql`INSERT INTO job_skills (job_id, skill) VALUES (${newJob.job_id}, ${skill})`
    );

    const questionInserts = (questions as string[]).map(
      (question, index) =>
        sql`INSERT INTO job_questions (job_id, question_order, question_text) VALUES (${newJob.job_id}, ${index + 1}, ${question})`
    );

    await sql.transaction([
      detailInsert,
      ...roundInserts,
      ...tagInserts,
      ...skillInserts,
      ...questionInserts,
    ] as any);

  } catch (error) {
    console.error("Failed to save job details, rolling back job row", error);
    await sql`DELETE FROM jobs WHERE job_id = ${newJob.job_id}`;
    throw new ErrorHandler(500,"Failed to save job details, please try again");
  }

  await Promise.all([
    invalidateByPrefix(JOB_LIST_CACHE_PREFIX),
    invalidateByPrefix(`${COMPANY_CACHE_PREFIX}${company_id}`),
  ]);

  res.json({
    message: "Job posted successfully",
    job: newJob,
  });
});


// This function handles the updating of an existing job by a recruiter
export const updateJob = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;

  if (!user) {
    throw new ErrorHandler(401, "Authentication required");
  }

  if (user.role !== "recruiter" && user.role !== "admin") {
    throw new ErrorHandler(403,"Forbidden: Only recruiter can create a company");
  }

  const {
    title,
    description,
    salary,
    location,
    role,
    job_type,
    work_location,
    openings,
    is_active,
    rounds,
    tags,
    skills,
    questions,
    apply_by,
    role_type,
    duration,
    qualification,
    working_days,
    min_hires,
    expected_offers,
    stipend,
    ctc_min,
    ctc_max,
    category,
    conversion_note,
    eligible_gender,
    eligible_grad_years,
    criteria,
    job_start_date,
    date_of_visit,
    internship_mode,
    internship_start_date,
    internship_duration,
    internship_season,
  } = req.body;

  const jobId = req.params.jobId;

  const [existingJob] =
    await sql`SELECT posted_by_recuriter_id, company_id FROM jobs WHERE job_id = ${jobId}`;

  if (!existingJob) {
    throw new ErrorHandler(404, "Job not found");
  }

  if (
    existingJob.posted_by_recuriter_id !== user.user_id &&
    user.role !== "admin"
  ) {
    throw new ErrorHandler(403, "You do not have permission to perform this action");
  }

  // Rounds are immutable-by-convention once any application exists against
  // this job, so applications.current_round_id / stage history never point
  // at a round that got reshuffled out from under them mid-pipeline.
  const [{ count: applicationCount }] = (await sql`
    SELECT COUNT(*)::int AS count FROM applications WHERE job_id = ${jobId}
  `) as { count: number }[];

  const roundInserts = (rounds as JobRoundInput[]).map(
    (round, index) =>
      sql`INSERT INTO job_rounds (job_id, round_order, name, description) VALUES (${jobId}, ${index + 1}, ${round.name}, ${round.description ?? null})`
  );

  const tagInserts = (tags as string[]).map(
    (tag) => sql`INSERT INTO job_tags (job_id, tag) VALUES (${jobId}, ${tag})`
  );

  const skillInserts = (skills as string[]).map(
    (skill) =>
      sql`INSERT INTO job_skills (job_id, skill) VALUES (${jobId}, ${skill})`
  );

  const questionInserts = (questions as string[]).map(
    (question, index) =>
      sql`INSERT INTO job_questions (job_id, question_order, question_text) VALUES (${jobId}, ${index + 1}, ${question})`
  );

  const txStatements = [
    sql`UPDATE jobs SET title = ${title},
    description = ${description},
    salary = ${salary},
    location = ${location},
    role = ${role},
    job_type = ${job_type},
    work_location = ${work_location},
    openings = ${openings},
    is_active = ${is_active}
    WHERE job_id = ${jobId} RETURNING *`,
    sql`INSERT INTO job_details (
        job_id, apply_by, role_type, min_hires, expected_offers, duration, stipend,
        ctc_min, ctc_max, qualification, working_days, category, conversion_note,
        eligible_gender, eligible_grad_years, criteria, job_start_date, date_of_visit,
        internship_mode, internship_start_date, internship_duration, internship_season,
        last_modified_by, updated_at
      ) VALUES (
        ${jobId}, ${apply_by}, ${role_type}, ${min_hires ?? null}, ${expected_offers ?? null},
        ${duration}, ${stipend ?? null}, ${ctc_min ?? null}, ${ctc_max ?? null}, ${qualification},
        ${working_days}, ${category ?? null}, ${conversion_note ?? null}, ${eligible_gender ?? null},
        ${eligible_grad_years ?? null}, ${criteria ?? null}, ${job_start_date ?? null}, ${date_of_visit ?? null},
        ${internship_mode ?? null}, ${internship_start_date ?? null}, ${internship_duration ?? null},
        ${internship_season ?? null}, ${user.user_id}, now()
      )
      ON CONFLICT (job_id) DO UPDATE SET
        apply_by = EXCLUDED.apply_by, role_type = EXCLUDED.role_type, min_hires = EXCLUDED.min_hires,
        expected_offers = EXCLUDED.expected_offers, duration = EXCLUDED.duration, stipend = EXCLUDED.stipend,
        ctc_min = EXCLUDED.ctc_min, ctc_max = EXCLUDED.ctc_max, qualification = EXCLUDED.qualification,
        working_days = EXCLUDED.working_days, category = EXCLUDED.category, conversion_note = EXCLUDED.conversion_note,
        eligible_gender = EXCLUDED.eligible_gender, eligible_grad_years = EXCLUDED.eligible_grad_years,
        criteria = EXCLUDED.criteria, job_start_date = EXCLUDED.job_start_date, date_of_visit = EXCLUDED.date_of_visit,
        internship_mode = EXCLUDED.internship_mode, internship_start_date = EXCLUDED.internship_start_date,
        internship_duration = EXCLUDED.internship_duration, internship_season = EXCLUDED.internship_season,
        last_modified_by = EXCLUDED.last_modified_by, updated_at = now()`,
    sql`DELETE FROM job_tags WHERE job_id = ${jobId}`,
    sql`DELETE FROM job_skills WHERE job_id = ${jobId}`,
    sql`DELETE FROM job_questions WHERE job_id = ${jobId}`,
    ...tagInserts,
    ...skillInserts,
    ...questionInserts,
  ];

  if (applicationCount === 0) {
    txStatements.push(
      sql`DELETE FROM job_rounds WHERE job_id = ${jobId}`,
      ...roundInserts
    );
  }

  const results = await sql.transaction(txStatements as any);
  const updatedJob = (results[0] as any[])[0];

  await Promise.all([
    invalidateByPrefix(JOB_LIST_CACHE_PREFIX),
    invalidateByPrefix(`${JOB_SINGLE_CACHE_PREFIX}${jobId}`),
    invalidateByPrefix(`${COMPANY_CACHE_PREFIX}${existingJob.company_id}`),
  ]);

  res.json({
    message: "Job updated successfully",
    job: updatedJob,
  });
});

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB


// This function handles the uploading of an attachment (PDF) for a specific job by a recruiter
export const uploadJobAttachment = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    const { jobId } = req.params;

    const [job] =
      await sql`SELECT posted_by_recuriter_id FROM jobs WHERE job_id = ${jobId}`;

    if (!job) {
      throw new ErrorHandler(404, "Job not found");
    }

    if (job.posted_by_recuriter_id !== user.user_id && user.role !== "admin") {
      throw new ErrorHandler(403, "You do not have permission to perform this action");
    }

    // The file is expected to be sent in the request body as a multipart/form-data payload, typically using a form submission or an API client that supports file uploads.
    const file = req.file;

    if (!file) {
      throw new ErrorHandler(400, "File is required");
    }

    if (file.mimetype !== "application/pdf") {
      throw new ErrorHandler(400, "Only PDF files are allowed");
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new ErrorHandler(400, "File must be 10MB or smaller");
    }

    // The getBuffer function takes the file object (which contains the raw binary data of the uploaded file) and converts it into a Data URI format
    const fileBuffer = getBuffer(file);

    if (!fileBuffer || !fileBuffer.content) {
      throw new ErrorHandler(500, "Failed to create file buffer");
    }

    const { data } = await axios.post(
      `${process.env.UPLOAD_SERVICE}/api/utils/upload`,
      { buffer: fileBuffer.content }
    );

    const [attachment] = await sql`
      INSERT INTO job_attachments (job_id, file_name, file_url, file_public_id)
      VALUES (${jobId}, ${file.originalname}, ${data.url}, ${data.public_id})
      RETURNING attachment_id, file_name, file_url, uploaded_at
    `;

    await invalidateByPrefix(`${JOB_SINGLE_CACHE_PREFIX}${jobId}`);

    res.json({
      message: "Attachment uploaded successfully",
      attachment,
    });
  }
);


// This function fetch all companies created by the logged-in recruiter
export const getAllCompany = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const companies =
      await sql`SELECT * FROM companies WHERE recruiter_id = ${req.user?.user_id}`;

    res.json(companies);
  }
);


// This function fetches the details of a specific company by its ID, including all jobs associated with that company
export const getCompanyDetails = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    if (!id) {
      throw new ErrorHandler(400, "Company id is required");
    }

    const cacheKey = `${COMPANY_CACHE_PREFIX}${id}`;

    const cached = await getCache(cacheKey);

    if (cached) {
      return res.json(cached);
    }

    const [companyData] = await sql`SELECT c.*, COALESCE (
     (
       SELECT json_agg(j.*) FROM jobs j WHERE j.company_id = c.company_id
      ),
      '[]'::json
    ) AS jobs
     FROM companies c WHERE c.company_id = ${id} GROUP BY c.company_id;`;

    if (!companyData) {
      throw new ErrorHandler(404, "Company not found");
    }

    await setCache(cacheKey, companyData, 60);

    res.json(companyData);
  }
);


// This function fetches all active jobs, with optional filtering by title and location, and supports pagination
export const getAllActiveJobs = TryCatch(async (req, res) => {
  const { title, location, page, limit } = res.locals.validated.query as {
    title?: string;
    location?: string;
    page: number;
    limit: number;
  };

  const cacheKey = `${JOB_LIST_CACHE_PREFIX}${title || ""}:${location || ""}:${page}:${limit}`;

  const cached = await getCache(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  // Dynamic SQL Query Construction (Preventing Injection): It explicitly limits results to listings where is_active = true and performs an inner JOIN on the companies table 
  // using the alias c to map details like the corporate logo alongside the listing text
  let whereClause = ` FROM jobs j JOIN companies c ON j.company_id = c.company_id WHERE j.is_active = true`;

  // The values array is used to store the parameters for the SQL query, which will be substituted into the query string at the appropriate placeholders ($1, $2, etc.) to prevent SQL injection attacks
  const values: any[] = [];

  let paramIndex = 1;

  if (title) {
    whereClause += ` AND j.title ILIKE $${paramIndex}`;
    values.push(`%${title}%`);
    paramIndex++;
  }

  if (location) {
    whereClause += ` AND j.location ILIKE $${paramIndex}`;
    values.push(`%${location}%`);
    paramIndex++;
  }

  // Total Record Counting
  const countQuery = `SELECT COUNT(*)::int AS total${whereClause}`;
  const [{ total }] = (await sql.query(countQuery, values)) as {
    total: number;
  }[];

  // Fetching Paginated Data Rows:  Avoids using * macros. It explicitly names only the structural card metadata needed for search tiles to optimize downstream execution speeds
  const dataQuery = `SELECT j.job_id, j.title, j.description, j.salary, j.location, j.job_type, j.role, j.work_location, j.created_at, c.name AS company_name, c.logo AS company_logo, c.company_id AS company_id${whereClause} ORDER BY j.created_at DESC LIMIT $${paramIndex} OFFSET $${
    paramIndex + 1
  }`;

  // Executes the final page lookup query
  const jobs = (await sql.query(dataQuery, [
    ...values,
    limit,
    (page - 1) * limit,
  ])) as any[];

  const result = {
    data: jobs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };

  await setCache(cacheKey, result, 60);

  res.json(result);
});


// This function fetches the details of a specific job by its ID, including associated company information, rounds, tags, skills, questions, attachments, and the count of applicants
export const getSingleJob = TryCatch(async (req, res) => {
  const cacheKey = `${JOB_SINGLE_CACHE_PREFIX}${req.params.jobId}`;

  const cached = await getCache(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  const jobId = req.params.jobId;

  // LEFT JOIN, not JOIN: jobs created before this feature shipped have no
  // job_details row yet, and must still resolve instead of disappearing.
  // job_details.job_id is deliberately excluded from the select list below
  // (not jd.*) — it's the same PK as jobs.job_id and would otherwise
  // silently overwrite it with NULL for every pre-migration job.
  const [job] = await sql`
    SELECT j.*, c.name AS company_name, c.logo AS company_logo,
      jd.apply_by, jd.role_type, jd.min_hires, jd.expected_offers, jd.duration, jd.stipend,
      jd.ctc_min, jd.ctc_max, jd.qualification, jd.working_days, jd.category, jd.conversion_note,
      jd.eligible_gender, jd.eligible_grad_years, jd.criteria, jd.job_start_date, jd.date_of_visit,
      jd.internship_mode, jd.internship_start_date, jd.internship_duration, jd.internship_season,
      jd.last_modified_by, jd.updated_at
    FROM jobs j
    JOIN companies c ON j.company_id = c.company_id
    LEFT JOIN job_details jd ON jd.job_id = j.job_id
    WHERE j.job_id = ${jobId}`;

  if (!job) {
    throw new ErrorHandler(404, "Job not found");
  }

  // Parallelized Microservice Querying: Instead of using await on 6 separate lines—which would force our server to wait for Query 1 to completely finish before starting Query 2 (creating a slow network bottleneck),
  // the code leverages Promise.all to launch all 6 relational lookup requests at the exact same millisecond.
  const [rounds, tags, skills, questions, attachments, applicantCountRows] =
    await Promise.all([
      sql`SELECT round_id, round_order, name, description FROM job_rounds WHERE job_id = ${jobId} ORDER BY round_order ASC`,
      sql`SELECT tag FROM job_tags WHERE job_id = ${jobId}`,
      sql`SELECT skill FROM job_skills WHERE job_id = ${jobId}`,
      sql`SELECT question_id, question_order, question_text FROM job_questions WHERE job_id = ${jobId} ORDER BY question_order ASC`,
      sql`SELECT attachment_id, file_name, file_url, uploaded_at FROM job_attachments WHERE job_id = ${jobId}`,
      sql`SELECT COUNT(*)::int AS applicant_count FROM applications WHERE job_id = ${jobId}`,
    ]);

  job.rounds = rounds;
  job.tags = (tags as any[]).map((t) => t.tag);
  job.skills = (skills as any[]).map((s) => s.skill);
  job.questions = questions;
  job.attachments = attachments;
  job.applicant_count = (applicantCountRows as any[])[0]?.applicant_count ?? 0;

  await setCache(cacheKey, job, 60);

  res.json(job);
});


// This function fetches all applications for a specific job, including applicant details and their answers to the recruiter's questions
export const getAllApplicationForJob = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    if (user.role !== "recruiter" && user.role !== "admin") {
      throw new ErrorHandler(403, "Only recruiters can access this");
    }

    const { jobId } = req.params;

    const [job] = await sql`
    SELECT posted_by_recuriter_id FROM jobs WHERE job_id = ${jobId}
    `;

    if (!job) {
      throw new ErrorHandler(404, "Job not found");
    }

    if (job.posted_by_recuriter_id !== user.user_id && user.role !== "admin") {
      throw new ErrorHandler(403, "You do not have permission to perform this action");
    }

    const { page, limit } = res.locals.validated.query as {
      page: number;
      limit: number;
    };

    // Total Record Counting
    const [{ total }] = (await sql`
      SELECT COUNT(*)::int AS total FROM applications WHERE job_id = ${jobId}
    `) as { total: number }[];

    // Calculates the absolute total number of applications submitted for this job opening
    const applications = await sql`
      SELECT a.*, u.name AS applicant_name, u.profile_pic AS applicant_profile_pic
      FROM applications a
      JOIN users u ON u.user_id = a.applicant_id
      WHERE a.job_id = ${jobId}
      ORDER BY a.subscribed DESC, a.applied_at ASC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `;

    // Attach each applicant's answers to the recruiter's own questions.
    // Applications made before the questions feature shipped simply carry an empty array.
    if (applications.length > 0) {
      const applicationIds = applications.map(
        (a: any) => a.application_id
      ) as number[];

      // Fetches all answers for the applications in a single query, joining with job_questions to get the question text and order
      const answers = (await sql`
        SELECT aa.application_id, aa.question_id, aa.answer_text,
               jq.question_text, jq.question_order
        FROM application_answers aa
        JOIN job_questions jq ON aa.question_id = jq.question_id
        WHERE aa.application_id = ANY(${applicationIds})
        ORDER BY jq.question_order ASC
      `) as any[];

      // Creates an in-memory Hash Map indexed by application_id. It loops through the flat database array of answers and groups them together cleanly by their application ID inside memory
      const byApplication = new Map<number, any[]>();
      for (const answer of answers) {
        const list = byApplication.get(answer.application_id) ?? [];
        list.push(answer);
        byApplication.set(answer.application_id, list);
      }

      // It loops over the main list of 10 candidates, matches their .application_id instantly against our in-memory map, and attaches a custom .answers array directly to each candidate row. 
      // If a candidate applied before the screening questions feature launched, it gracefully attaches an empty fallback array[]
      for (const application of applications as any[]) {
        application.answers =
          byApplication.get(application.application_id) ?? [];
      }
    }

    res.json({
      data: applications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });
  }
);


// This function fetches all jobs in the system for admin users, with pagination support
export const adminListAllJobs = TryCatch(async (req, res) => {
  const { page, limit } = res.locals.validated.query as {
    page: number;
    limit: number;
  };

  // Total Record Counting
  const [{ total }] = (await sql`
    SELECT COUNT(*)::int AS total FROM jobs
  `) as { total: number }[];

  const jobs = await sql`
    SELECT j.*, c.name AS company_name, c.recruiter_id
    FROM jobs j JOIN companies c ON j.company_id = c.company_id
    ORDER BY j.created_at DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `;

  res.json({
    data: jobs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
});


// This function fetches all companies in the system for admin users, with pagination support
export const adminListAllCompanies = TryCatch(async (req, res) => {
  const { page, limit } = res.locals.validated.query as {
    page: number;
    limit: number;
  };

  // Total Record Counting
  const [{ total }] = (await sql`
    SELECT COUNT(*)::int AS total FROM companies
  `) as { total: number }[];

  // Fetching Profiles & Aggregating Metrics
  const companies = await sql`
    SELECT company_id, name, description, website, logo, recruiter_id, created_at,
      (SELECT COUNT(*)::int FROM jobs j WHERE j.company_id = c.company_id) AS job_count
    FROM companies c
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `;

  res.json({
    data: companies,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
});


// This function allows an admin user to set the active status of a job, enabling or disabling its visibility to applicants
export const adminSetJobActive = TryCatch(async (req, res) => {
  const { jobId } = req.params;
  const { is_active } = req.body;

  const [job] =
    await sql`UPDATE jobs SET is_active = ${is_active} WHERE job_id = ${jobId} RETURNING *`;

  if (!job) {
    throw new ErrorHandler(404, "Job not found");
  }

  await Promise.all([
    invalidateByPrefix(JOB_LIST_CACHE_PREFIX),
    invalidateByPrefix(`${JOB_SINGLE_CACHE_PREFIX}${jobId}`),
    invalidateByPrefix(`${COMPANY_CACHE_PREFIX}${job.company_id}`),
  ]);

  res.json({ message: "Job moderation status updated", job });
});


// This function allows a recruiter or admin to update the status of an application, such as marking it as accepted, rejected, or in progress. 
// It also sends an email notification to the applicant about the status change.
export const updateApplication = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    if (user.role !== "recruiter" && user.role !== "admin") {
      throw new ErrorHandler(403, "Only recruiters can access this");
    }

    const { id } = req.params;

    const [application] =
      await sql`SELECT * FROM applications WHERE application_id = ${id}`;

    if (!application) {
      throw new ErrorHandler(404, "Application not found");
    }

    const [job] =
      await sql`SELECT posted_by_recuriter_id, title FROM jobs WHERE job_id = ${application.job_id}`;

    if (!job) {
      throw new ErrorHandler(404, "Job not found");
    }

    if (job.posted_by_recuriter_id !== user.user_id && user.role !== "admin") {
      throw new ErrorHandler(403, "You do not have permission to perform this action");
    }

    const [updatedApplication] =
      await sql`UPDATE applications SET status = ${req.body.status} WHERE application_id = ${id} RETURNING *`;

    const message = {
      to: application.applicant_email,
      subject: "Application Update - Job portal",
      html: applicationStatusUpdateTemplate(job.title),
    };

    publishToTopic("send-mail", message).catch((error) => {
      console.error("Failed to publish message to kafka", error);
    });

    res.json({
      message: "Application updated",
      job,
      updatedApplication,
    });
  }
);

// Shared by getApplicationSummary and getApplicationHistory (and reused by the gateway's socket-join check once the WebSocket phase lands) so the
// "who's allowed to see this application" rule only lives in one place.

// Its job is to check if a logged-in user has the legal right to view or modify a specific job application before your server processes any changes.
// Instead of copy-pasting the same security checks across multiple files (like viewApplication, updateStatus, or deleteApplication), developers create a helper function like resolveApplicationAccess to centralized authorization logic
async function resolveApplicationAccess(applicationId: string, user: { user_id: number; role: string }) {

  // Fetching the Relationship Blueprint: Performs join between applications and jobs to get the applicant_id(jobseeker who submitted the application) and posted_by_recuriter_id(who posted the job listing) for the given applicationId
  const [application] = await sql`
    SELECT a.application_id, a.job_id, a.applicant_id, j.posted_by_recuriter_id
    FROM applications a
    JOIN jobs j ON a.job_id = j.job_id
    WHERE a.application_id = ${applicationId}
  `;

  if (!application) {
    throw new ErrorHandler(404, "Application not found");
  }

  // Evaluating Access Permissions: Only person who submitted the application, the recruiter who posted the job, or an admin can access it
  const isOwner =
    application.applicant_id === user.user_id ||
    application.posted_by_recuriter_id === user.user_id ||
    user.role === "admin";

  if (!isOwner) {
    throw new ErrorHandler(403, "You do not have permission to perform this action");
  }

  return application;
}


// This function fetches a summary of a specific application, including its ID, associated job ID, and applicant ID
export const getApplicationSummary = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    const application = await resolveApplicationAccess(
      req.params.id as string,
      req.user
    );

    res.json({
      application_id: application.application_id,
      job_id: application.job_id,
      applicant_id: application.applicant_id,
    });
  }
);


// This function fetches the history of a specific application, including the stages it has gone through, their statuses, and any notes associated with each stage
export const getApplicationHistory = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    const application = await resolveApplicationAccess(
      req.params.id as string,      // Application ID from the request parameters
      req.user                      // Logged-in user object from the request
    );

    // Running the Chronological History Query
    const history = await sql`
      SELECT history_id, round_id, stage_name, status, note, changed_at
      FROM application_stage_history
      WHERE application_id = ${application.application_id}
      ORDER BY changed_at ASC
    `;

    res.json({ data: history });
  }
);


// This function allows a recruiter or admin to update the stage of one or more applications, including the round, status, and optional note. 
// It also handles updating the overall application status if the final round is completed or rejected.
export const updateApplicationStage = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    if (user.role !== "recruiter" && user.role !== "admin") {
      throw new ErrorHandler(403, "Only recruiters can access this");
    }

    const { applicationIds, round_id, status, note } = req.body as {
      applicationIds: number[];
      round_id: number;
      status: "upcoming" | "in_progress" | "completed" | "rejected";
      note?: string;
    };

    const [round] =
      await sql`SELECT round_id, job_id, round_order, name FROM job_rounds WHERE round_id = ${round_id}`;

    if (!round) {
      throw new ErrorHandler(404, "Round not found");
    }

    const [job] =
      await sql`SELECT posted_by_recuriter_id, title FROM jobs WHERE job_id = ${round.job_id}`;

    if (!job) {
      throw new ErrorHandler(404, "Job not found");
    }

    if (job.posted_by_recuriter_id !== user.user_id && user.role !== "admin") {
      throw new ErrorHandler(403, "You do not have permission to perform this action");
    }

    // Defense against a recruiter passing an application id from a
    // different job: only applications that actually belong to this
    // round's job are matched.
    const applications = await sql`
      SELECT application_id, applicant_email, job_id FROM applications
      WHERE application_id = ANY(${applicationIds}) AND job_id = ${round.job_id}
    `;

    if (applications.length === 0) {
      throw new ErrorHandler(404,"No matching applications found for this job");
    }

    // A round being "completed" only means the whole application is Hired
    // if it's the pipeline's last round; an intermediate round completing
    // doesn't change the overall Submitted/Rejected/Hired outcome.
    const [{ max_order }] = (await sql`
      SELECT MAX(round_order)::int AS max_order FROM job_rounds WHERE job_id = ${round.job_id}
    `) as { max_order: number }[];

    const isFinalRound = round.round_order === max_order;

    let syncedStatus: "Hired" | "Rejected" | null = null;
    if (status === "rejected") {
      syncedStatus = "Rejected";
    } else if (status === "completed" && isFinalRound) {
      syncedStatus = "Hired";
    }

    const historyInserts = (applications as any[]).map(
      (app) =>
        sql`INSERT INTO application_stage_history (application_id, round_id, stage_name, status, note, changed_by)
            VALUES (${app.application_id}, ${round.round_id}, ${round.name}, ${status}, ${note ?? null}, ${user.user_id})`
    );

    const updateStatements = (applications as any[]).map((app) =>
      syncedStatus
        ? sql`UPDATE applications SET current_round_id = ${round.round_id}, status = ${syncedStatus} WHERE application_id = ${app.application_id}`
        : sql`UPDATE applications SET current_round_id = ${round.round_id} WHERE application_id = ${app.application_id}`
    );

    await sql.transaction([...historyInserts, ...updateStatements] as any);

    await invalidateByPrefix(`${JOB_SINGLE_CACHE_PREFIX}${round.job_id}`);

    // Fire-and-forget audit event, same best-effort style as the existing
    // send-mail publish above — never blocks the recruiter's response.
    // The realtime socket push and email notification are wired up in the
    // WebSocket phase; this event is there for them to consume later.
    for (const app of applications as any[]) {
      publishToTopic("application-stage-updated", {
        application_id: app.application_id,
        job_id: round.job_id,
        round_id: round.round_id,
        stage_name: round.name,
        status,
        note: note ?? null,
        changed_at: new Date().toISOString(),
      }).catch((error) => {
        console.error("Failed to publish stage-update event to kafka", error);
      });
    }

    res.json({
      message: "Application stage updated",
      updated: applications.length,
    });
  }
);
