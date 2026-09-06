/* =============================================================
   app.js — Interfaz
   Une el motor de cálculo con la pantalla.
   ============================================================= */

import {
  CONTRATO_DEFAULT, calcularMes, horasNetas,
  resolverTipo, shekel, horasTxt, ymd, setLocale,
  valorDia, diaDeEnfermedad, pctEnfermedad
} from './calc.js';

import { t, idioma, setIdioma, traducirDOM, locale } from './i18n.js';
import { calcularNeto, TASAS } from './impuestos.js';

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

/** Tarjeta de un día de vacaciones o enfermedad. */
function tarjetaAusencia(d, j, fecha, abierto) {
  const nombre = d.ausencia === 'vacaciones' ? t('diaVacaciones') : t('diaEnfermedad');
  const suma = contrato.modo === 'horario';

  const linea = d.ausencia === 'enfermedad'
    ? t('diaEnfermedadN', { n: d.numeroDia, pct: d.pctAusencia })
    : nombre;

  const detalle = !abierto ? '' : `
    <div class="dia__detalle">
      <div class="tramo">
        <span class="tramo__horas">${suma ? t('montoDia') : t('cubiertoSalario')}</span>
        <span class="tramo__importe ${suma ? 'es-extra' : 'es-base'}">
          ${suma ? '+' + shekel(d.pago) : shekel(d.pago)}
        </span>
      </div>
      ${d.ausencia === 'enfermedad' && d.numeroDia === 1 && d.pctAusencia === 0
        ? `<p class="dia__motivo">${t('primerDiaSinPago')}</p>` : ''}
      ${j.nota ? `<p class="dia__motivo">${escapar(j.nota)}</p>` : ''}
      <div class="dia__acciones">
        <button class="dia__accion" data-editar="${d.fecha}">${t('editar')}</button>
        <button class="dia__accion dia__accion--borrar" data-borrar="${d.fecha}">${t('borrar')}</button>
      </div>
    </div>`;

  return `
    <article class="dia dia--ausencia" data-aus="${d.ausencia}">
      <button class="dia__cabeza" data-abrir="${d.fecha}">
        <div class="dia__fecha">
          <div class="dia__num">${String(fecha.getDate()).padStart(2, '0')}</div>
          <div class="dia__dow">${t('dias')[fecha.getDay()]}</div>
        </div>
        <div class="dia__horario">
          <div class="dia__ausencia"><strong>${nombre}</strong></div>
          <span class="dia__marca" data-tipo="${d.ausencia}">${linea}</span>
        </div>
        <div class="dia__cifras">
          <div class="dia__horas">${shekel(d.pago)}</div>
          ${d.manual ? `<div class="dia__dow">${t('montoDia')}</div>` : ''}
        </div>
      </button>
      ${detalle}
    </article>`;
}

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

    if (d.esAusencia) return tarjetaAusencia(d, j, fecha, abierto);

    const tira = d.partes.map(p =>
      `<div class="tira__parte" data-pct="${p.pct}" style="flex:${p.horas.toFixed(3)}"></div>`
    ).join('');

    const nombresTipo = {
      noche: t('tipoNoche'), viernes: t('tipoViernes'),
      especial: t('tipoEspecial'), septimo: t('tipoSeptimo')
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
            ${(() => {
              if (!p.esExtra) return `<span class="tramo__importe es-base">${t('cubiertoBase')}</span>`;
              if (p.cubiertoBanco) return `<span class="tramo__importe es-banco">${shekel(p.importeBanco)} ${t('bancoCubre')}</span>`;
              if (p.horasBanco > 0) return `<span class="tramo__importe es-extra">+${shekel(p.importePagado)} <span class="es-banco">(${p.horasBanco.toFixed(1)} h ${t('bancoCubre')})</span></span>`;
              return `<span class="tramo__importe es-extra">+${shekel(p.importePagado ?? p.importe)}</span>`;
            })()}
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

  // banco de horas: cuánto queda del adelanto que paga el global
  const caja = $('#res-banco');
  const b = res.banco;
  if (b && b.activo) {
    caja.hidden = false;
    const pctBanco = b.horas > 0 ? (b.usadas / b.horas) * 100 : 0;
    const lleno = b.restante <= 0.0001;
    caja.innerHTML = `
      <div class="banco">
        <div class="banco__fila">
          <span class="banco__nombre">${t('bancoUsado')}</span>
          <span class="banco__cifra" style="color:${lleno ? 'var(--t150)' : 'var(--verde)'}">
            ${t('bancoDe', { usadas: b.usadas.toFixed(1), total: b.horas })}
          </span>
        </div>
        <div class="medidor__barra">
          <div class="medidor__relleno" style="width:${pctBanco}%;background:${lleno ? 'var(--t150)' : 'var(--verde)'}"></div>
        </div>
        <p class="banco__nota" style="color:${lleno ? 'var(--t150)' : 'var(--tinta-suave)'}">
          ${lleno ? t('bancoLleno') : t('bancoQueda', { h: b.restante.toFixed(1) })}
        </p>
      </div>`;
  } else {
    caja.hidden = true;
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
    if (res.extrasPorTipo.viernes > 0)
      filas.push([t('extrasViernes'), shekel(res.extrasPorTipo.viernes), false]);
    if (res.extrasPorTipo.especial > 0)
      filas.push([t('extrasEspeciales2'), shekel(res.extrasPorTipo.especial), false]);
    if (res.extrasPorTipo.septimo > 0)
      filas.push([t('extrasSeptimo'), shekel(res.extrasPorTipo.septimo), false]);
  } else {
    filas.push([t('horasTrabajadas'), shekel(res.extras), false]);
  }
  const av = res.ausencias || {};
  if (av.vacaciones?.dias > 0)
    filas.push([`${t('diasVacaciones')} (${av.vacaciones.dias})`,
      shekel(av.vacaciones.suma || av.vacaciones.pago),
      contrato.modo !== 'horario']);
  if (av.enfermedad?.dias > 0)
    filas.push([`${t('diasEnfermedad')} (${av.enfermedad.dias})`,
      shekel(av.enfermedad.suma || av.enfermedad.pago),
      contrato.modo !== 'horario']);

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

  pintarNeto(res.bruto);

  // barra inferior
  $('#barra-monto').textContent = shekel(res.bruto);

  const trabajados = res.dias.filter(d => !d.vacia && !d.esAusencia).length;
  const ausentes   = res.dias.filter(d => d.esAusencia).length;
  const partes = [];
  if (trabajados > 0) {
    partes.push(`${trabajados} ${trabajados === 1 ? t('jornada') : t('jornadas')}`);
    const hs = res.dias.filter(d => !d.vacia && !d.esAusencia)
                       .reduce((s, d) => s + d.horas, 0);
    partes.push(`${hs.toFixed(1)} h`);
  }
  if (ausentes > 0) partes.push(`${ausentes} ${t('diaAusente')}`);
  $('#barra-nota').textContent = partes.length ? partes.join(' · ') : t('sinJornadas');
}

