/* =============================================================
   impuestos.js — Descuentos de ley (Israel)
   -------------------------------------------------------------
   Valores de 2026, verificados contra recibos reales.
   Funciones puras: entra un bruto, sale el detalle de descuentos.

   Importante: el impuesto a las ganancias en Israel se liquida de
   forma ACUMULADA sobre el año. Acá se calcula mes por mes de forma
   aislada, así que el número puede diferir del recibo aunque el
   total del año cierre. La interfaz lo aclara.
   ============================================================= */

export const TASAS = {
  anio: 2026,

  /* Tramos mensuales de מס הכנסה. Se ensancharon en enero de 2026
     (tikún 288): el 20 % llega hasta 19.000 y el 31 % hasta 25.100. */
  tramosImpuesto: [
    { hasta:  7010, pct: 10 },
    { hasta: 10060, pct: 14 },
    { hasta: 19000, pct: 20 },
    { hasta: 25100, pct: 31 },
    { hasta: 46690, pct: 35 },
    { hasta: 60130, pct: 47 },
    { hasta:  null, pct: 50 }   // incluye el 3 % de מס יסף
  ],

  /* נקודת זיכוי: cada punto descuenta este monto del impuesto. */
  puntoCredito: 242,

  /* ביטוח לאומי y ביטוח בריאות: dos tramos, con tope mensual. */
  umbralReducido: 7703,     // 60 % del salario promedio
  techo: 51910,             // por encima no se aporta
  leumiReducida: 1.04,
  leumiPlena: 7.00,
  saludReducida: 3.23,
  saludPlena: 5.17,

  /* Crédito por aportes a pensión: se descuenta del impuesto. */
  creditoPensionPct: 35
};

/** Reparte un monto entre los tramos y devuelve el impuesto bruto. */
export function impuestoPorTramos(imponible, tramos = TASAS.tramosImpuesto) {
  let total = 0, desde = 0;
  const detalle = [];
  for (const t of tramos) {
    const tope = t.hasta == null ? Infinity : t.hasta;
    const enTramo = Math.min(imponible, tope) - desde;
    if (enTramo > 0) {
      const monto = enTramo * t.pct / 100;
      detalle.push({ desde, hasta: t.hasta, pct: t.pct, base: enTramo, monto });
      total += monto;
    }
    desde = tope;
    if (imponible <= tope) break;
  }
  return { total, detalle };
}

/** מס הכנסה: tramos, menos puntos de crédito, menos crédito por pensión. */
export function impuestoRenta(imponible, puntos, aportePension, tasas = TASAS) {
  const { total: bruto, detalle } = impuestoPorTramos(imponible, tasas.tramosImpuesto);
  const creditoPuntos  = (puntos || 0) * tasas.puntoCredito;
  const creditoPension = (aportePension || 0) * tasas.creditoPensionPct / 100;
  const neto = Math.max(0, bruto - creditoPuntos - creditoPension);
  return { bruto, creditoPuntos, creditoPension, neto, detalle };
}

/** Aporte en dos tramos con tope, usado por Bituaj Leumi y Salud. */
function dosTramos(base, reducida, plena, tasas) {
  const tope = Math.min(base, tasas.techo);
  const parteBaja = Math.min(tope, tasas.umbralReducido);
  const parteAlta = Math.max(0, tope - tasas.umbralReducido);
  return parteBaja * reducida / 100 + parteAlta * plena / 100;
}

export function bituajLeumi(base, tasas = TASAS) {
  return dosTramos(base, tasas.leumiReducida, tasas.leumiPlena, tasas);
}

export function seguroSalud(base, tasas = TASAS) {
  return dosTramos(base, tasas.saludReducida, tasas.saludPlena, tasas);
}

/**
 * Descuentos completos de un mes.
 *
 * @param bruto     bruto del mes que calculó la app
 * @param contrato  de ahí salen puntos de crédito, % y base de pensión
 */
export function calcularNeto(bruto, contrato, tasas = TASAS) {
  const basePension = contrato.pensionBase === 'salario' && contrato.modo === 'mensual'
    ? contrato.salarioMensual
    : bruto;
  const pension = basePension * (contrato.pensionPct || 0) / 100;

  const renta   = impuestoRenta(bruto, contrato.puntosCredito, pension, tasas);
  const leumi   = bituajLeumi(bruto, tasas);
  const salud   = seguroSalud(bruto, tasas);
  const otros   = contrato.otrosDescuentos || 0;

  const descuentos = renta.neto + leumi + salud + pension + otros;

  return {
    bruto,
    impuesto: renta.neto,
    impuestoBruto: renta.bruto,
    creditoPuntos: renta.creditoPuntos,
    creditoPension: renta.creditoPension,
    tramosImpuesto: renta.detalle,
    leumi,
    salud,
    pension,
    basePension,
    otros,
    descuentos,
    neto: bruto - descuentos,
    marginal: marginalDe(bruto, tasas)
  };
}

/** Tasa marginal: cuánto se lleva el impuesto del próximo shekel. */
export function marginalDe(imponible, tasas = TASAS) {
  let desde = 0;
  for (const t of tasas.tramosImpuesto) {
    const tope = t.hasta == null ? Infinity : t.hasta;
    if (imponible <= tope) return t.pct;
    desde = tope;
  }
  return tasas.tramosImpuesto[tasas.tramosImpuesto.length - 1].pct;
}
