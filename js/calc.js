/* =============================================================
   calc.js — Motor de cálculo
   -------------------------------------------------------------
   Funciones puras: reciben datos, devuelven datos.
   No tocan el DOM ni el almacenamiento.
   Esto permite testearlas por separado y reutilizarlas.
   ============================================================= */

/* Contrato por defecto (el de Mario). Todo es editable en Ajustes. */
export const CONTRATO_DEFAULT = {
  modo: 'mensual',            // 'mensual' | 'horario'
  salarioMensual: 10500,
  tarifaHora: 60,             // sólo se usa si modo === 'horario'
  horasNormaMes: 182,         // divisor para sacar la tarifa base
  horasDia: 8.5,
  diasSemana: 5,
  pausaMin: 30,               // descuento por descanso, en minutos

  viaticosModo: 'mensual',    // 'mensual' | 'diario'
  viaticos: 1000,             // monto fijo del mes
  viaticosDia: 6,             // monto por jornada trabajada

  globalActivo: true,
  globalMonto: 3105,
  globalUmbral: 180,          // horas a superar para cobrarlo

  diasEspeciales: [5, 6],     // 0=dom 1=lun ... 5=vie 6=sáb
  festivoEsEspecial: true,
  septimoActivo: true,

  // Turno de noche: si la jornada ARRANCA dentro de esta ventana horaria,
  // la jornada regular es más corta (7 h en vez de 8).
  nocheActiva: true,
  nocheDesde: 21,             // hora del reloj, inclusive
  nocheHasta: 3,              // hora del reloj, exclusive (cruza medianoche)

  tramos: {
    regular: [
      { desde: 0,  hasta: 8,    pct: 100 },
      { desde: 8,  hasta: 10,   pct: 125 },
      { desde: 10, hasta: null, pct: 150 }
    ],
    especial: [
      { desde: 0,  hasta: 8,    pct: 150 },
      { desde: 8,  hasta: 10,   pct: 175 },
      { desde: 10, hasta: null, pct: 200 }
    ],
    noche: [
      { desde: 0, hasta: 7,  pct: 100 },
      { desde: 7, hasta: 9,  pct: 125 },
      { desde: 9, hasta: 12, pct: 150 }
    ],
    septimo: [
      { desde: 0,  hasta: null, pct: 200 }
    ]
  }
};

export const TIPOS = ['regular', 'noche', 'especial', 'septimo'];

/* ---------- utilidades de tiempo ---------- */

/** "08:35" -> 8.5833… (horas decimales) */
export function hhmmAHoras(hhmm) {
  if (!hhmm || !hhmm.includes(':')) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h + m / 60;
}

