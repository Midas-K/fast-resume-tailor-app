const pool = require("../../db");
const { DOCX_MIME_TYPE } = require("./templateDocx");

async function listActiveTemplates() {
  const result = await pool.query(
    `
        SELECT
          id,
          name,
          description,
          file_name,
          mime_type,
          is_active,
          is_default,
          uploaded_by_admin_id,
          created_at
        FROM resume_templates
        WHERE is_active = true
        ORDER BY is_default DESC, created_at ASC
      `
  );

  return result.rows;
}

async function getActiveTemplateFile(templateId) {
  const result = await pool.query(
    `
        SELECT
          id,
          file_name,
          mime_type,
          file_data
        FROM resume_templates
        WHERE id = $1
          AND is_active = true
      `,
    [templateId]
  );

  return result.rows[0] || null;
}

async function getActiveTemplateForPreview(templateId) {
  const result = await pool.query(
    `
          SELECT
            id,
            name,
            file_name,
            mime_type,
            file_data
          FROM resume_templates
          WHERE id = $1
            AND is_active = true
        `,
    [templateId]
  );

  return result.rows[0] || null;
}

async function countActiveTemplates() {
  const result = await pool.query(
    `
          SELECT COUNT(*)::int AS count
          FROM resume_templates
          WHERE is_active = true
        `
  );

  return result.rows[0].count;
}

async function uploadTemplate({
  name,
  description,
  fileName,
  fileBuffer,
  isDefault,
  uploadedByAdminId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (isDefault) {
      await client.query(
        `
              UPDATE resume_templates
              SET is_default = false
              WHERE is_active = true
            `
      );
    }

    const inserted = await client.query(
      `
            INSERT INTO resume_templates (
              name,
              description,
              file_name,
              mime_type,
              file_data,
              is_active,
              is_default,
              uploaded_by_admin_id
            )
            VALUES ($1, $2, $3, $4, $5, true, $6, $7)
            RETURNING
              id,
              name,
              description,
              file_name,
              mime_type,
              is_active,
              is_default,
              uploaded_by_admin_id,
              created_at
          `,
      [
        name,
        description,
        fileName,
        DOCX_MIME_TYPE,
        fileBuffer,
        isDefault,
        uploadedByAdminId,
      ]
    );

    await client.query("COMMIT");

    return inserted.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getActiveTemplateById(templateId) {
  const result = await pool.query(
    `
          SELECT id
          FROM resume_templates
          WHERE id = $1
            AND is_active = true
        `,
    [templateId]
  );

  return result.rows[0] || null;
}

async function setDefaultTemplate(templateId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
            UPDATE resume_templates
            SET is_default = false
            WHERE is_active = true
          `
    );

    const updated = await client.query(
      `
            UPDATE resume_templates
            SET is_default = true
            WHERE id = $1
            RETURNING
              id,
              name,
              description,
              file_name,
              mime_type,
              is_active,
              is_default,
              uploaded_by_admin_id,
              created_at
          `,
      [templateId]
    );

    await client.query("COMMIT");

    return updated.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function removeTemplate(templateId) {
  const existing = await pool.query(
    `
        SELECT id, is_default
        FROM resume_templates
        WHERE id = $1
          AND is_active = true
      `,
    [templateId]
  );

  if (existing.rows.length === 0) {
    return null;
  }

  const wasDefault = existing.rows[0].is_default;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const removed = await client.query(
      `
          UPDATE resume_templates
          SET
            is_active = false,
            is_default = false
          WHERE id = $1
          RETURNING id, name
        `,
      [templateId]
    );

    if (wasDefault) {
      await client.query(
        `
            UPDATE resume_templates
            SET is_default = true
            WHERE id = (
              SELECT id
              FROM resume_templates
              WHERE is_active = true
              ORDER BY created_at DESC
              LIMIT 1
            )
          `
      );
    }

    await client.query("COMMIT");

    return removed.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listActiveTemplates,
  getActiveTemplateFile,
  getActiveTemplateForPreview,
  countActiveTemplates,
  uploadTemplate,
  getActiveTemplateById,
  setDefaultTemplate,
  removeTemplate,
};
