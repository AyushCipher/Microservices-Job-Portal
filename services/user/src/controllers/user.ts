import axios from "axios";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import getBuffer from "../utils/buffer.js";
import { sql } from "../utils/db.js";
import { ErrorHandler, TryCatch } from "@hireheaven/common";
import { cache } from "../utils/redisClient.js";

const { getCache, setCache, invalidateKey: invalidateCache } = cache;

const userProfileCacheKey = (userId: string | number) =>
  `cache:user:profile:${userId}`;         // This prevents different parts of the application from inventing different key formats


// This function is intended for an admin to retrieve users
export const adminListUsers = TryCatch(async (req, res) => {
  const { page, limit } = res.locals.validated.query as {
    page: number;
    limit: number;
  };

  const [{ total }] = (await sql`
    SELECT COUNT(*)::int AS total FROM users
  `) as { total: number }[];

  // This retrieves only the current requested page 
  const users = await sql`
    SELECT user_id, name, email, phone_number, role, created_at, subscription
    FROM users
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `;

  res.json({
    data: users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
});


// Gets the currently authenticated user's profile
export const myProfile = TryCatch(
  async (req: AuthenticatedRequest, res, next) => {
    const user = req.user;

    res.json(user);
  }
);


// Retrieves another user's profile
export const getUserProfile = TryCatch(async (req, res, next) => {
  const { userId } = req.params;

  const cacheKey = userProfileCacheKey(userId as string);

  const cached = await getCache(cacheKey);

  if (cached) {
    return res.json(cached);
  }

  const users = await sql`
        SELECT u.user_id, u.name, u.email, u.phone_number, u.role, u.bio, u.resume, u.resume_public_id, u.profile_pic, u.profile_pic_public_id, u.subscription,
        ARRAY_AGG(s.name) FILTER (WHERE s.name IS NOT NULL) as skills
        FROM users u LEFT JOIN user_skills us ON u.user_id = us.user_id
        LEFT JOIN skills s ON us.skill_id = s.skill_id
        WHERE u.user_id = ${userId}
        GROUP BY u.user_id;
        `;

  if (users.length === 0) {
    throw new ErrorHandler(404, "User not found");
  }

  const user = users[0];

  user.skills = user.skills || [];

  await setCache(cacheKey, user, 60);

  res.json(user);
});


// Updates the currently authenticated user's profile
export const updateUserProfile = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    const { name, phoneNumber, bio } = req.body;

    const newName = name || user.name;
    const newPhoneNumber = phoneNumber || user.phone_number;
    const newBio = bio || user.bio;

    const [updatedUser] = await sql`
    UPDATE users SET name = ${newName}, phone_number = ${newPhoneNumber}, bio = ${newBio}
    WHERE user_id = ${user.user_id}
    RETURNING user_id, name, email, phone_number, bio
    `;

    await invalidateCache(userProfileCacheKey(user.user_id));

    res.json({
      message: "Profile updated successfully",
      updatedUser,
    });
  }
);


// Updates the currently authenticated user's profile picture
export const updateProfilePic = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    const file = req.file;

    if (!file) {
      throw new ErrorHandler(400, "No image file provided");
    }

    // Gets the existing profile picture's public ID
    const oldPublicId = user.profile_pic_public_id;

    // Generates a buffer from the uploaded file to send to the upload service
    const fileBuffer = getBuffer(file);

    if (!fileBuffer || !fileBuffer.content) {
      throw new ErrorHandler(500, "Failed to generate file buffer");
    }

    const { data: uploadResult } = await axios.post(
      `${process.env.UPLOAD_SERVICE}/api/utils/upload`,
      {
        buffer: fileBuffer.content,
        public_id: oldPublicId,
      }
    );

    const [updatedUser] = await sql`
    UPDATE users SET profile_pic = ${uploadResult.url}, profile_pic_public_id = ${uploadResult.public_id} WHERE user_id = ${user.user_id} RETURNING user_id, name, profile_pic;
    `;

    await invalidateCache(userProfileCacheKey(user.user_id));

    res.json({
      message: "Profile picture updated successfully",
      updatedUser,
    });
  }
);