/** 9.35 -> "9:21" */
export function horasAHhmm(horas) {
  if (horas == null) return '—';
  const total = Math.round(horas * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Horas netas de una jornada, ya descontada la pausa.
 * Soporta turnos que cruzan medianoche (salida < entrada).
 */
export function horasNetas(entrada, salida, pausaMin = 0) {
  const e = hhmmAHoras(entrada);
  let s = hhmmAHoras(salida);
  if (e == null || s == null) return null;
  if (s <= e) s += 24;                     // cruzó medianoche
  const brutas = s - e;
  if (brutas > 24) return null;
  return Math.max(0, brutas - pausaMin / 60);
}

/* ---------- fechas ---------- */

export function ymd(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha + 'T12:00:00');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function diaSemana(fechaStr) {
  return new Date(fechaStr + 'T12:00:00').getDay();
}

function restarDias(fechaStr, n) {
  const d = new Date(fechaStr + 'T12:00:00');
  d.setDate(d.getDate() - n);
  return ymd(d);
}

/* ---------- clasificación del día ---------- */

/**
 * Decide si el día es regular, especial o séptimo.
 * El override manual del usuario siempre gana.
 *
 * @param jornada       la jornada a clasificar
 * @param jornadasPorFecha  mapa { 'YYYY-MM-DD': jornada } para mirar días previos
 * @param contrato
 * @param festivos      Set de fechas 'YYYY-MM-DD' que son חג
 */
export function resolverTipo(jornada, jornadasPorFecha, contrato, festivos) {
  if (jornada.tipoManual) {
    return { tipo: jornada.tipoManual, automatico: false, motivo: 'Fijado a mano' };
  }

  // 7.º día consecutivo: los 6 días previos tienen que estar trabajados
  if (contrato.septimoActivo) {
    let seguidos = 0;
    for (let i = 1; i <= 6; i++) {
      const prev = jornadasPorFecha[restarDias(jornada.fecha, i)];
      if (prev && horasNetas(prev.entrada, prev.salida, 0) > 0) seguidos++;
      else break;
    }
    if (seguidos === 6) {
      return { tipo: 'septimo', automatico: true, motivo: '7 días seguidos trabajados' };
    }
  }

  if (contrato.festivoEsEspecial && festivos && festivos.has(jornada.fecha)) {
    return { tipo: 'especial', automatico: true, motivo: 'Festivo' };
  }

  const dow = diaSemana(jornada.fecha);
  if (contrato.diasEspeciales.includes(dow)) {
    const nombres = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    return { tipo: 'especial', automatico: true, motivo: `Es ${nombres[dow]}` };
  }

  // Turno de noche: se decide por la hora en que ARRANCA la jornada.
  // La ventana cruza la medianoche, por eso los dos casos.
  if (contrato.nocheActiva && esNocturna(jornada.entrada, contrato)) {
    return {
      tipo: 'noche', automatico: true, entrada: jornada.entrada,
      motivo: `Entra ${jornada.entrada}, dentro del turno de noche`
    };
  }

  return { tipo: 'regular', automatico: true, motivo: 'Día hábil' };
}

/** ¿La hora de entrada cae dentro de la ventana nocturna? */
export function esNocturna(entrada, contrato) {
  const h = hhmmAHoras(entrada);
  if (h == null) return false;
  const d = contrato.nocheDesde, f = contrato.nocheHasta;
  return d > f ? (h >= d || h < f) : (h >= d && h < f);
}

/* ---------- reparto por tramos ---------- */

/**
 * Reparte las horas trabajadas entre los tramos configurados.
 * Devuelve [{ desde, hasta, pct, horas }]
 */
export function repartirTramos(horas, tramos) {
  const salida = [];
  for (const t of tramos) {
    const tope = t.hasta == null ? Infinity : t.hasta;
    const enTramo = Math.min(horas, tope) - t.desde;
    if (enTramo > 0.0001) {
      salida.push({ desde: t.desde, hasta: t.hasta, pct: t.pct, horas: enTramo });
    }
  }
  return salida;
}

/**
 * Horas trabajadas que no entran en ningún tramo.
 * Pasa cuando el último tramo tiene tope y la jornada lo supera.
 * Nunca se descartan en silencio: la interfaz avisa.
 */
export function horasSinCubrir(horas, partes) {
  const cubiertas = partes.reduce((s, p) => s + p.horas, 0);
  const resto = horas - cubiertas;
  return resto > 0.0001 ? resto : 0;
}

/** Tarifa base por hora según el modo del contrato. */
export function tarifaBase(contrato) {
  return contrato.modo === 'horario'
    ? contrato.tarifaHora
    : contrato.salarioMensual / contrato.horasNormaMes;
}

/* ---------- cálculo de una jornada ---------- */

export function calcularJornada(jornada, jornadasPorFecha, contrato, festivos) {
  const neto = horasNetas(jornada.entrada, jornada.salida, contrato.pausaMin);
  if (neto == null || neto <= 0) return null;

  const clasif = resolverTipo(jornada, jornadasPorFecha, contrato, festivos);
  const tramos = contrato.tramos[clasif.tipo] || contrato.tramos.regular;
  const partes = repartirTramos(neto, tramos);
  const tarifa = tarifaBase(contrato);

  let pagoTotal = 0;   // lo que valen todas las horas del día
  let pagoExtra = 0;   // lo que se cobra ADEMÁS del salario base

  for (const p of partes) {
    const importe = p.horas * tarifa * (p.pct / 100);
    p.importe = importe;
    pagoTotal += importe;

    // En modo mensual, el salario base ya cubre las horas al 100 %.
    // Todo lo que supere el 100 % se cobra aparte, a tarifa completa.
    if (contrato.modo === 'horario' || p.pct > 100) {
      p.esExtra = true;
      pagoExtra += importe;
    } else {
      p.esExtra = false;
    }
  }

  return {
    fecha: jornada.fecha,
    horas: neto,
    sinCubrir: horasSinCubrir(neto, partes),
    tipo: clasif.tipo,
    automatico: clasif.automatico,
    motivo: clasif.motivo,
    clasif,
    partes,
    pagoTotal,
    pagoExtra
  };
}

/* ---------- cálculo del mes ---------- */

export function calcularMes(jornadas, contrato, festivos) {
  const porFecha = {};
  for (const j of jornadas) porFecha[j.fecha] = j;

  const dias = [];
  let horasTotal = 0;
  let jornadasContadas = 0;
  let sinCubrirTotal = 0;
  const extrasPorTipo = { regular: 0, noche: 0, especial: 0, septimo: 0 };
  const horasPorPct = {};

  for (const j of jornadas) {
    const r = calcularJornada(j, porFecha, contrato, festivos);
    if (!r) { dias.push({ fecha: j.fecha, vacia: true }); continue; }
    dias.push(r);
    horasTotal += r.horas;
    sinCubrirTotal += r.sinCubrir;
    jornadasContadas++;
    extrasPorTipo[r.tipo] += r.pagoExtra;
    for (const p of r.partes) {
      horasPorPct[p.pct] = (horasPorPct[p.pct] || 0) + p.horas;
    }
  }

  dias.sort((a, b) => a.fecha.localeCompare(b.fecha));

  const extras = extrasPorTipo.regular + extrasPorTipo.noche
               + extrasPorTipo.especial + extrasPorTipo.septimo;
  const cobraGlobal = contrato.modo === 'mensual'
    && contrato.globalActivo
    && horasTotal >= contrato.globalUmbral;
  const global = cobraGlobal ? contrato.globalMonto : 0;
  const base = contrato.modo === 'mensual' ? contrato.salarioMensual : 0;
  const viaticos = calcularViaticos(contrato, jornadasContadas);
  const bruto = base + global + extras + viaticos;

  return {
    dias,
    horasTotal,
    sinCubrirTotal,
    horasPorPct,
    base,
    global,
    cobraGlobal,
    extras,
    extrasPorTipo,
    viaticos,
    jornadasContadas,
    bruto,
    tarifa: tarifaBase(contrato)
  };
}

/** Viáticos: monto fijo del mes, o tantos por jornada trabajada. */
export function calcularViaticos(contrato, jornadas) {
  return contrato.viaticosModo === 'diario'
    ? (contrato.viaticosDia || 0) * jornadas
    : (contrato.viaticos || 0);
}

/* ---------- formato ---------- */

let localeActual = 'es-AR';
export function setLocale(l) { localeActual = l; }

export function shekel(n) {
  return '₪' + Math.round(n).toLocaleString(localeActual);
}

export function horasTxt(n) {
  return n.toFixed(2).replace(/\.00$/, '') + ' h';
}
