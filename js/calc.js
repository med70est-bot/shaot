/* =============================================================
   calc.js — Motor de cálculo
   -------------------------------------------------------------
   Funciones puras: reciben datos, devuelven datos.
   No tocan el DOM ni el almacenamiento.
   ============================================================= */

/* Nombres de las tablas de tramos disponibles. */
export const TABLAS = ['regular', 'noche', 'viernes', 'especial', 'septimo'];

/* Contrato por defecto. Todo se edita desde Ajustes. */
export const CONTRATO_DEFAULT = {
  modo: 'mensual',            // 'mensual' | 'horario'
  salarioMensual: 10500,
  tarifaHora: 60,             // sólo si modo === 'horario'
  horasNormaMes: 182,         // תקן: divisor para sacar la tarifa por hora
  horasDia: 8.5,
  pausaMin: 30,               // se descuenta de cada jornada

  viaticosModo: 'mensual',    // 'mensual' | 'diario'
  viaticos: 1000,
  viaticosDia: 6,

  /* Monto global: se cobra al superar el umbral de horas. */
  globalActivo: true,
  globalMonto: 3105,
  globalUmbral: 182,

  /* Ese monto es el pago por adelantado de un banco de horas extra.
     Mientras queden horas en el banco, las extras de días comunes ya
     están cobradas y no se suman de nuevo. */
  globalBancoActivo: true,
  globalBancoHoras: 44,
  globalBancoTipos: ['regular', 'noche'],

  /* Qué tabla usa cada día de la semana (0=dom … 6=sáb).
     Así el viernes puede tener condiciones distintas del sábado. */
  esquemaTablas: 1,
  tablaPorDia: ['regular', 'regular', 'regular', 'regular', 'regular', 'viernes', 'especial'],
  tablaFestivo: 'especial',
  festivoEsEspecial: true,

  septimoActivo: true,

  /* Turno de noche: se mide cuántas horas caen dentro de la franja.
     No importa a qué hora se entra. */
  nocheActiva: true,
  nocheDesde: 22,
  nocheHasta: 6,
  nocheMinHoras: 2,

  /* Ausencias */
  valorDiaAuto: true,
  valorDia: 0,
  enfermedadPct: [0, 50, 50, 100],
  ausenciasCuentanHoras: true,

  /* Estimación del neto */
  netoActivo: true,
  puntosCredito: 2.25,
  pensionPct: 6,
  pensionBase: 'salario',     // 'salario' | 'bruto'
  otrosDescuentos: 0,

  tramos: {
    regular: [
      { desde: 0,  hasta: 8,    pct: 100 },
      { desde: 8,  hasta: 10,   pct: 125 },
      { desde: 10, hasta: null, pct: 150 }
    ],
    noche: [
      { desde: 0, hasta: 7,  pct: 100 },
      { desde: 7, hasta: 9,  pct: 125 },
      { desde: 9, hasta: 12, pct: 150 }
    ],
    viernes: [
      { desde: 0,  hasta: 8,    pct: 150 },
      { desde: 8,  hasta: 10,   pct: 175 },
      { desde: 10, hasta: null, pct: 200 }
    ],
    especial: [
      { desde: 0,  hasta: 8,    pct: 150 },
      { desde: 8,  hasta: 10,   pct: 175 },
      { desde: 10, hasta: null, pct: 200 }
    ],
    septimo: [
      { desde: 0, hasta: null, pct: 200 }
    ]
  }
};

export const AUSENCIAS = ['vacaciones', 'enfermedad'];

/* ---------- utilidades de tiempo ---------- */

/** "08:35" → 8.5833… */
export function hhmmAHoras(hhmm) {
  if (typeof hhmm !== 'string' || !hhmm.includes(':')) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h + m / 60;
}