// Updates the currently authenticated user's resume
export const updateResume = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;

  if (!user) {
    throw new ErrorHandler(401, "Authentication required");
  }

  const file = req.file;

  if (!file) {
    throw new ErrorHandler(400, "No PDF file provided");
  }

  const oldPublicId = user.resume_public_id;

  const fileBuffer = getBuffer(file);

  if (!fileBuffer || !fileBuffer.content) {
    throw new ErrorHandler(500, "Failed to generate file buffer");
  }

  const { data: uploadResult } = await axios.post(
    `${process.env.UPLOAD_SERVICE}/api/utils/upload`,
    {
      buffer: fileBuffer.content,
      public_id: oldPublicId,
    }
  );

  const [updatedUser] = await sql`
    UPDATE users SET resume = ${uploadResult.url}, resume_public_id = ${uploadResult.public_id} WHERE user_id = ${user.user_id} RETURNING user_id, name, resume;
    `;

  await invalidateCache(userProfileCacheKey(user.user_id));

  res.json({
    message: "Resume updated",
    updatedUser,
  });
});


// Adds a skill to the currently authenticated user's profile
export const addSkillToUser = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const userId = req.user?.user_id;
    const { skillName } = req.body;

    if (!skillName || skillName.trim() === "") {
      throw new ErrorHandler(400, "Please provide a skill name");
    }

    let wasSkillAdded = false;

    try {
      await sql`BEGIN`;

      const users =
        await sql`SELECT user_id FROM users WHERE user_id = ${userId}`;

      if (users.length === 0) {
        throw new ErrorHandler(404, "User not found");
      }

      const [skill] =
        await sql`INSERT INTO skills (name) VALUES (${skillName.trim()}) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING skill_id`;

      const skillId = skill.skill_id;

      // Inserts a new row into the user_skills table to associate the skill with the user(User 42 → React). If the user already has this skill, the ON CONFLICT clause prevents a duplicate entry.
      const insertionResult =
        await sql`INSERT INTO user_skills (user_id, skill_id) VALUES (${userId}, ${skillId}) ON CONFLICT (user_id, skill_id) DO NOTHING RETURNING user_id`;

      if (insertionResult.length > 0) {
        wasSkillAdded = true;
      }

      await sql`COMMIT`;

    } catch (error) {
      await sql`ROLLBACK`;
      throw error;
    }

    await invalidateCache(userProfileCacheKey(userId as number));

    if (!wasSkillAdded) {
      return res.status(200).json({
        message: "User already possesses this skill",
      });
    }

    res.json({
      message: `Skill ${skillName.trim()} is added successfully`,
    });
  }
);


// Deletes a skill(skill relationship) from the currently authenticated user's profile
export const deleteSkillFromUser = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
      throw new ErrorHandler(401, "Authentication required");
    }

    const { skillName } = req.body;

    if (!skillName || skillName.trim() === "") {
      throw new ErrorHandler(400, "Please provide a skill name");
    }

    // Deletes the skill relationship from the user_skills table
    const result = await sql`DELETE FROM user_skills WHERE user_id = ${
      user.user_id
    } AND skill_id = (SELECT skill_id FROM skills WHERE name = ${skillName.trim()}) RETURNING user_id;`;

    if (result.length === 0) {
      throw new ErrorHandler(404, `Skill ${skillName.trim()} was not found`);
    }

    await invalidateCache(userProfileCacheKey(user.user_id));

    res.json({
      message: `Skill ${skillName.trim()} was deleted successfully`,
    });
  }
);


