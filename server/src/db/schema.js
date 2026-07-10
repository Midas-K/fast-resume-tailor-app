const pool = require("./pool");

let hasCertificationsColumnReady = false;

const ensureResumeTemplateHasCertificationsColumn = async () => {
  if (hasCertificationsColumnReady) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS resume_templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_data BYTEA NOT NULL,
      is_active BOOLEAN DEFAULT true,
      is_default BOOLEAN DEFAULT false,
      has_certifications BOOLEAN DEFAULT true,
      uploaded_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE resume_templates
    ADD COLUMN IF NOT EXISTS has_certifications BOOLEAN DEFAULT true;
  `);

  await pool.query(`
    UPDATE resume_templates
    SET has_certifications = true
    WHERE has_certifications IS NULL;
  `);

  hasCertificationsColumnReady = true;
};

const createTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      account_type TEXT NOT NULL CHECK (account_type IN ('user', 'admin')),
      is_approved BOOLEAN DEFAULT false,
      approved_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      job_bid_style TEXT NOT NULL DEFAULT 'copy_generate' CHECK (
        job_bid_style IN ('copy_generate', 'build_resume')
      ),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS approved_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS job_bid_style TEXT NOT NULL DEFAULT 'copy_generate';
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash TEXT;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_history (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      account_type TEXT NOT NULL DEFAULT 'user',
      event_type TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      location TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT NOT NULL,
      education JSONB DEFAULT '[]'::jsonb,
      experience JSONB DEFAULT '[]'::jsonb,
      admin_prompt TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS admin_prompt TEXT DEFAULT '';
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
      company_name TEXT NOT NULL,
      role_name TEXT NOT NULL,
      normalized_company_name TEXT NOT NULL,
      normalized_role_name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(profile_id, normalized_company_name)
    );
  `);

  await pool.query(`
    ALTER TABLE applications
    DROP CONSTRAINT IF EXISTS applications_profile_id_normalized_company_name_normalized_role_name_key;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'applications_profile_id_normalized_company_name_key'
      ) THEN
        ALTER TABLE applications
        ADD CONSTRAINT applications_profile_id_normalized_company_name_key
        UNIQUE (profile_id, normalized_company_name);
      END IF;
    END $$;
  `);

  await ensureResumeTemplateHasCertificationsColumn();

  await pool.query(`
    ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS resume_template_id INTEGER REFERENCES resume_templates(id) ON DELETE SET NULL;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_applications_profile_id ON applications(profile_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_applications_repeat_check
    ON applications(profile_id, normalized_company_name, normalized_role_name);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_applications_profile_created
    ON applications(profile_id, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_approved_by_admin_id ON users(approved_by_admin_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_account_type ON users(account_type);
  `);
};

module.exports = {
  createTables,
  ensureResumeTemplateHasCertificationsColumn,
};