/** 9.35 → "9:21" */
export function horasAHhmm(horas) {
  if (horas == null) return '—';
  const total = Math.round(horas * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Horas netas ya descontada la pausa. Soporta turnos que cruzan medianoche. */
export function horasNetas(entrada, salida, pausaMin = 0) {
  const e = hhmmAHoras(entrada);
  let s = hhmmAHoras(salida);
  if (e == null || s == null) return null;
  if (s <= e) s += 24;
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

/* ---------- turno de noche ---------- */

/**
 * Cuántas horas de la jornada caen dentro de la franja nocturna.
 * Tanto la jornada como la franja pueden cruzar la medianoche, así que
 * se compara contra la franja de ayer, la de hoy y la de mañana.
 */
export function horasEnFranjaNocturna(entrada, salida, contrato) {
  const e = hhmmAHoras(entrada);
  let s = hhmmAHoras(salida);
  if (e == null || s == null) return 0;
  if (s <= e) s += 24;

  const desde = contrato.nocheDesde;
  const hasta = contrato.nocheHasta <= desde ? contrato.nocheHasta + 24 : contrato.nocheHasta;

  let total = 0;
  for (const k of [-1, 0, 1]) {
    total += Math.max(0, Math.min(s, hasta + 24 * k) - Math.max(e, desde + 24 * k));
  }
  return total;
}

/* ---------- clasificación del día ---------- */

const NOMBRES_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * Decide qué tabla de tramos usa el día.
 * El orden importa: lo elegido a mano gana, después el séptimo día,
 * después el festivo, después el día de la semana, y recién ahí la noche.
 */
export function resolverTipo(jornada, jornadasPorFecha, contrato, festivos) {
  if (jornada.tipoManual) {
    return { tipo: jornada.tipoManual, automatico: false, motivo: 'Fijado a mano' };
  }

  if (contrato.septimoActivo) {
    let seguidos = 0;
    for (let i = 1; i <= 6; i++) {
      const prev = jornadasPorFecha[restarDias(jornada.fecha, i)];
      const trabajado = prev && (prev.ausencia
        ? false
        : horasNetas(prev.entrada, prev.salida, 0) > 0);
      if (trabajado) seguidos++; else break;
    }
    if (seguidos === 6) {
      return { tipo: 'septimo', automatico: true, motivo: '7 días seguidos trabajados' };
    }
  }

  if (contrato.festivoEsEspecial && festivos && festivos.has(jornada.fecha)) {
    return { tipo: contrato.tablaFestivo || 'especial', automatico: true, motivo: 'Festivo' };
  }

  const dow = diaSemana(jornada.fecha);
  const tabla = (contrato.tablaPorDia || [])[dow] || 'regular';
  if (tabla !== 'regular') {
    return { tipo: tabla, automatico: true, dow, motivo: `Es ${NOMBRES_DIA[dow]}` };
  }

  if (contrato.nocheActiva) {
    const dentro = horasEnFranjaNocturna(jornada.entrada, jornada.salida, contrato);
    if (dentro >= (contrato.nocheMinHoras ?? 2) - 0.0001) {
      return {
        tipo: 'noche', automatico: true, horasNoche: dentro,
        motivo: `${dentro.toFixed(2)} h dentro de la franja nocturna`
      };
    }
  }

  return { tipo: 'regular', automatico: true, dow, motivo: 'Día hábil' };
}

/* ---------- reparto por tramos ---------- */

/** Reparte las horas entre los tramos configurados. */
export function repartirTramos(horas, tramos) {
  const salida = [];
  for (const t of tramos || []) {
    const tope = t.hasta == null ? Infinity : t.hasta;
    const enTramo = Math.min(horas, tope) - t.desde;
    if (enTramo > 0.0001) {
      salida.push({ desde: t.desde, hasta: t.hasta, pct: t.pct, horas: enTramo });
    }
  }
  return salida;
}

/**
 * Horas que no entran en ningún tramo, porque el último tiene tope y la
 * jornada lo superó. Nunca se descartan en silencio: la interfaz avisa.
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

/* ---------- ausencias ---------- */

/** Cuánto vale un día completo de ausencia. */
export function valorDia(contrato) {
  if (contrato.valorDiaAuto === false && contrato.valorDia > 0) return contrato.valorDia;
  return (contrato.horasDia || 8) * tarifaBase(contrato);
}

/** Qué número de día de enfermedad seguido es. 0 = el primero. */
export function diaDeEnfermedad(fecha, jornadasPorFecha) {
  let seguidos = 0;
  for (let k = 1; k <= 60; k++) {
    const prev = jornadasPorFecha[restarDias(fecha, k)];
    if (prev && prev.ausencia === 'enfermedad') seguidos++;
    else break;
  }
  return seguidos;
}

/** Porcentaje según la escala de enfermedad. */
export function pctEnfermedad(indice, contrato) {
  const escala = contrato.enfermedadPct || [0, 50, 50, 100];
  return escala[Math.min(indice, escala.length - 1)] ?? 100;
}

function calcularAusencia(jornada, jornadasPorFecha, contrato) {
  const base = valorDia(contrato);
  let pct = 100, indice = 0;

  if (jornada.ausencia === 'enfermedad') {
    indice = diaDeEnfermedad(jornada.fecha, jornadasPorFecha);
    pct = pctEnfermedad(indice, contrato);
  }

  const automatico = base * pct / 100;
  const manual = jornada.monto != null && jornada.monto !== '';
  const pago = manual ? Number(jornada.monto) : automatico;

  // En sueldo mensual la ausencia ya está dentro del salario base:
  // se muestra el valor, pero no se suma aparte.
  const suma = contrato.modo === 'horario' ? pago : 0;

  return {
    fecha: jornada.fecha,
    esAusencia: true,
    ausencia: jornada.ausencia,
    tipo: jornada.ausencia,
    horas: contrato.ausenciasCuentanHoras ? (contrato.horasDia || 8) : 0,
    pctAusencia: pct,
    numeroDia: indice + 1,
    valorBase: base,
    pagoAuto: automatico,
    pago,
    manual,
    suma,
    partes: [],
    pagoExtra: 0,
    pagoTotal: pago,
    sinCubrir: 0,
    motivo: ''
  };
}

/* ---------- cálculo de una jornada ---------- */

export function calcularJornada(jornada, jornadasPorFecha, contrato, festivos) {
  if (jornada.ausencia) return calcularAusencia(jornada, jornadasPorFecha, contrato);

  const neto = horasNetas(jornada.entrada, jornada.salida, contrato.pausaMin);
  if (neto == null || neto <= 0) return null;

  const clasif = resolverTipo(jornada, jornadasPorFecha, contrato, festivos);
  const tramos = contrato.tramos[clasif.tipo] || contrato.tramos.regular;
  const partes = repartirTramos(neto, tramos);
  const tarifa = tarifaBase(contrato);

  let pagoTotal = 0, pagoExtra = 0;

  for (const p of partes) {
    p.importe = p.horas * tarifa * (p.pct / 100);
    pagoTotal += p.importe;

    // En modo mensual el salario base cubre las horas al 100 %.
    // Lo que supere el 100 % se cobra aparte, a tarifa completa.
    p.esExtra = contrato.modo === 'horario' || p.pct > 100;
    if (p.esExtra) pagoExtra += p.importe;
  }

  return {
    fecha: jornada.fecha,
    horas: neto,
    tipo: clasif.tipo,
    automatico: clasif.automatico,
    motivo: clasif.motivo,
    clasif,
    partes,
    sinCubrir: horasSinCubrir(neto, partes),
    pagoTotal,
    pagoExtra
  };
}

/* ---------- banco de horas del monto global ---------- */

/**
 * El monto global es el pago por adelantado de un banco de horas extra.
 * Mientras queden horas, las extras de los días que consumen el banco ya
 * están cobradas y no se suman de nuevo. Recién al agotarlo se pagan aparte.
 *
 * Los viernes, sábados, festivos y el séptimo día no lo tocan por defecto:
 * se pagan siempre, porque no es lo que el global compra.
 *
 * Modifica los días recibidos y devuelve el resumen del banco.
 */
export function aplicarBanco(dias, contrato) {
  const activo = contrato.modo === 'mensual'
              && contrato.globalActivo
              && contrato.globalBancoActivo
              && (contrato.globalBancoHoras || 0) > 0;

  const horas = activo ? contrato.globalBancoHoras : 0;
  const tablas = contrato.globalBancoTipos || ['regular', 'noche'];
  const tarifa = tarifaBase(contrato);
  let restante = horas, importe = 0;

  for (const d of dias) {
    if (d.vacia || d.esAusencia || !d.partes) continue;

    d.horasBanco = 0;
    d.importeBanco = 0;

    const consume = activo && tablas.includes(d.tipo);
    let pagado = 0;

    for (const p of d.partes) {
      p.horasBanco = 0;
      p.importeBanco = 0;
      p.cubiertoBanco = false;
      p.importePagado = p.esExtra ? p.importe : 0;

      if (!consume || !p.esExtra || restante <= 0.0001) {
        pagado += p.importePagado;
        continue;
      }

      const cubiertas = Math.min(p.horas, restante);
      const valor = cubiertas * tarifa * p.pct / 100;

      p.horasBanco = cubiertas;
      p.importeBanco = valor;
      p.importePagado = p.importe - valor;
      p.cubiertoBanco = cubiertas >= p.horas - 0.0001;

      restante -= cubiertas;
      importe += valor;
      d.horasBanco += cubiertas;
      d.importeBanco += valor;
      pagado += p.importePagado;
    }

    d.pagoExtra = pagado;
  }

  return { activo, horas, usadas: horas - restante, restante, importe };
}

/* ---------- viáticos ---------- */

export function calcularViaticos(contrato, jornadas) {
  return contrato.viaticosModo === 'diario'
    ? (contrato.viaticosDia || 0) * jornadas
    : (contrato.viaticos || 0);
}

/* ---------- cálculo del mes ---------- */

export function calcularMes(jornadas, contrato, festivos) {
  const porFecha = {};
  for (const j of jornadas) porFecha[j.fecha] = j;

  // Fase 1: cada día por separado.
  const dias = [];
  for (const j of jornadas) {
    const r = calcularJornada(j, porFecha, contrato, festivos);
    dias.push(r || { fecha: j.fecha, vacia: true });
  }
  dias.sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Fase 2: el banco consume las extras que le tocan, en orden de fecha.
  const banco = aplicarBanco(dias, contrato);

  // Fase 3: sumar los totales.
  let horasTotal = 0, jornadasContadas = 0, sinCubrirTotal = 0;
  const extrasPorTipo = { regular: 0, noche: 0, viernes: 0, especial: 0, septimo: 0 };
  const ausencias = {
    vacaciones: { dias: 0, pago: 0, suma: 0 },
    enfermedad: { dias: 0, pago: 0, suma: 0 }
  };
  const horasPorPct = {};

  for (const r of dias) {
    if (r.vacia) continue;
    horasTotal += r.horas;

    if (r.esAusencia) {
      const a = ausencias[r.ausencia];
      if (a) { a.dias++; a.pago += r.pago; a.suma += r.suma; }
      continue;
    }

    sinCubrirTotal += r.sinCubrir;
    jornadasContadas++;
    extrasPorTipo[r.tipo] = (extrasPorTipo[r.tipo] || 0) + r.pagoExtra;
    for (const p of r.partes) {
      horasPorPct[p.pct] = (horasPorPct[p.pct] || 0) + p.horas;
    }
  }

  const extras = Object.values(extrasPorTipo).reduce((s, v) => s + v, 0);
  const cobraGlobal = contrato.modo === 'mensual'
    && contrato.globalActivo
    && horasTotal >= contrato.globalUmbral;
  const global = cobraGlobal ? contrato.globalMonto : 0;
  const base = contrato.modo === 'mensual' ? contrato.salarioMensual : 0;
  const viaticos = calcularViaticos(contrato, jornadasContadas);
  const pagoAusencias = ausencias.vacaciones.suma + ausencias.enfermedad.suma;
  const bruto = base + global + extras + viaticos + pagoAusencias;

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
    banco,
    ausencias,
    pagoAusencias,
    viaticos,
    jornadasContadas,
    bruto,
    tarifa: tarifaBase(contrato)
  };
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
