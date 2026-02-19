const { pool } = require('../config/database');

class PromptTemplateRepository {
  async createTemplate(data) {
    const query = `
      INSERT INTO prompt_templates
      (template_key, version, description, template_text, variables, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      data.template_key,
      data.version,
      data.description || null,
      data.template_text,
      JSON.stringify(data.variables || []),
      data.is_active ?? true,
    ];

    const result = await pool.query(query, values);
    return result.rows[0] || null;
  }

  async listTemplates() {
    const result = await pool.query(
      `SELECT * FROM prompt_templates ORDER BY template_key ASC, version DESC`
    );
    return result.rows;
  }

  async getActiveTemplateByKey(templateKey) {
    const result = await pool.query(
      `
      SELECT * FROM prompt_templates
      WHERE template_key = $1 AND is_active = true
      ORDER BY version DESC
      LIMIT 1
      `,
      [templateKey]
    );

    return result.rows[0] || null;
  }
}

module.exports = PromptTemplateRepository;
