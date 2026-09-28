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

  function chips(items, extra) {
    return `<div class="anotados-chips">${items.map((it) => `
      <div class="anotados-chip${extra ? ` ${extra}` : ''}${it.total ? '' : ' is-zero'}">
        <strong>${it.total}</strong>
        <span>${escapeHtml(it.label)}</span>
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
    const grupos = [...r.horarios, ...r.formatos, ...(r.otro ? [r.otro] : [])]
      .filter((g) => g.personas.length);
    if (!grupos.length) return '<p class="anotados-vacio">Nadie anotado</p>';
    return `<div class="anotados-detalle">
      <h3>Detalle</h3>
      ${grupos.map((g) => `
        <div class="anotados-bloque">
          <h4>${escapeHtml(g.label)} <small>${g.total}</small></h4>
          <ul class="anotados-lista">${g.personas.map(persona).join('')}</ul>
        </div>`).join('')}
    </div>`;
  }

  function comida(titulo, clase, r) {
    return `<section class="anotados-comida ${clase}">
      <h2><span>${titulo}</span><b>${r.total}</b></h2>
      <div class="anotados-grupo"><p>Horario</p>${chips(r.horarios)}</div>
      <div class="anotados-grupo"><p>Régimen</p>${chips([r.regimen], 'is-regimen')}</div>
      <div class="anotados-grupo"><p>Sandwich o viandas</p>${chips(r.formatos)}</div>
      ${r.otro ? `<div class="anotados-grupo"><p>Otro</p>${chips([r.otro])}</div>` : ''}
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

    els.dias.innerHTML = dias.map((iso) =>
      `<button type="button" data-dia="${iso}" class="${iso === state.fecha ? 'is-active' : ''}">${etiquetaChipDia(iso)}</button>`
    ).join('');
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
    els.contenido.innerHTML =
      comida('Almuerzo', 'almuerzo', Clasificacion.resumirComida(delDia, 'Almuerzo')) +
      comida('Cena', 'cena', Clasificacion.resumirComida(delDia, 'Cena'));
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
