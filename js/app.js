/* =============================================================
   app.js — Interfaz
   Une el motor de cálculo con la pantalla.
   ============================================================= */

import {
  CONTRATO_DEFAULT, calcularMes, horasNetas,
  resolverTipo, shekel, horasTxt, ymd, esNocturna, setLocale
} from './calc.js';

import { t, idioma, setIdioma, traducirDOM, locale } from './i18n.js';

import {
  cargarContrato, guardarContrato,
  cargarJornadas, guardarJornadas, jornadasConContexto,
  cargarRecibos, guardarRecibo,
  asegurarFestivos, festivosGuardados, setFestivos,
  exportarTodo, importarTodo
} from './store.js';

/* ---------- estado ---------- */

let contrato  = cargarContrato();
let jornadas  = cargarJornadas();
let recibos   = cargarRecibos();
let festivos  = setFestivos(festivosGuardados());
let mesActual = hoyMes();
let editando  = null;   // fecha que se está editando, o null si es nueva


function hoyMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

/* ---------- navegación de meses ---------- */

function moverMes(delta) {
  const [a, m] = mesActual.split('-').map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  mesActual = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  cargarFestivosDelAnio();
  pintar();
}

async function cargarFestivosDelAnio() {
  const anio = Number(mesActual.split('-')[0]);
  const cache = await asegurarFestivos(anio);
  festivos = setFestivos(cache);
  pintar();
}

/* ---------- pintar la lista de días ---------- */

let estadoAbierto = null;   // fecha del día que tiene el detalle desplegado

function pintarDias(res) {
  const cont = $('#lista-dias');

  if (res.dias.length === 0) {
    cont.innerHTML = `
      <div class="vacio">
        <p class="vacio__titulo">${t('vacioTitulo')}</p>
        <p class="vacio__texto">${t('vacioTexto')}</p>
      </div>`;
    return;
  }

  cont.innerHTML = res.dias.map(d => {
    if (d.vacia) return '';
    const fecha = new Date(d.fecha + 'T12:00:00');
    const j = jornadas.find(x => x.fecha === d.fecha) || {};
    const abierto = d.fecha === estadoAbierto;

    const tira = d.partes.map(p =>
      `<div class="tira__parte" data-pct="${p.pct}" style="flex:${p.horas.toFixed(3)}"></div>`
    ).join('');

    const nombresTipo = {
      noche: t('tipoNoche'), especial: t('tipoEspecial'), septimo: t('tipoSeptimo')
    };
    const etiquetaTipo = d.tipo === 'regular' ? '' :
      `<span class="dia__marca" data-tipo="${d.tipo}">${nombresTipo[d.tipo]}</span>`;

    const detalle = !abierto ? '' : `
      <div class="dia__detalle">
        ${d.partes.map(p => `
          <div class="tramo">
            <span class="tramo__punto" style="background:var(--t${p.pct})"></span>
            <span class="tramo__pct">${p.pct}%</span>
            <span class="tramo__horas">${horasTxt(p.horas)}</span>
            <span class="tramo__importe ${p.esExtra ? 'es-extra' : 'es-base'}">
              ${p.esExtra ? '+' + shekel(p.importe) : t('cubiertoBase')}
            </span>
          </div>`).join('')}
        ${d.sinCubrir > 0 ? `
        <p class="dia__aviso">
          <strong>${t('sinCubrir', { h: d.sinCubrir.toFixed(2) })}</strong><br>
          ${t('sinCubrirAyuda')}
        </p>` : ''}
        <p class="dia__motivo">${traducirMotivo(d.clasif || d)}${j.nota ? ' · ' + escapar(j.nota) : ''}</p>
        <div class="dia__acciones">
          <button class="dia__accion" data-editar="${d.fecha}">${t('editar')}</button>
          <button class="dia__accion dia__accion--borrar" data-borrar="${d.fecha}">${t('borrar')}</button>
        </div>
      </div>`;

    return `
      <article class="dia">
        <button class="dia__cabeza" data-abrir="${d.fecha}">
          <div class="dia__fecha">
            <div class="dia__num">${String(fecha.getDate()).padStart(2, '0')}</div>
            <div class="dia__dow">${t('dias')[fecha.getDay()]}</div>
          </div>
          <div class="dia__horario">
            <div class="dia__rango">${j.entrada || '—'} → ${j.salida || '—'}</div>
            ${etiquetaTipo}
          </div>
          <div class="dia__cifras">
            <div class="dia__horas">${d.horas.toFixed(2)}${d.sinCubrir > 0 ? ' <span class="dia__alerta" aria-hidden="true">!</span>' : ''}</div>
            ${d.pagoExtra > 0 ? `<div class="dia__extra">+${shekel(d.pagoExtra)}</div>` : ''}
          </div>
        </button>
        <div class="tira">${tira}</div>
        ${detalle}
      </article>`;
  }).join('');
}

