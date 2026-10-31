(function () {
  const DIAS_ATRAS = 1;
  const DIAS_ADELANTE = 7;
  const SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const SEMANA_CORTA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const $ = (id) => document.getElementById(id);
  const els = {
    fecha: $('fecha'),
    relativa: $('relativa'),
    prev: $('prev'),
    next: $('next'),
    dias: $('dias'),
    estado: $('estado'),
    contenido: $('contenido'),
    refresh: $('refresh'),
  };

  function isoLocal(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function parseIso(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function sumarDias(iso, n) {
    const d = parseIso(iso);
    d.setDate(d.getDate() + n);
    return isoLocal(d);
  }

  function ddmm(d) {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  function escapeHtml(v) {
    return String(v).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  const hoy = isoLocal(new Date());
  const dias = [];
  for (let i = -DIAS_ATRAS; i <= DIAS_ADELANTE; i += 1) dias.push(sumarDias(hoy, i));

  const state = {
    fecha: dias.includes(location.hash.slice(1)) ? location.hash.slice(1) : hoy,
    filas: [],
    inactivos: new Set(),
    misas: null,
    cumples: [],
    cargando: false,
    error: '',
  };

  function relativa(iso) {
    const diff = dias.indexOf(iso) - DIAS_ATRAS;
    if (diff === 0) return 'Hoy';
    if (diff === -1) return 'Ayer';
    if (diff === 1) return 'Mañana';
    return `En ${diff} días`;
  }

  function etiquetaChipDia(iso) {
    if (iso === hoy) return 'Hoy';
    if (iso === dias[0]) return 'Ayer';
    const d = parseIso(iso);
    return `${SEMANA_CORTA[d.getDay()]} ${ddmm(d)}`;
  }

  function cifra(it, separarRegimen) {
    if (!separarRegimen) return String(it.total);
    const { sinR, conR } = Clasificacion.partesRegimen(it);
    if (conR > 0 && sinR > 0) return `${sinR}<span class="mas-r"> + ${conR}R</span>`;
    if (conR > 0) return `${conR}<span class="mas-r">R</span>`;
    return String(sinR);
  }

  function filas(items, extra, separarRegimen) {
    if (!items.length) return '';
    return `<div class="anotados-filas">${items.map((it) => `
      <div class="fila${extra ? ` ${extra}` : ''}">
        <span class="fila-nombre">${escapeHtml(it.label)}</span>
        <strong class="fila-cifra">${cifra(it, separarRegimen)}</strong>
      </div>`).join('')}</div>`;
  }

  function persona(p) {
    const nombre = p.cantidad > 1 ? `${p.iniciales} × ${p.cantidad}` : p.iniciales;
    const reg = p.regimen ? '<span class="tag">R</span>' : '';
    const crudo = p.crudo && !['S', 'R', 'T', 'RT', '12', '12:30', 'San', 'V', 'VM', 'VRM'].includes(p.crudo)
      ? ` <span class="tag">${escapeHtml(p.crudo)}</span>`
      : '';
    return `<li>${escapeHtml(nombre)}${reg}${crudo}</li>`;
  }

  function detalle(r) {
    const grupos = [
      ...r.formatos,
      ...r.horarios,
      ...(r.otro ? [r.otro] : []),
      ...(r.sinAnotar ? [r.sinAnotar] : []),
    ].filter((g) => g.personas.length);
    if (!grupos.length) return '<p class="anotados-vacio">Nadie anotado</p>';
    return `<details class="anotados-detalle">
      <summary>Detalle</summary>
      <div class="anotados-detalle-cuerpo">
        ${grupos.map((g) => `
          <div class="fila${g.id === 'sinAnotar' ? ' is-pendiente' : ''}">
            <span class="fila-nombre">${escapeHtml(g.label)}</span>
            <ul class="anotados-lista">${g.personas.map(persona).join('')}</ul>
          </div>`).join('')}
      </div>
    </details>`;
  }

  function comida(titulo, clase, r) {
    const casa = r.horarios.length
      ? `<div class="anotados-grupo"><p>En casa</p>${filas(r.horarios, '', true)}</div>`
      : '';
    return `<section class="anotados-comida ${clase}">
      <h2><span>${titulo}</span><b>${r.total}</b></h2>
      ${filas(r.formatos, '', true)}
      ${casa}
      ${r.otro ? filas([r.otro], '', true) : ''}
      ${r.sinAnotar ? filas([r.sinAnotar], 'is-pendiente') : ''}
      ${detalle(r)}
    </section>`;
  }

  function render() {
    const d = parseIso(state.fecha);
    const idx = dias.indexOf(state.fecha);
    els.fecha.textContent = `${SEMANA[d.getDay()]} ${ddmm(d)}/${d.getFullYear()}`;
    els.relativa.textContent = relativa(state.fecha);
    els.prev.disabled = idx <= 0;
    els.next.disabled = idx >= dias.length - 1;

    els.dias.innerHTML = dias.map((iso) => {
      const misa = iso === dias[0]
        ? 'Misa'
        : (state.misas ? (state.misas[iso] === 'Si' ? 'Si' : 'No') : '');
      return `<div class="dia-col"><button type="button" data-dia="${iso}" class="${iso === state.fecha ? 'is-active' : ''}">${etiquetaChipDia(iso)}</button>${misa ? `<span class="dia-misa">${misa}</span>` : ''}</div>`;
    }).join('');
    const activo = els.dias.querySelector('.is-active');
    if (activo) activo.scrollIntoView({ block: 'nearest', inline: 'center' });

    els.refresh.disabled = state.cargando;
    els.estado.className = `anotados-estado${state.error ? ' is-error' : ''}`;
    els.estado.textContent = state.error || (state.cargando && !state.filas.length ? 'Cargando anotados…' : '');

    if (state.error || (state.cargando && !state.filas.length)) {
      els.contenido.innerHTML = '';
      return;
    }

    const delDia = state.filas.filter((f) => f.fecha === state.fecha);
    const leyenda = state.cumples.length
      ? `<p class="anotados-cumples">Próximos cumpleaños: ${state.cumples.map((c) => `${escapeHtml(c.fecha)} (${escapeHtml(c.iniciales)})`).join(', ')}</p>`
      : '';
    els.contenido.innerHTML =
      comida('Almuerzo', 'almuerzo', Clasificacion.resumirComida(delDia, 'Almuerzo', state.inactivos)) +
      comida('Cena', 'cena', Clasificacion.resumirComida(delDia, 'Cena', state.inactivos)) +
      leyenda;
  }

  function irA(iso) {
    if (!dias.includes(iso)) return;
    state.fecha = iso;
    history.replaceState(null, '', iso === hoy ? location.pathname : `#${iso}`);
    render();
  }

  async function cargar() {
    state.cargando = true;
    state.error = '';
    render();
    try {
      const url = `/api/anotados?from=${dias[0]}&to=${dias[dias.length - 1]}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || `Error ${res.status}`);
      state.filas = data.rows || [];
      state.misas = data.misas || {};
      state.cumples = data.cumpleanos || [];
      state.inactivos = new Set(
        Object.entries(data.estados || {})
          .filter(([, estado]) => estado === 'inactivo' || estado === 'oculto')
          .map(([ini]) => ini.toUpperCase())
      );
    } catch (e) {
      state.error = `No se pudieron cargar los anotados: ${e.message}`;
    } finally {
      state.cargando = false;
      render();
    }
  }

  els.prev.addEventListener('click', () => irA(dias[dias.indexOf(state.fecha) - 1]));
  els.next.addEventListener('click', () => irA(dias[dias.indexOf(state.fecha) + 1]));
  els.dias.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-dia]');
    if (b) irA(b.dataset.dia);
  });
  els.refresh.addEventListener('click', cargar);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') els.prev.click();
    if (e.key === 'ArrowRight') els.next.click();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isoLocal(new Date()) !== hoy) location.reload();
  });

  render();
  cargar();
})();
