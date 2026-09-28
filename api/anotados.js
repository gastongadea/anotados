const { neon } = require('@neondatabase/serverless');

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 14;

let sql = null;

function getSql() {
  if (sql) return sql;
  const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no configurada');
  sql = neon(url);
  return sql;
}

function diasEntre(from, to) {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Solo lectura' });
  }

  const { from, to } = req.query || {};
  if (!ISO.test(from || '') || !ISO.test(to || '')) {
    return res.status(400).json({ success: false, error: 'Parámetros from y to (YYYY-MM-DD) requeridos' });
  }
  const rango = diasEntre(from, to);
  if (!(rango >= 0 && rango <= MAX_DIAS)) {
    return res.status(400).json({ success: false, error: `Rango inválido (máximo ${MAX_DIAS} días)` });
  }

  try {
    const db = getSql();
    const rows = await db`
      SELECT fecha::text AS fecha, comida, iniciales, opcion
      FROM inscripciones
      WHERE fecha >= ${from}::date
        AND fecha <= ${to}::date
        AND opcion <> ''
      ORDER BY fecha, comida, iniciales
    `;
    return res.status(200).json({ success: true, rows });
  } catch (error) {
    console.error('anotados:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};