function escapar(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

/* ---------- pintar el resumen ---------- */

function pintarResumen(res) {
  const pct = Math.min(100, (res.horasTotal / contrato.globalUmbral) * 100);
  const llego = res.cobraGlobal;
  const color = llego ? 'var(--ok)' : 'var(--t150)';

  $('#res-horas').textContent = res.horasTotal.toFixed(2) + ' h';
  $('#res-relleno').style.width = pct + '%';
  $('#res-relleno').style.background = color;

  if (contrato.modo === 'mensual' && contrato.globalActivo) {
    $('#res-meta').textContent = `${t('objetivo')} ${contrato.globalUmbral} h`;
    $('#res-nota').style.color = color;
    $('#res-nota').textContent = llego
      ? t('superaste', { monto: shekel(contrato.globalMonto) })
      : t('faltan', { horas: (contrato.globalUmbral - res.horasTotal).toFixed(1) });
  } else {
    $('#res-meta').textContent = '';
    $('#res-nota').textContent = '';
    $('#res-relleno').style.width = '100%';
    $('#res-relleno').style.background = 'var(--verde)';
  }

  // reparto por porcentaje
  const pcts = Object.keys(res.horasPorPct).map(Number).sort((a, b) => a - b);
  const maxH = Math.max(...Object.values(res.horasPorPct), 1);
  $('#res-reparto').innerHTML = pcts.length === 0
    ? `<p class="opcion__ayuda">${t('repartoVacio')}</p>`
    : pcts.map(p => `
        <div class="reparto__fila">
          <span class="reparto__pct" style="color:var(--t${p})">${p}%</span>
          <span class="reparto__barra">
            <span class="reparto__relleno" style="width:${(res.horasPorPct[p] / maxH) * 100}%;background:var(--t${p})"></span>
          </span>
          <span class="reparto__horas">${res.horasPorPct[p].toFixed(2)} h</span>
        </div>`).join('');

  // filas de dinero
  const filas = [];
  if (contrato.modo === 'mensual') {
    filas.push([t('sueldoBase'), shekel(res.base), false]);
    if (contrato.globalActivo) {
      filas.push([t('bonusGlobal'), shekel(res.global), !res.cobraGlobal]);
    }
    if (res.extrasPorTipo.regular > 0)
      filas.push([t('extrasRegulares'), shekel(res.extrasPorTipo.regular), false]);
    if (res.extrasPorTipo.noche > 0)
      filas.push([t('extrasNoche'), shekel(res.extrasPorTipo.noche), false]);
    if (res.extrasPorTipo.especial > 0)
      filas.push([t('extrasEspeciales'), shekel(res.extrasPorTipo.especial), false]);
    if (res.extrasPorTipo.septimo > 0)
      filas.push([t('extrasSeptimo'), shekel(res.extrasPorTipo.septimo), false]);
  } else {
    filas.push([t('horasTrabajadas'), shekel(res.extras), false]);
  }
  if (res.viaticos > 0)
    filas.push([t('viaticos'), shekel(res.viaticos), false]);

  $('#res-filas').innerHTML = filas.map(([e, v, apagado]) => `
    <div class="fila">
      <span class="fila__etiqueta">${e}</span>
      <span class="fila__valor ${apagado ? 'apagado' : ''}">${v}</span>
    </div>`).join('');

  $('#res-bruto').textContent = shekel(res.bruto);

  const avisoMes = $('#res-aviso');
  if (res.sinCubrirTotal > 0.01) {
    avisoMes.hidden = false;
    avisoMes.innerHTML = `<strong>${t('sinCubrirMes', { h: res.sinCubrirTotal.toFixed(2) })}</strong><br>${t('sinCubrirAyuda')}`;
  } else {
    avisoMes.hidden = true;
  }

  // comparación con el recibo
  const cobrado = recibos[mesActual];
  $('#inp-recibo').value = cobrado ?? '';
  const cont = $('#res-veredicto');

  if (cobrado == null || cobrado === '') {
    cont.innerHTML = '';
  } else {
    const dif = res.bruto - cobrado;
    const clase = dif > 20 ? 'falta' : dif < -20 ? 'sobra' : 'igual';
    const texto = dif > 20 ? t('falta') : dif < -20 ? t('sobra') : t('coincide');
    cont.innerHTML = `
      <div class="veredicto veredicto--${clase}">
        <div>
          <div class="veredicto__texto">${texto}</div>
          ${clase === 'falta'
            ? `<div class="veredicto__nota">${t('revisar')}</div>` : ''}
        </div>
        ${Math.abs(dif) > 20 ? `<div class="veredicto__monto">${shekel(Math.abs(dif))}</div>` : ''}
      </div>`;
  }

  // barra inferior
  $('#barra-monto').textContent = shekel(res.bruto);
  const n = res.dias.filter(d => !d.vacia).length;
  $('#barra-nota').textContent = n === 0
    ? t('sinJornadas')
    : `${n} ${n === 1 ? t('jornada') : t('jornadas')} · ${res.horasTotal.toFixed(1)} h`;
}

/* ---------- pintar ajustes ---------- */

function pintarAjustes() {
  $$('#sel-idioma button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.idioma === idioma())));
  $('#btn-idioma').textContent = idioma() === 'es' ? 'עב' : 'ES';

  $$('#sel-modo button').forEach(b =>
    b.setAttribute('aria-pressed', b.dataset.modo === contrato.modo));

  $$('#sel-viaticos button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.viaticos === contrato.viaticosModo)));
  $('#fila-viaticos-mes').hidden = contrato.viaticosModo === 'diario';
  $('#fila-viaticos-dia').hidden = contrato.viaticosModo !== 'diario';

  $('#campos-noche').hidden = !contrato.nocheActiva;
  $('#grupo-noche').hidden  = !contrato.nocheActiva;
  $('#campos-mensual').hidden = contrato.modo !== 'mensual';
  $('#campos-horario').hidden = contrato.modo !== 'horario';
  $('#panel-global').hidden   = contrato.modo !== 'mensual';

  $$('[data-campo]').forEach(el => {
    const campo = el.dataset.campo;
    if (el.classList.contains('interruptor')) {
      el.setAttribute('aria-checked', String(!!contrato[campo]));
    } else {
      el.value = contrato[campo] ?? '';
    }
  });

  $('#campos-global').hidden = !contrato.globalActivo;

  $$('#sel-dias button').forEach(b => {
    const d = Number(b.dataset.dow);
    b.setAttribute('aria-pressed', contrato.diasEspeciales.includes(d));
    b.textContent = t('diasLetra')[d];
  });

  const tarifa = contrato.modo === 'horario'
    ? contrato.tarifaHora
    : contrato.salarioMensual / contrato.horasNormaMes;
  $('#nota-tarifa').textContent = t('notaTarifa', { tarifa: '₪' + tarifa.toFixed(2) });

  const dd = String(contrato.nocheDesde).padStart(2, '0');
  const hh = String(contrato.nocheHasta).padStart(2, '0');
  $('#nota-noche').textContent = `${dd}:00 – ${hh}:00 · ${t('nocheVentanaAyuda')}`;

  for (const tipo of ['regular', 'noche', 'especial', 'septimo']) {
    const cont = $(`.tramos-lista[data-tipo="${tipo}"]`);
    const rotuloQuitar = t('quitarTramo');
    const rotDesde = t('colDesde'), rotHasta = t('colHasta');
    cont.innerHTML = (contrato.tramos[tipo] || []).map((tr, i) => `
      <div class="tramo-fila">
        <input type="number" inputmode="decimal" value="${tr.desde}"
               data-tramo="${tipo}" data-i="${i}" data-k="desde" aria-label="${rotDesde}">
        <input type="number" inputmode="decimal" value="${tr.hasta ?? ''}" placeholder="—"
               data-tramo="${tipo}" data-i="${i}" data-k="hasta" aria-label="${rotHasta}">
        <input type="number" inputmode="decimal" value="${tr.pct}"
               data-tramo="${tipo}" data-i="${i}" data-k="pct" aria-label="%">
        <button class="tramo-fila__quitar" data-quitar="${tipo}" data-i="${i}"
                aria-label="${rotuloQuitar}">×</button>
      </div>`).join('');
  }
}

/* ---------- pintar todo ---------- */

function pintar() {
  const [a, m] = mesActual.split('-').map(Number);
  $('#mes-etiqueta').textContent = `${t('meses')[m - 1]} ${a}`;

  const conContexto = jornadasConContexto(jornadas, mesActual);
  const delMes = conContexto.filter(j => j.fecha.startsWith(mesActual));

  // Calculamos con contexto para que el 7.º día mire el mes anterior,
  // pero sólo mostramos y sumamos las jornadas del mes elegido.
  const resTodo = calcularMes(conContexto, contrato, festivos);
  const res = calcularMes(delMes, contrato, festivos);
  res.dias = resTodo.dias.filter(d => d.fecha.startsWith(mesActual));

  // recalculamos totales sólo con los días visibles
  res.horasTotal = 0;
  res.sinCubrirTotal = 0;
  res.horasPorPct = {};
  res.extrasPorTipo = { regular: 0, noche: 0, especial: 0, septimo: 0 };
  for (const d of res.dias) {
    if (d.vacia) continue;
    res.horasTotal += d.horas;
    res.sinCubrirTotal += d.sinCubrir || 0;
    res.extrasPorTipo[d.tipo] += d.pagoExtra;
    for (const p of d.partes) res.horasPorPct[p.pct] = (res.horasPorPct[p.pct] || 0) + p.horas;
  }
  res.extras = res.extrasPorTipo.regular + res.extrasPorTipo.noche
             + res.extrasPorTipo.especial + res.extrasPorTipo.septimo;
  res.cobraGlobal = contrato.modo === 'mensual' && contrato.globalActivo
                    && res.horasTotal >= contrato.globalUmbral;
  res.global = res.cobraGlobal ? contrato.globalMonto : 0;
  const jornadasVisibles = res.dias.filter(d => !d.vacia).length;
  res.jornadasContadas = jornadasVisibles;
  res.viaticos = contrato.viaticosModo === 'diario'
    ? (contrato.viaticosDia || 0) * jornadasVisibles
    : (contrato.viaticos || 0);
  res.bruto = res.base + res.global + res.extras + res.viaticos;

  pintarDias(res);
  pintarResumen(res);
  pintarAjustes();
}

/* ---------- hoja de carga ---------- */

function llenarSelects() {
  const hs = Array.from({ length: 24 }, (_, h) =>
    `<option value="${String(h).padStart(2,'0')}">${String(h).padStart(2,'0')}</option>`).join('');
  const ms = Array.from({ length: 60 }, (_, m) =>
    `<option value="${String(m).padStart(2,'0')}">${String(m).padStart(2,'0')}</option>`).join('');
  $('#ent-h').innerHTML = hs; $('#sal-h').innerHTML = hs;
  $('#ent-m').innerHTML = ms; $('#sal-m').innerHTML = ms;
}

let tipoElegido = '';

function abrirHoja(fecha = null) {
  editando = fecha;
  const j = fecha ? jornadas.find(x => x.fecha === fecha) : null;

  $('#hoja-titulo').textContent = j ? t('editarJornada') : t('nuevaJornada');
  $('#hoja-fecha').value = j ? j.fecha : sugerirFecha();

  const [eh, em] = (j?.entrada || '08:00').split(':');
  const [sh, sm] = (j?.salida  || '17:00').split(':');
  $('#ent-h').value = eh; $('#ent-m').value = em;
  $('#sal-h').value = sh; $('#sal-m').value = sm;

  $('#hoja-nota').value = j?.nota || '';
  tipoElegido = j?.tipoManual || '';
  $$('#hoja-tipo button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.tipo === tipoElegido)));

  actualizarPrevia();
  $('#velo').classList.add('abierto');
}

function sugerirFecha() {
  const hoy = ymd(new Date());
  if (hoy.startsWith(mesActual) && !jornadas.some(j => j.fecha === hoy)) return hoy;
  // primer día libre del mes elegido
  const [a, m] = mesActual.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  for (let d = 1; d <= ultimo; d++) {
    const f = `${mesActual}-${String(d).padStart(2, '0')}`;
    if (!jornadas.some(j => j.fecha === f)) return f;
  }
  return `${mesActual}-01`;
}

function cerrarHoja() {
  $('#velo').classList.remove('abierto');
  editando = null;
}

function actualizarPrevia() {
  const entrada = `${$('#ent-h').value}:${$('#ent-m').value}`;
  const salida  = `${$('#sal-h').value}:${$('#sal-m').value}`;
  const fecha   = $('#hoja-fecha').value;
  const neto = horasNetas(entrada, salida, contrato.pausaMin);

  const caja = $('#hoja-previa');
  if (neto == null || neto <= 0 || !fecha) { caja.hidden = true; return; }
  caja.hidden = false;

  const porFecha = {};
  for (const j of jornadas) porFecha[j.fecha] = j;
  const clasif = resolverTipo(
    { fecha, entrada, salida, tipoManual: tipoElegido || null },
    porFecha, contrato, festivos
  );
  const nombres = {
    regular: t('tipoRegular'), noche: t('tipoNoche'),
    especial: t('tipoEspecial'), septimo: t('tipoSeptimo')
  };

  $('#previa-horas').textContent = t('horasNetas', { h: neto.toFixed(2) });
  $('#previa-nota').textContent =
    `${nombres[clasif.tipo]} · ${traducirMotivo(clasif)} · ${t('pausaDescontada', { min: contrato.pausaMin })}`;
}

/** El motivo viene del motor en español; acá se muestra en el idioma elegido. */
function traducirMotivo(clasif) {
  if (!clasif.automatico) return t('motivoManual');
  switch (clasif.tipo) {
    case 'septimo':  return t('motivoSeptimo');
    case 'noche':    return `${t('motivoEntra')} ${clasif.entrada || ''} ${t('motivoNoche')}`.trim();
    case 'especial': return clasif.motivo.startsWith('Festivo')
                       ? t('motivoFestivo')
                       : `${t('motivoEs')} ${t('diasLargo')[diaSemanaDe(clasif)]}`;
    default:         return t('motivoHabil');
  }
}

function diaSemanaDe(clasif) {
  const nombres = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const i = nombres.findIndex(n => clasif.motivo.includes(n));
  return i >= 0 ? i : 0;
}

function guardarDesdeHoja() {
  const fecha = $('#hoja-fecha').value;
  if (!fecha) { alert(t('elegiFecha')); return; }

  const entrada = `${$('#ent-h').value}:${$('#ent-m').value}`;
  const salida  = `${$('#sal-h').value}:${$('#sal-m').value}`;
  if (horasNetas(entrada, salida, 0) == null) {
    alert(t('horarioInvalido'));
    return;
  }

  const nueva = {
    fecha, entrada, salida,
    tipoManual: tipoElegido || null,
    nota: $('#hoja-nota').value.trim() || null
  };

  if (editando && editando !== fecha) jornadas = jornadas.filter(j => j.fecha !== editando);
  const i = jornadas.findIndex(j => j.fecha === fecha);
  if (i >= 0) jornadas[i] = nueva; else jornadas.push(nueva);

  guardarJornadas(jornadas);
  if (!fecha.startsWith(mesActual)) mesActual = fecha.slice(0, 7);
  cerrarHoja();
  pintar();
}

/* ---------- eventos ---------- */

function conectar() {
  $('#mes-prev').onclick = () => moverMes(-1);
  $('#mes-sig').onclick  = () => moverMes(1);
  $('#btn-hoy').onclick  = () => { mesActual = hoyMes(); cargarFestivosDelAnio(); pintar(); };

  $$('.pestana[data-vista]').forEach(b => {
    b.onclick = () => {
      $$('.pestana[data-vista]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      $$('.vista').forEach(v => v.classList.remove('activa'));
      $(`#vista-${b.dataset.vista}`).classList.add('activa');
      window.scrollTo(0, 0);
    };
  });

  $('#btn-nueva').onclick    = () => abrirHoja();
  $('#hoja-cancelar').onclick = cerrarHoja;
  $('#hoja-guardar').onclick  = guardarDesdeHoja;
  $('#velo').onclick = e => { if (e.target === $('#velo')) cerrarHoja(); };

  ['#ent-h','#ent-m','#sal-h','#sal-m','#hoja-fecha'].forEach(s => {
    $(s).addEventListener('change', actualizarPrevia);
  });

  $$('#hoja-tipo button').forEach(b => {
    b.onclick = () => {
      tipoElegido = b.dataset.tipo;
      $$('#hoja-tipo button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      actualizarPrevia();
    };
  });

  // lista de días: abrir / editar / borrar
  $('#lista-dias').addEventListener('click', e => {
    const abrir = e.target.closest('[data-abrir]');
    if (abrir) {
      const f = abrir.dataset.abrir;
      estadoAbierto = estadoAbierto === f ? null : f;
      pintar();
      return;
    }
    const ed = e.target.closest('[data-editar]');
    if (ed) { abrirHoja(ed.dataset.editar); return; }

    const bo = e.target.closest('[data-borrar]');
    if (bo) {
      const f = bo.dataset.borrar;
      if (confirm(`${t('confirmarBorrar')} ${f}?`)) {
        jornadas = jornadas.filter(j => j.fecha !== f);
        guardarJornadas(jornadas);
        estadoAbierto = null;
        pintar();
      }
    }
  });

  // recibo
  $('#inp-recibo').addEventListener('input', e => {
    recibos = cargarRecibos();
    guardarRecibo(mesActual, e.target.value === '' ? null : e.target.value);
    recibos = cargarRecibos();
    pintar();
  });

  // idioma
  $('#btn-idioma').onclick = () => cambiarIdioma(idioma() === 'es' ? 'he' : 'es');
  $$('#sel-idioma button').forEach(b => {
    b.onclick = () => cambiarIdioma(b.dataset.idioma);
  });

  // ajustes: modo
  $$('#sel-modo button').forEach(b => {
    b.onclick = () => { contrato.modo = b.dataset.modo; persistir(); };
  });

  // ajustes: viáticos fijos o por jornada
  $$('#sel-viaticos button').forEach(b => {
    b.onclick = () => { contrato.viaticosModo = b.dataset.viaticos; persistir(); };
  });

  // ajustes: números
  document.addEventListener('input', e => {
    const campo = e.target.dataset?.campo;
    if (!campo || e.target.classList.contains('interruptor')) return;
    const v = e.target.value === '' ? 0 : Number(e.target.value);
    if (!Number.isNaN(v)) { contrato[campo] = v; persistirSuave(); }
  });

  // ajustes: interruptores
  document.addEventListener('click', e => {
    const sw = e.target.closest('.interruptor[data-campo]');
    if (!sw) return;
    contrato[sw.dataset.campo] = !contrato[sw.dataset.campo];
    persistir();
  });

  // ajustes: días especiales
  $$('#sel-dias button').forEach(b => {
    b.onclick = () => {
      const d = Number(b.dataset.dow);
      contrato.diasEspeciales = contrato.diasEspeciales.includes(d)
        ? contrato.diasEspeciales.filter(x => x !== d)
        : [...contrato.diasEspeciales, d].sort();
      persistir();
    };
  });

  // ajustes: tramos
  document.addEventListener('input', e => {
    const grupo = e.target.dataset?.tramo;
    if (!grupo) return;
    const i = Number(e.target.dataset.i), k = e.target.dataset.k;
    const v = e.target.value;
    contrato.tramos[grupo][i][k] = (k === 'hasta' && v === '') ? null : Number(v);
    persistirSuave();
  });

  document.addEventListener('click', e => {
    const q = e.target.closest('[data-quitar]');
    if (q) {
      contrato.tramos[q.dataset.quitar].splice(Number(q.dataset.i), 1);
      persistir();
      return;
    }
    const a = e.target.closest('[data-agregar]');
    if (a) {
      const tipo = a.dataset.agregar;
      const lista = contrato.tramos[tipo];
      const ultimo = lista[lista.length - 1];
      const desde = ultimo ? (ultimo.hasta ?? ultimo.desde + 2) : 0;
      lista.push({ desde, hasta: null, pct: ultimo ? ultimo.pct + 25 : 100 });
      persistir();
    }
  });

  // respaldo
  $('#btn-exportar').onclick = () => {
    const blob = new Blob([exportarTodo()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `shaot-${ymd(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  $('#btn-importar').onclick = () => $('#archivo-importar').click();
  $('#archivo-importar').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const n = importarTodo(await f.text());
      contrato = cargarContrato();
      jornadas = cargarJornadas();
      recibos  = cargarRecibos();
      pintar();
      alert(t('restaurado', { n }));
    } catch (err) {
      alert(t('errorArchivo') + err.message);
    }
    e.target.value = '';
  };

  $('#btn-reset').onclick = () => {
    if (!confirm(t('confirmarReset'))) return;
    contrato = structuredClone(CONTRATO_DEFAULT);
    persistir();
  };
}

function cambiarIdioma(codigo) {
  setIdioma(codigo);
  setLocale(locale());
  traducirDOM();
  pintar();
}

function persistir() { guardarContrato(contrato); pintar(); }

// Para los campos de texto: guarda sin repintar, así no se pierde el foco.
let temporizador = null;
function persistirSuave() {
  guardarContrato(contrato);
  clearTimeout(temporizador);
  temporizador = setTimeout(() => {
    const activo = document.activeElement;
    const marca = activo?.dataset?.campo || activo?.dataset?.k;
    pintar();
    if (marca) {
      const sel = activo.dataset.campo
        ? `[data-campo="${activo.dataset.campo}"]`
        : `[data-tramo="${activo.dataset.tramo}"][data-i="${activo.dataset.i}"][data-k="${activo.dataset.k}"]`;
      $(sel)?.focus();
    }
  }, 700);
}

/* ---------- arranque ---------- */

setIdioma(idioma());
setLocale(locale());
traducirDOM();
llenarSelects();
conectar();
pintar();
cargarFestivosDelAnio();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () =>
    navigator.serviceWorker.register('sw.js').catch(() => {}));
}
