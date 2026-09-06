/* =============================================================
   store.js — Persistencia
   -------------------------------------------------------------
   Todo vive en localStorage, en el teléfono de cada persona.
   No hay servidor: nadie más puede ver estos datos.
   ============================================================= */

import { CONTRATO_DEFAULT } from './calc.js';

const K_CONTRATO = 'shaot.contrato';
const K_JORNADAS = 'shaot.jornadas';
const K_RECIBOS  = 'shaot.recibos';
const K_FESTIVOS = 'shaot.festivos';

function leer(clave, porDefecto) {
  try {
    const txt = localStorage.getItem(clave);
    return txt ? JSON.parse(txt) : porDefecto;
  } catch (e) {
    console.warn('No se pudo leer', clave, e);
    return porDefecto;
  }
}

function escribir(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (e) {
    console.warn('No se pudo guardar', clave, e);
    return false;
  }
}

/* ---------- contrato ---------- */

export function cargarContrato() {
  const guardado = leer(K_CONTRATO, null);
  if (!guardado) return structuredClone(CONTRATO_DEFAULT);
  // Mezcla con el default para que las versiones nuevas no rompan datos viejos
  return {
    ...structuredClone(CONTRATO_DEFAULT),
    ...guardado,
    tramos: { ...structuredClone(CONTRATO_DEFAULT.tramos), ...(guardado.tramos || {}) }
  };
}

export function guardarContrato(c) { return escribir(K_CONTRATO, c); }

/* ---------- jornadas ---------- */

export function cargarJornadas() { return leer(K_JORNADAS, []); }

export function guardarJornadas(js) { return escribir(K_JORNADAS, js); }

export function jornadasDelMes(todas, mes) {
  return todas.filter(j => j.fecha.startsWith(mes))
              .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Devuelve también las del mes anterior: hacen falta para detectar el 7.º día. */
export function jornadasConContexto(todas, mes) {
  const [a, m] = mes.split('-').map(Number);
  const prev = new Date(a, m - 2, 1);
  const mesPrev = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  return todas.filter(j => j.fecha.startsWith(mes) || j.fecha.startsWith(mesPrev));
}

/* ---------- recibos (lo cobrado según el תלוש) ---------- */

export function cargarRecibos() { return leer(K_RECIBOS, {}); }

export function guardarRecibo(mes, bruto) {
  const r = cargarRecibos();
  if (bruto === null || bruto === '') delete r[mes];
  else r[mes] = Number(bruto);
  return escribir(K_RECIBOS, r);
}

/* ---------- festivos (Hebcal) ---------- */

export function festivosGuardados() { return leer(K_FESTIVOS, {}); }

/**
 * Trae los festivos judíos del año desde Hebcal y los cachea.
 * Si no hay conexión, usa lo que ya esté guardado.
 * Sólo marcamos los días en que efectivamente no se trabaja (yomtov).
 */
export async function asegurarFestivos(anio) {
  const cache = festivosGuardados();
  if (cache[anio]) return cache;

  const url = `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=off&mod=off`
            + `&nx=off&ss=off&mf=off&c=off&year=${anio}&month=x&geo=none`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Hebcal ' + res.status);
    const data = await res.json();
    const dias = {};
    for (const item of (data.items || [])) {
      if (item.yomtov && item.date) {
        dias[item.date.slice(0, 10)] = item.title;
      }
    }
    cache[anio] = dias;
    escribir(K_FESTIVOS, cache);
  } catch (e) {
    console.warn('Festivos no disponibles sin conexión:', e.message);
    cache[anio] = cache[anio] || {};
  }
  return cache;
}

export function setFestivos(cache) {
  const s = new Set();
  for (const anio of Object.keys(cache)) {
    for (const f of Object.keys(cache[anio] || {})) s.add(f);
  }
  return s;
}

/* ---------- respaldo ---------- */

export function exportarTodo() {
  return JSON.stringify({
    version: 1,
    exportado: new Date().toISOString(),
    contrato: cargarContrato(),
    jornadas: cargarJornadas(),
    recibos: cargarRecibos()
  }, null, 2);
}

export function importarTodo(texto) {
  const data = JSON.parse(texto);
  if (!data.jornadas) throw new Error('El archivo no tiene jornadas.');
  if (data.contrato) escribir(K_CONTRATO, data.contrato);
  escribir(K_JORNADAS, data.jornadas);
  if (data.recibos) escribir(K_RECIBOS, data.recibos);
  return data.jornadas.length;
}