// Applies for a job as the currently authenticated user
export const applyForJob = TryCatch(async (req: AuthenticatedRequest, res) => {
  const user = req.user;

  if (!user) {
    throw new ErrorHandler(401, "Authentication required");
  }

  if (user.role !== "jobseeker") {
    throw new ErrorHandler(403, "You do not have permission to perform this action");
  }

  const applicant_id = user.user_id;

  const resume = user.resume;

  if (!resume) {
    throw new ErrorHandler(
      400,
      "You need to add resume in your profile to apply for this job"
    );
  }

  const { job_id, answers, resume_name } = req.body as {
    job_id: number;
    answers: { question_id: number; answer_text: string }[];
    resume_name?: string;
  };

  if (!job_id) {
    throw new ErrorHandler(400, "Job id is required");
  }

  const [job] = await sql`SELECT is_active FROM jobs WHERE job_id = ${job_id}`;

  if (!job) {
    throw new ErrorHandler(404, "Job not found");
  }

  if (!job.is_active) {
    throw new ErrorHandler(400, "Job is not active");
  }

  // Every recruiter-defined question is mandatory. Answers are matched by question_id against this job's own questions so a client can't smuggle in
  // answers belonging to a different job.
  const jobQuestions = (await sql`
    SELECT question_id FROM job_questions WHERE job_id = ${job_id}
  `) as { question_id: number }[];

  // Creates a map of question_id to answer_text for quick lookup. This allows us to easily check if all required questions have been answered.
  // Example: { 1: "I have 2 years of experience", 2: "B.Tech" }
  const answerByQuestionId = new Map(
    (answers ?? []).map((a) => [Number(a.question_id), a.answer_text.trim()])
  );

  // Checks if any required question is missing an answer. If so, it throws an error indicating that all questions must be answered before applying.
  const missing = jobQuestions.filter(
    (q) => !answerByQuestionId.get(q.question_id)
  );

  if (missing.length > 0) {
    throw new ErrorHandler(
      400,
      `Please answer all ${jobQuestions.length} question${
        jobQuestions.length === 1 ? "" : "s"
      } before applying`
    );
  }

  // Checks if the user has an active subscription
  const now = Date.now();

  // If the user has a subscription, it converts the subscription date to milliseconds since Unix epoch
  const subTime = req.user?.subscription
    ? new Date(req.user.subscription).getTime()
    : 0;

  // If the user has an active subscription, the subscribed flag will be set to true
  const isSubscribed = subTime > now;

  let newApplication;

  try {
    [newApplication] =
      await sql`INSERT INTO applications (job_id, applicant_id, applicant_email, resume, resume_name, subscribed) VALUES (${job_id}, ${applicant_id}, ${user?.email}, ${resume}, ${resume_name ?? null}, ${isSubscribed}) RETURNING *`;
  } catch (error: any) {
    if (error.code === "23505") {
      throw new ErrorHandler(409, "You have already applied to this job");
    }
    throw error;
  }

  // Persist the answers alongside the application. If this fails the
  // application row would be left without the answers the recruiter requires,
  // so roll it back rather than leaving a half-recorded application behind.
  // Only insert answers if the job actually has questions
  if (jobQuestions.length > 0) {
    try {
      await sql.transaction(
        jobQuestions.map(
          (q) =>
            sql`INSERT INTO application_answers (application_id, question_id, answer_text) VALUES (${newApplication.application_id}, ${q.question_id}, ${answerByQuestionId.get(q.question_id)})`
        ) as any
      );

    } catch (error) {
      console.error("Failed to save application answers, rolling back", error);
      await sql`DELETE FROM applications WHERE application_id = ${newApplication.application_id}`;
      throw new ErrorHandler(
        500,
        "Failed to save your answers, please try again"
      );
    }
  }

  // Seed the Tracker timeline's first entry. Jobs created before the
  // hiring-rounds feature shipped have no job_rounds rows yet — the apply
  // still succeeds, the Tracker just has nothing to show until the
  // recruiter defines a pipeline for that job.

  // This section initializes the application's first hiring round. It finds the first hiring round configured for this job 
  const [firstRound] =
    await sql`SELECT round_id, name FROM job_rounds WHERE job_id = ${job_id} AND round_order = 1`;

  if (firstRound) {
    await sql`INSERT INTO application_stage_history (application_id, round_id, stage_name, status, changed_by)
      VALUES (${newApplication.application_id}, ${firstRound.round_id}, ${firstRound.name}, 'in_progress', ${applicant_id})`;

    await sql`UPDATE applications SET current_round_id = ${firstRound.round_id} WHERE application_id = ${newApplication.application_id}`;
  }

  res.json({
    message: "Applied for job successfully",
    application: newApplication,
  });
});


// Retrieves all applications for the currently authenticated user
export const getAllaplications = TryCatch(
  async (req: AuthenticatedRequest, res) => {
    const { page, limit } = res.locals.validated.query as {
      page: number;
      limit: number;
    };

    // Counts only applications belonging to the current user
    const [{ total }] = (await sql`
      SELECT COUNT(*)::int AS total FROM applications WHERE applicant_id = ${req.user?.user_id}
    `) as { total: number }[];

    // Retrieves only the current requested page of applications for the current user. 
    const applications = await sql`
    SELECT a.*, j.title AS job_title, j.salary AS job_salary, j.location AS job_location,
      j.job_type AS job_type, j.is_active AS job_is_active,
      c.name AS company_name, c.logo AS company_logo
    FROM applications a
    JOIN jobs j ON a.job_id = j.job_id
    JOIN companies c ON j.company_id = c.company_id
    WHERE a.applicant_id = ${req.user?.user_id}
    ORDER BY a.applied_at DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `;

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