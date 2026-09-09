import app from "./app.js";
import dotenv from "dotenv";
import { sql } from "./utils/db.js";
import { connectKafka } from "./producer.js";

dotenv.config();

connectKafka();

async function initDB() {
  try {
    // Create PostgreSQL enum types:
    await sql`
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_type') THEN 
        CREATE TYPE job_type AS ENUM ('Full-time', 'Part-time', 'Contract', 'Internship');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'work_location') THEN 
        CREATE TYPE work_location AS ENUM ('On-site', 'Remote', 'Hybrid');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'application_status') THEN
        CREATE TYPE application_status AS ENUM ('Submitted', 'Rejected', 'Hired');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stage_status') THEN
        CREATE TYPE stage_status AS ENUM ('upcoming', 'in_progress', 'completed', 'rejected');
        END IF;
    END$$;
    `;


    // This stores recruiter-created companies
    await sql`
    CREATE TABLE IF NOT EXISTS companies (
    company_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    website VARCHAR(255) NOT NULL,
    logo VARCHAR(255) NOT NULL,
    logo_public_id VARCHAR(255) NOT NULL,
    recruiter_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    `;


    // This stores the jobs posted by recruiters
    await sql`
    CREATE TABLE IF NOT EXISTS jobs(
    job_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    salary NUMERIC(10,2),
    location VARCHAR(255),
    job_type job_type NOT NULL,
    openings NUMERIC(3,1) NOT NULL,
    role VARCHAR(255) NOT NULL,
    work_location work_location NOT NULL,
    company_id INTEGER NOT NULL REFERENCES companies(company_id) ON DELETE CASCADE,
    posted_by_recuriter_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
    )
    `;


    // This stores the applications submitted by jobseekers and connects a job seeker with a job
    await sql`
    CREATE TABLE IF NOT EXISTS applications(
    application_id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    applicant_id INTEGER NOT NULL,
    applicant_email VARCHAR(255) NOT NULL,
    status application_status NOT NULL DEFAULT 'Submitted',
    resume VARCHAR(255) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subscribed BOOLEAN,
    UNIQUE (job_id, applicant_id)
    )
    `;

    // --- Job Detail / Tracker feature tables (additive, all nullable/new) ---

    // This table stores additional details about a job, which are not part of the main jobs table. It is a one-to-one relationship with the jobs table, where each job can have one set of details.
    await sql`
    CREATE TABLE IF NOT EXISTS job_details (
    job_id INTEGER PRIMARY KEY REFERENCES jobs(job_id) ON DELETE CASCADE,
    apply_by TIMESTAMPTZ,
    role_type VARCHAR(50),
    min_hires INTEGER,
    expected_offers INTEGER,
    duration VARCHAR(100),
    stipend NUMERIC(10,2),
    ctc_min NUMERIC(10,2),
    ctc_max NUMERIC(10,2),
    qualification TEXT,
    working_days VARCHAR(100),
    category VARCHAR(100),
    conversion_note VARCHAR(255),
    eligible_gender VARCHAR(50),
    eligible_grad_years VARCHAR(100),
    criteria TEXT,
    job_start_date TIMESTAMPTZ,
    date_of_visit TIMESTAMPTZ,
    internship_mode VARCHAR(50),
    internship_start_date TIMESTAMPTZ,
    internship_duration VARCHAR(100),
    internship_season VARCHAR(100),
    last_modified_by INTEGER,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    `;


    // This table stores the hiring rounds for a job 
    await sql`
    CREATE TABLE IF NOT EXISTS job_rounds (
    round_id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    round_order INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    UNIQUE (job_id, round_order)
    )
    `;


    // This table stores the tags for each hiring round of a job 
    await sql`
    CREATE TABLE IF NOT EXISTS job_tags (
    tag_id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL
    )
    `;


    // This table stores the skills required for a job 
    await sql`
    CREATE TABLE IF NOT EXISTS job_skills (
    job_skill_id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    skill VARCHAR(100) NOT NULL
    )
    `;


    // This table stores the questions for each job, which can be used to assess the applicants
    await sql`
    CREATE TABLE IF NOT EXISTS job_questions (
    question_id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    question_order INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    UNIQUE (job_id, question_order)
    )
    `;


    // This table stores the answers provided by applicants for the questions of a job
    await sql`
    CREATE TABLE IF NOT EXISTS job_attachments (
    attachment_id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_public_id VARCHAR(255),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    `;


    // This table stores the history of application stages for each application, which can be used to track the progress of an application through the hiring process
    await sql`
    CREATE TABLE IF NOT EXISTS application_stage_history (
    history_id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
    round_id INTEGER REFERENCES job_rounds(round_id) ON DELETE SET NULL,
    stage_name VARCHAR(255) NOT NULL,
    status stage_status NOT NULL DEFAULT 'upcoming',
    note TEXT,
    changed_by INTEGER,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    `;


    // This column stores the current round of an application, which can be used to determine the next steps for the applicant
    await sql`
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS current_round_id INTEGER REFERENCES job_rounds(round_id)
    `;

    // Applicant-supplied label for the attached resume (e.g. "Backend
    // resume v3"). Nullable: applications made before this feature have no
    // name, and the UI falls back to the file name in that case.

    // This column stores the name of the resume file uploaded by the applicant, which can be used to display the file name in the application details
    await sql`
    ALTER TABLE applications ADD COLUMN IF NOT EXISTS resume_name VARCHAR(255)
    `;


    // Stores a jobseeker's answers to the recruiter-defined questions on a
    // job. Every application created after this table exists has one row
    // per job_questions row for its job.

    // This table stores the answers provided by applicants for the questions of a job
    await sql`
    CREATE TABLE IF NOT EXISTS application_answers (
    answer_id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES job_questions(question_id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (application_id, question_id)
    )
    `;


    // Index to speed up queries that fetch all answers for a given application
    await sql`
    CREATE INDEX IF NOT EXISTS idx_application_answers_application
    ON application_answers (application_id)
    `;

    console.log(
      "Job service database tables checked and created successfully."
    );
    
  } catch (error) {
    console.log("Error while creating tables", error);
    process.exit(1);
  }
}

initDB().then(() => {
  app.listen(process.env.PORT, () => {
    console.log(
      `Job service is running on http://localhost:${process.env.PORT}`
    );
  });
});