/* ---------- pintar el neto ---------- */

function pintarNeto(bruto) {
  const panel = $('#panel-neto');
  if (!contrato.netoActivo || bruto <= 0) { panel.hidden = true; return; }
  panel.hidden = false;

  const n = calcularNeto(bruto, contrato);

  // barra de proporciones: primero lo que queda, después cada descuento
  const partes = [
    ['neto', n.neto], ['impuesto', n.impuesto], ['leumi', n.leumi],
    ['salud', n.salud], ['pension', n.pension], ['otros', n.otros]
  ].filter(([, v]) => v > 0);

  const barra = partes.map(([q, v]) =>
    `<div class="reparto-neto__parte" data-q="${q}" style="flex:${v.toFixed(2)}"></div>`).join('');

  const fila = (etiqueta, valor, esDescuento) => `
    <div class="fila ${esDescuento ? 'fila--descuento' : ''}">
      <span class="fila__etiqueta">${etiqueta}</span>
      <span class="fila__valor">${esDescuento ? '−' : ''}${shekel(valor)}</span>
    </div>`;

  $('#neto-filas').innerHTML =
    `<div class="reparto-neto">${barra}</div>`
    + fila(t('brutoEstimado'), n.bruto, false)
    + fila(t('impuesto'), n.impuesto, true)
    + fila(t('leumi'), n.leumi, true)
    + fila(t('salud'), n.salud, true)
    + (n.pension > 0 ? fila(t('pension'), n.pension, true) : '')
    + (n.otros > 0 ? fila(t('otrosDesc'), n.otros, true) : '');

  $('#neto-valor').textContent = shekel(n.neto);

  const pctDesc = n.bruto > 0 ? (n.descuentos / n.bruto) * 100 : 0;
  $('#neto-pie').innerHTML =
    `<span>${t('seVaEn', { pct: pctDesc.toFixed(1) })}</span>`
    + `<span>${t('marginal')}: ${n.marginal} %</span>`;
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

  $('#fila-valor-dia').hidden = contrato.valorDiaAuto !== false;
  $('#nota-valor-dia').textContent =
    `${t('valorDiaTitulo')}: ${shekel(valorDia(contrato))}`;

  const escala = contrato.enfermedadPct || [0, 50, 50, 100];
  $('#escala-enfermedad').innerHTML = escala.map((v, i) => `
    <div class="escala__dia">
      <div class="escala__rotulo">${i + 1}${i === escala.length - 1 ? '+' : ''}</div>
      <input type="number" inputmode="numeric" min="0" max="200" value="${v}"
             data-escala="${i}" aria-label="${t('diaEnfermedad')} ${i + 1}">
    </div>`).join('');

  $('#campos-neto').hidden = !contrato.netoActivo;
  $$('#sel-pension-base button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.pbase === contrato.pensionBase)));
  $('#nota-tasas').textContent = t('tasasDe', { anio: TASAS.anio });
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

  const TABLAS = ['regular', 'viernes', 'especial'];
  const nombreTabla = k => t('tabla' + k[0].toUpperCase() + k.slice(1));
  const opciones = sel => TABLAS.map(k =>
    `<option value="${k}" ${k === sel ? 'selected' : ''}>${nombreTabla(k)}</option>`).join('');

  $('#tablas-por-dia').innerHTML = [0,1,2,3,4,5,6].map(d => {
    const actual = (contrato.tablaPorDia || [])[d] || 'regular';
    return `<div class="dia-tabla">
      <span class="dia-tabla__nombre">${t('diasLargo')[d]}</span>
      <select data-dow="${d}" data-tabla="${actual}">${opciones(actual)}</select>
    </div>`;
  }).join('');

  $('#sel-tabla-festivo').innerHTML = opciones(contrato.tablaFestivo || 'especial');

  // tipos de día que consumen el banco
  const tiposBanco = contrato.globalBancoTipos || ['regular', 'noche'];
  const TODOS = ['regular', 'noche', 'viernes', 'especial', 'septimo'];
  const nombreTipo = { regular: t('tipoRegular'), noche: t('tipoNoche'),
                       viernes: t('tramosViernes'), especial: t('tipoEspecial'),
                       septimo: t('tipoSeptimo') };
  $('#tipos-banco').innerHTML = TODOS.map(k =>
    `<button data-btipo="${k}" aria-pressed="${tiposBanco.includes(k)}">${nombreTipo[k]}</button>`).join('');

  $('#campos-banco').hidden = !contrato.globalBancoActivo;
  $('#nota-banco').textContent = t('bancoNota', { monto: shekel(contrato.globalMonto) });

  const tarifa = contrato.modo === 'horario'
    ? contrato.tarifaHora
    : contrato.salarioMensual / contrato.horasNormaMes;
  $('#nota-tarifa').textContent = t('notaTarifa', { tarifa: '₪' + tarifa.toFixed(2) });

  const dd = String(contrato.nocheDesde).padStart(2, '0');
  const hh = String(contrato.nocheHasta).padStart(2, '0');
  $('#nota-noche').textContent = `${dd}:00 – ${hh}:00 · ${t('nocheVentanaAyuda')}`;

  for (const tipo of ['regular', 'noche', 'viernes', 'especial', 'septimo']) {
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
  res.extrasPorTipo = { regular: 0, noche: 0, viernes: 0, especial: 0, septimo: 0 };
  res.ausencias = { vacaciones: { dias: 0, pago: 0, suma: 0 },
                    enfermedad: { dias: 0, pago: 0, suma: 0 } };
  for (const d of res.dias) {
    if (d.vacia) continue;
    res.horasTotal += d.horas;
    if (d.esAusencia) {
      const a = res.ausencias[d.ausencia];
      if (a) { a.dias++; a.pago += d.pago; a.suma += d.suma; }
      continue;
    }
    res.sinCubrirTotal += d.sinCubrir || 0;
    res.extrasPorTipo[d.tipo] += d.pagoExtra;
    for (const p of d.partes) res.horasPorPct[p.pct] = (res.horasPorPct[p.pct] || 0) + p.horas;
  }
  res.pagoAusencias = res.ausencias.vacaciones.suma + res.ausencias.enfermedad.suma;
  res.extras = Object.values(res.extrasPorTipo).reduce((a, v) => a + v, 0);
  res.cobraGlobal = contrato.modo === 'mensual' && contrato.globalActivo
                    && res.horasTotal >= contrato.globalUmbral;
  res.global = res.cobraGlobal ? contrato.globalMonto : 0;
  const jornadasVisibles = res.dias.filter(d => !d.vacia && !d.esAusencia).length;
  res.jornadasContadas = jornadasVisibles;
  res.viaticos = contrato.viaticosModo === 'diario'
    ? (contrato.viaticosDia || 0) * jornadasVisibles
    : (contrato.viaticos || 0);
  res.bruto = res.base + res.global + res.extras + res.viaticos + res.pagoAusencias;

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
let ausenciaElegida = '';
let montoManual = null;

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

  ausenciaElegida = j?.ausencia || '';
  montoManual = (j?.monto != null && j?.monto !== '') ? Number(j.monto) : null;
  $$('#hoja-ausencia button').forEach(b =>
    b.setAttribute('aria-pressed', String(b.dataset.aus === ausenciaElegida)));

  actualizarModoHoja();
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

/** Muestra los campos de trabajo o los de ausencia, según lo elegido. */
function actualizarModoHoja() {
  const esAusencia = !!ausenciaElegida;
  $('#bloque-trabajo').hidden  = esAusencia;
  $('#bloque-ausencia').hidden = !esAusencia;
  $('#campo-tipo-dia').hidden  = esAusencia;
  $('#hoja-previa').hidden     = esAusencia || $('#hoja-previa').hidden;
  if (esAusencia) actualizarMontoAusencia();
}

/** Calcula el monto sugerido del día de ausencia y lo muestra. */
function actualizarMontoAusencia() {
  const fecha = $('#hoja-fecha').value;
  const base  = valorDia(contrato);

  let pct = 100, numero = 1;
  if (ausenciaElegida === 'enfermedad' && fecha) {
    const porFecha = {};
    for (const j of jornadas) if (j.fecha !== editando) porFecha[j.fecha] = j;
    const indice = diaDeEnfermedad(fecha, porFecha);
    pct = pctEnfermedad(indice, contrato);
    numero = indice + 1;
  }

  const auto = base * pct / 100;
  const campo = $('#hoja-monto');
  if (montoManual == null) campo.value = auto.toFixed(2);

  const partes = [t('montoAuto', { monto: shekel(auto) })];
  if (ausenciaElegida === 'enfermedad') {
    partes.push(t('diaEnfermedadN', { n: numero, pct }));
    if (pct === 0) partes.push(t('primerDiaSinPago'));
  }
  if (contrato.modo !== 'horario') partes.push(t('cubiertoSalario'));
  partes.push(t('montoAyuda'));
  $('#monto-nota').textContent = partes.join(' · ');
  $('#btn-monto-auto').hidden = montoManual == null;
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
    case 'noche':    return clasif.horasNoche != null
                       ? t('motivoNocheHoras', { h: clasif.horasNoche.toFixed(2) })
                       : t('motivoNoche');
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

  let nueva;

  if (ausenciaElegida) {
    const escrito = $('#hoja-monto').value;
    nueva = {
      fecha,
      ausencia: ausenciaElegida,
      monto: montoManual != null && escrito !== '' ? Number(escrito) : null,
      nota: $('#hoja-nota').value.trim() || null
    };
  } else {
    const entrada = `${$('#ent-h').value}:${$('#ent-m').value}`;
    const salida  = `${$('#sal-h').value}:${$('#sal-m').value}`;
    if (horasNetas(entrada, salida, 0) == null) {
      alert(t('horarioInvalido'));
      return;
    }
    nueva = {
      fecha, entrada, salida,
      tipoManual: tipoElegido || null,
      nota: $('#hoja-nota').value.trim() || null
    };
  }

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

  ['#ent-h','#ent-m','#sal-h','#sal-m','#hoja-fecha'].forEach(sel => {
    $(sel).addEventListener('change', () => {
      if (ausenciaElegida) actualizarMontoAusencia();
      else actualizarPrevia();
    });
  });

  $$('#hoja-tipo button').forEach(b => {
    b.onclick = () => {
      tipoElegido = b.dataset.tipo;
      $$('#hoja-tipo button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      actualizarPrevia();
    };
  });

  // trabajo / vacaciones / enfermedad
  $$('#hoja-ausencia button').forEach(b => {
    b.onclick = () => {
      ausenciaElegida = b.dataset.aus;
      montoManual = null;
      $$('#hoja-ausencia button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      actualizarModoHoja();
      if (!ausenciaElegida) actualizarPrevia();
    };
  });

  $('#hoja-monto').addEventListener('input', e => {
    montoManual = e.target.value === '' ? null : Number(e.target.value);
    $('#btn-monto-auto').hidden = montoManual == null;
  });

  $('#btn-monto-auto').onclick = () => {
    montoManual = null;
    actualizarMontoAusencia();
  };

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

  // ajustes: sobre qué se calcula la pensión
  $$('#sel-pension-base button').forEach(b => {
    b.onclick = () => { contrato.pensionBase = b.dataset.pbase; persistir(); };
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

  // ajustes: qué tabla usa cada día de la semana
  document.addEventListener('change', e => {
    const d = e.target.dataset?.dow;
    if (d == null || e.target.tagName !== 'SELECT') return;
    const tablas = [...(contrato.tablaPorDia || [])];
    tablas[Number(d)] = e.target.value;
    contrato.tablaPorDia = tablas;
    persistir();
  });

  $('#sel-tabla-festivo').addEventListener('change', e => {
    contrato.tablaFestivo = e.target.value;
    persistir();
  });

  // ajustes: qué tipos de día consume el banco
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-btipo]');
    if (!b) return;
    const k = b.dataset.btipo;
    const actuales = contrato.globalBancoTipos || ['regular', 'noche'];
    contrato.globalBancoTipos = actuales.includes(k)
      ? actuales.filter(x => x !== k)
      : [...actuales, k];
    persistir();
  });

  // ajustes: escala de enfermedad
  document.addEventListener('input', e => {
    const i = e.target.dataset?.escala;
    if (i == null) return;
    const v = Number(e.target.value);
    if (Number.isNaN(v)) return;
    const escala = [...(contrato.enfermedadPct || [0, 50, 50, 100])];
    escala[Number(i)] = v;
    contrato.enfermedadPct = escala;
    persistirSuave();
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
