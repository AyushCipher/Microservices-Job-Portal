import app from "./app.js";
import dotenv from "dotenv";
import { sql } from "./utils/db.js";
import "./utils/redisClient.js";

dotenv.config();

async function initDb() {
  try {
    // Create a PostgreSQL enum type called "user_role" with two possible values: 'jobseeker' and 'recruiter'. This is used to enforce that the role field in the users table can only take one of these two values.
    await sql`
    DO $$
    BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
          CREATE TYPE user_role AS ENUM ('jobseeker', 'recruiter');
       END IF;
    END$$;
    `;

    // Does the user_role enum already contain admin?
    // ALTER TYPE ... ADD VALUE cannot run inside a DO block/transaction, so
    // this check-then-add has to happen as two separate top-level statements.
    const [{ exists: adminRoleExists }] = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'admin'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
      ) AS exists
    `;

    if (!adminRoleExists) {
      await sql`ALTER TYPE user_role ADD VALUE 'admin'`;
    }

    await sql`
      CREATE TABLE IF NOT EXISTS users (
         user_id SERIAL PRIMARY KEY,
         name VARCHAR(255) NOT NULL,
         email VARCHAR(255) NOT NULL UNIQUE,
         password VARCHAR(255) NOT NULL,
         phone_number VARCHAR(20) NOT NULL,
         role user_role NOT NULL,
         bio TEXT,
         resume VARCHAR(255),
         resume_public_id VARCHAR(255),
         profile_pic VARCHAR(255),
         profile_pic_public_id VARCHAR(255),
         created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
         subscription TIMESTAMPTZ
      )
    `;

    await sql`
     CREATE TABLE IF NOT EXISTS skills (
       skill_id SERIAL PRIMARY KEY,
       name VARCHAR(100) NOT NULL UNIQUE
     )
    `;

    await sql`
    CREATE TABLE IF NOT EXISTS user_skills(
       user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
       skill_id INTEGER NOT NULL REFERENCES skills(skill_id) ON DELETE CASCADE,
       PRIMARY KEY (user_id, skill_id)
    )
    `;
    console.log("✅ Database tables checked/created successfully");
  } catch (error) {
    console.log("❌ Error initializing database", error);
    process.exit(1);
  }
}

initDb().then(() => {
  app.listen(process.env.PORT, () => {
    console.log(
      `Auth service is running on http://localhost:${process.env.PORT}`
    );
  });
});
