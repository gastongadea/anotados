const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 14;
const DIAS_CUMPLE = 30;
const SHEET_CUMPLES = process.env.GOOGLE_SHEET_ID
  || process.env.REACT_APP_GOOGLE_SHEET_ID
  || '1WrFLSer4NyYDjmuPqvyhagsWfoAr1NkgY7HQyHjF7a8';

let sql = null;

function getSql() {
  if (sql) return sql;
  const { neon } = require('@neondatabase/serverless');
  const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL no configurada');
  sql = neon(url);
  return sql;
}

function diasEntre(from, to) {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
}

/** S y A (antes) son misa. N, vacío o solo fiesta quedan en No. */
function misaSiNo(valor) {
  const v = String(valor == null ? '' : valor).trim().toUpperCase().replace(/\s+/g, '');
  const letra = v.startsWith('S') || v.startsWith('N') || v.startsWith('A') ? v[0] : '';
  return letra === 'S' || letra === 'A' ? 'Si' : 'No';
}

function hoyArgentina(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function sumarIso(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function isoCumple(year, month, day) {
  const dt = new Date(year, month - 1, day);
  if (dt.getMonth() !== month - 1 || dt.getDate() !== day) {
    return `${year}-${String(month).padStart(2, '0')}-28`;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseNacimiento(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number') {
    const utc = new Date((val - 25569) * 86400 * 1000);
    if (Number.isNaN(utc.getTime())) return null;
    return { day: utc.getUTCDate(), month: utc.getUTCMonth() + 1, year: utc.getUTCFullYear() };
  }
  const s = String(val).trim();
  const slash = s.split('/');
  if (slash.length >= 2) {
    const day = parseInt(slash[0], 10);
    const month = parseInt(slash[1], 10);
    let year = slash.length >= 3 ? parseInt(slash[2], 10) : null;
    if (year != null && year < 100) year = year >= 50 ? 1900 + year : 2000 + year;
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      return { day, month, year: Number.isNaN(year) ? null : year };
    }
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
  return null;
}

function esEncabezadoCumple(row) {
  if (!row || !row[0]) return false;
  const a = String(row[0]).trim().toLowerCase();
  const b = row[1] == null ? '' : String(row[1]).trim().toLowerCase();
  if (a === 'inicial' || a === 'iniciales' || a === 'nombre') return true;
  if (b === 'fecha' || b === 'fecha de nacimiento' || b === 'nacimiento') return true;
  return a === '' && b === '';
}

function parseCsv(text) {
  return String(text || '').trim().split(/\r?\n/).filter(Boolean).map((line) => {
    const cols = [];
    let cur = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const c = line[i];
      if (quoted) {
        if (c === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i += 1;
          } else quoted = false;
        } else cur += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') {
        cols.push(cur);
        cur = '';
      } else cur += c;
    }
    cols.push(cur);
    return cols;
  });
}

function proximosCumples(rows, hoyIso, dias = DIAS_CUMPLE) {
  const fin = sumarIso(hoyIso, dias);
  const anio = Number(hoyIso.slice(0, 4));
  const lista = [];
  rows.forEach((row) => {
    if (esEncabezadoCumple(row)) return;
    const iniciales = row[0] ? String(row[0]).trim() : '';
    const parsed = parseNacimiento(row[1]);
    if (!iniciales || !parsed) return;
    let iso = isoCumple(anio, parsed.month, parsed.day);
    if (iso < hoyIso) iso = isoCumple(anio + 1, parsed.month, parsed.day);
    if (iso < hoyIso || iso > fin) return;
    const [, month, day] = iso.split('-');
    lista.push({
      iniciales,
      fecha: `${day}/${month}`,
      orden: iso,
    });
  });
  lista.sort((a, b) => a.orden.localeCompare(b.orden) || a.iniciales.localeCompare(b.iniciales, 'es'));
  return lista.map(({ iniciales, fecha }) => ({ iniciales, fecha }));
}

async function leerCumples() {
  if (!SHEET_CUMPLES) return [];
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_CUMPLES}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Cumples')}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Cumples ${res.status}`);
  return proximosCumples(parseCsv(await res.text()), hoyArgentina());
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
    let estados = {};
    try {
      const estadoRows = await db`
        SELECT iniciales, estado
        FROM comensales_estado
      `;
      estadoRows.forEach((row) => {
        estados[row.iniciales] = row.estado;
      });
    } catch (error) {
      if (!/comensales_estado/i.test(String(error.message || ''))) throw error;
      estados = {};
    }

    const misas = {};
    try {
      const misaRows = await db`
        SELECT fecha::text AS fecha, valor
        FROM misa
        WHERE fecha >= ${from}::date
          AND fecha <= ${to}::date
      `;
      misaRows.forEach((row) => {
        misas[String(row.fecha).slice(0, 10)] = misaSiNo(row.valor);
      });
    } catch (error) {
      if (!/misa/i.test(String(error.message || ''))) throw error;
    }

    let cumpleanos = [];
    try {
      cumpleanos = await leerCumples();
    } catch (error) {
      console.error('cumples:', error);
    }

    return res.status(200).json({ success: true, rows, estados, misas, cumpleanos });
  } catch (error) {
    console.error('anotados:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

module.exports.misaSiNo = misaSiNo;
module.exports.proximosCumples = proximosCumples;
module.exports.parseCsv = parseCsv;
