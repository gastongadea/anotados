/* Clasificación de las opciones de comida que guarda Limos. */
(function (global) {
  function normalizarOpcion(raw) {
    const v = String(raw == null ? '' : raw).trim().replace(/\s+/g, '');
    if (!v) return '';
    const upper = v.toUpperCase();
    if (upper === 'SAN') return 'San';
    if (upper === '12:30' || upper === '12.30') return '12:30';
    if (['S', 'N', 'R', 'T', 'RT', 'V', 'VM', 'VRM', '12'].includes(upper)) return upper;
    return v;
  }

  function esGrupo(iniciales) {
    return iniciales === 'Invitados' || iniciales === 'Plan';
  }

  /** null si no cuenta (vacío, N o cantidad 0). */
  function clasificarOpcion(opcion, iniciales) {
    const o = normalizarOpcion(opcion);
    if (!o || o === 'N') return null;

    if (esGrupo(iniciales)) {
      if (!/^\d+$/.test(o)) return null;
      const cantidad = parseInt(o, 10);
      if (!cantidad) return null;
      return { grupo: 'normal', regimen: false, cantidad };
    }

    const regimen = o === 'R' || o === 'RT' || o === 'VRM';
    const grupos = {
      S: 'normal', R: 'normal',
      '12': '12', '12:30': '1230',
      T: 'tarde', RT: 'tarde',
      San: 'sandwich', V: 'vianda',
      VM: 'viandaManana', VRM: 'viandaManana',
    };
    return { grupo: grupos[o] || 'otro', regimen, cantidad: 1, crudo: o };
  }

  const GRUPOS = {
    normal: { label: 'Normal', tipo: 'horario' },
    '12': { label: '12:00', tipo: 'horario' },
    '1230': { label: '12:30', tipo: 'horario' },
    tarde: { label: 'Tarde', tipo: 'horario' },
    sandwich: { label: 'Sandwich', tipo: 'formato' },
    vianda: { label: 'Vianda', tipo: 'formato' },
    viandaManana: { label: 'Vianda mañana', tipo: 'formato' },
    otro: { label: 'Otro', tipo: 'otro' },
  };

  const VISIBLES = {
    Almuerzo: {
      horario: ['12', '1230', 'normal', 'tarde'],
      formato: ['vianda', 'viandaManana', 'sandwich'],
    },
    Cena: {
      horario: ['12', '1230', 'normal', 'tarde'],
      formato: ['vianda', 'viandaManana', 'sandwich'],
    },
  };

  /** Misma lista que Limos. Activo es el estado por defecto; Invitados y Plan no son una persona. */
  const ACTIVOS = [
    'MEP', 'GG', 'IJC', 'MMR', 'LMC', 'PAB', 'JBA', 'IC', 'ELF', 'FIG', 'AS',
    'FAM', 'JOA', 'FMA', 'JPS', 'FEC', 'TA', 'GGP', 'H1', 'H2',
  ];

  function resumirComida(filas, comida, inactivos) {
    const fuera = inactivos instanceof Set ? inactivos : new Set(inactivos || []);
    const grupos = {};
    Object.keys(GRUPOS).forEach((id) => {
      grupos[id] = { id, label: GRUPOS[id].label, total: 0, personas: [] };
    });
    const regimen = { id: 'regimen', label: 'Régimen', total: 0, personas: [] };

    filas.forEach((fila) => {
      if (fila.comida !== comida) return;
      const iniciales = String(fila.iniciales || '').trim();
      if (!iniciales || iniciales.toLowerCase() === 'misa') return;
      const c = clasificarOpcion(fila.opcion, iniciales);
      if (!c) return;
      const persona = {
        iniciales,
        cantidad: c.cantidad,
        regimen: c.regimen,
        crudo: c.crudo,
      };
      grupos[c.grupo].total += c.cantidad;
      grupos[c.grupo].personas.push(persona);
      if (c.regimen) {
        regimen.total += c.cantidad;
        regimen.personas.push(persona);
      }
    });

    const porNombre = (a, b) => a.iniciales.localeCompare(b.iniciales, 'es');
    Object.values(grupos).forEach((g) => g.personas.sort(porNombre));
    regimen.personas.sort(porNombre);

    const vis = VISIBLES[comida];
    const conDatos = (tipo) =>
      Object.keys(GRUPOS).filter(
        (id) => GRUPOS[id].tipo === tipo && !vis[tipo].includes(id) && grupos[id].total > 0
      );

    const soloConGente = (ids) => ids.filter((id) => grupos[id].total > 0).map((id) => grupos[id]);
    const horarios = soloConGente(vis.horario.concat(conDatos('horario')));
    const formatos = soloConGente(vis.formato.concat(conDatos('formato')));
    const otro = grupos.otro.total > 0 ? grupos.otro : null;
    const total = Object.values(grupos).reduce((s, g) => s + g.total, 0);

    const respondieron = new Set();
    filas.forEach((fila) => {
      if (fila.comida !== comida) return;
      const iniciales = String(fila.iniciales || '').trim();
      if (!iniciales || !normalizarOpcion(fila.opcion)) return;
      respondieron.add(iniciales.toUpperCase());
    });
    const sinAnotar = {
      id: 'sinAnotar',
      label: 'Sin anotar',
      total: 0,
      personas: ACTIVOS
        .filter((ini) => !fuera.has(ini.toUpperCase()) && !respondieron.has(ini.toUpperCase()))
        .map((iniciales) => ({ iniciales, cantidad: 1, regimen: false })),
    };
    sinAnotar.total = sinAnotar.personas.length;

    return {
      total,
      horarios,
      formatos,
      regimen: regimen.total > 0 ? regimen : null,
      otro,
      sinAnotar: sinAnotar.total > 0 ? sinAnotar : null,
    };
  }

  function partesRegimen(grupo) {
    let sinR = 0;
    let conR = 0;
    (grupo.personas || []).forEach((p) => {
      const n = p.cantidad || 1;
      if (p.regimen) conR += n;
      else sinR += n;
    });
    return { sinR, conR };
  }

  global.Clasificacion = { normalizarOpcion, clasificarOpcion, resumirComida, partesRegimen };
  if (typeof module !== 'undefined') module.exports = global.Clasificacion;
})(typeof window !== 'undefined' ? window : globalThis);
