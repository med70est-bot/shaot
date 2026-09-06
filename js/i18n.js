/* =============================================================
   i18n.js — Textos en español y hebreo
   -------------------------------------------------------------
   Para agregar otro idioma alcanza con copiar el bloque y
   traducir los valores. Las claves no se tocan.
   ============================================================= */

export const IDIOMAS = {
  es: { nombre: 'Español', dir: 'ltr', locale: 'es-AR' },
  he: { nombre: 'עברית',   dir: 'rtl', locale: 'he-IL' }
};

const T = {
  es: {
    marca: 'Shaot',
    marcaSub: 'horas y sueldo',
    hoy: 'Hoy',

    tabHoras: 'Horas',
    tabResumen: 'Resumen',
    tabAjustes: 'Ajustes',

    mesAnterior: 'Mes anterior',
    mesSiguiente: 'Mes siguiente',

    vacioTitulo: 'Todavía no hay jornadas en este mes',
    vacioTexto: 'Tocá «Cargar día» y anotá la entrada y la salida.<br>La app se encarga del resto.',

    cargarDia: 'Cargar día',
    sinJornadas: 'sin jornadas cargadas',
    jornada: 'jornada',
    jornadas: 'jornadas',

    editar: 'Editar',
    borrar: 'Borrar',
    cubiertoBase: 'cubierto por el base',
    confirmarBorrar: '¿Borrar la jornada del',

    tipoRegular: 'Regular',
    tipoNoche: 'Noche',
    tipoEspecial: 'Especial',
    tipoSeptimo: '7.º día',
    tipoAuto: 'Automático',

    motivoManual: 'Fijado a mano',
    motivoHabil: 'Día hábil',
    motivoFestivo: 'Festivo',
    motivoSeptimo: '7 días seguidos trabajados',
    motivoEs: 'Es',
    motivoNoche: 'dentro del turno de noche',
    motivoEntra: 'Entra',

    objetivo: 'objetivo',
    superaste: 'Superaste el umbral: el bonus de {monto} se cobra.',
    faltan: 'Faltan {horas} h para cobrar el bonus.',

    horasPorTarifa: 'Horas por tarifa',
    repartoVacio: 'Cargá jornadas para ver el reparto.',

    deberiaCobrar: 'Lo que debería cobrar',
    sueldoBase: 'Sueldo base',
    bonusGlobal: 'Bonus por horas globales',
    extrasRegulares: 'Extras de días regulares',
    extrasNoche: 'Extras de turnos de noche',
    extrasEspeciales: 'Extras de viernes, sábado y festivos',
    extrasSeptimo: 'Extras del 7.º día',
    horasTrabajadas: 'Horas trabajadas',
    viaticos: 'Viáticos',
    brutoMes: 'Bruto del mes',

    reciboEtiqueta: 'Bruto que figura en el recibo',
    reciboPlaceholder: 'Escribí el monto del recibo',
    falta: 'Falta cobrar',
    sobra: 'Cobraste de más',
    coincide: 'Coincide',
    revisar: 'Revisalo con administración antes de reclamar.',

    respaldo: 'Respaldo',
    descargarCopia: 'Descargar copia de seguridad',
    restaurar: 'Restaurar desde archivo',
    respaldoNota: 'Los datos viven sólo en este teléfono. Si lo cambiás o borrás la app, se pierden sin una copia.',
    restaurado: 'Listo: se restauraron {n} jornadas.',
    errorArchivo: 'No se pudo leer el archivo: ',

    idioma: 'Idioma',
    comoPagan: 'Cómo te pagan',
    modoMensual: 'Sueldo mensual',
    modoHorario: 'Por hora',
    salarioBase: 'Sueldo base',
    salarioBaseAyuda: 'Bruto fijo del mes',
    horasNorma: 'Horas norma del mes',
    horasNormaAyuda: 'Divisor para sacar la tarifa por hora',
    tarifaHora: 'Tarifa por hora',
    tarifaHoraAyuda: 'Valor de la hora al 100 %',
    pausa: 'Pausa por jornada',
    pausaAyuda: 'Minutos que se descuentan de cada día',
    viaticosModo: 'Cómo se pagan los viáticos',
    viaticosFijo: 'Fijo al mes',
    viaticosDiario: 'Por jornada',
    viaticosMonto: 'Monto mensual',
    viaticosPorDia: 'Monto por jornada',
    notaTarifa: 'Tu hora al 100 % vale {tarifa}. Todos los porcentajes salen de este número.',

    bonusTitulo: 'Bonus por horas globales',
    bonusAyuda: 'Monto extra al superar cierta cantidad de horas',
    bonusMonto: 'Monto del bonus',
    bonusUmbral: 'A partir de',
    bonusUmbralAyuda: 'Horas del mes que hay que superar',

    diasEspeciales: 'Días con tarifa especial',
    festivos: 'Festivos judíos',
    festivosAyuda: 'Se detectan solos y se pagan como día especial',
    septimo: '7.º día seguido',
    septimoAyuda: 'Marca solo el día que sigue a 6 días trabajados',

    turnoNoche: 'Turno de noche',
    turnoNocheAyuda: 'Jornada más corta cuando se entra de noche',
    nocheDesde: 'Entrando desde las',
    nocheHasta: 'Hasta las',
    nocheVentanaAyuda: 'Si la jornada arranca dentro de esta franja, se usa la tabla de noche.',

    tramosTitulo: 'Tarifas por tramo de horas',
    tramosAyuda: 'Cada fila cubre un tramo de la jornada, contado desde que entrás. Dejá el «hasta» vacío para que llegue hasta el final.',
    tramosRegular: 'Día regular',
    tramosNoche: 'Turno de noche',
    tramosEspecial: 'Viernes, sábado y festivos',
    tramosSeptimo: '7.º día seguido',
    colDesde: 'Desde',
    colHasta: 'Hasta',
    colPct: '%',
    agregarTramo: 'Agregar tramo',
    quitarTramo: 'Quitar tramo',

    resetear: 'Volver a los valores de fábrica',
    confirmarReset: 'Esto restaura la configuración de fábrica. Las jornadas cargadas no se tocan. ¿Seguimos?',

    nuevaJornada: 'Nueva jornada',
    editarJornada: 'Editar jornada',
    cancelar: 'Cancelar',
    guardar: 'Guardar',
    fecha: 'Fecha',
    entrada: 'Entrada',
    salida: 'Salida',
    tipoDia: 'Tipo de día',
    nota: 'Nota (opcional)',
    notaPlaceholder: 'Por ejemplo: turno de guardia',
    horasNetas: '{h} h netas',
    sinCubrir: '{h} h fuera de los tramos configurados',
    sinCubrirAyuda: 'Estas horas no se están pagando. Extendé el último tramo en Ajustes.',
    sinCubrirMes: 'Hay {h} h del mes fuera de los tramos',
    pausaDescontada: 'pausa de {min} min descontada',
    elegiFecha: 'Elegí una fecha.',
    horarioInvalido: 'Revisá los horarios: la salida tiene que ser posterior a la entrada.',

    dias: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
    diasLetra: ['D', 'L', 'M', 'M', 'J', 'V', 'S'],
    diasLargo: ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'],
    meses: ['enero','febrero','marzo','abril','mayo','junio',
            'julio','agosto','septiembre','octubre','noviembre','diciembre']
  },

  he: {
    marca: 'שעות',
    marcaSub: 'שעות ושכר',
    hoy: 'היום',

    tabHoras: 'שעות',
    tabResumen: 'סיכום',
    tabAjustes: 'הגדרות',

    mesAnterior: 'חודש קודם',
    mesSiguiente: 'חודש הבא',

    vacioTitulo: 'עדיין אין משמרות בחודש הזה',
    vacioTexto: 'לחצו על «הוספת יום» והזינו כניסה ויציאה.<br>האפליקציה תעשה את השאר.',

    cargarDia: 'הוספת יום',
    sinJornadas: 'לא הוזנו משמרות',
    jornada: 'משמרת',
    jornadas: 'משמרות',

    editar: 'עריכה',
    borrar: 'מחיקה',
    cubiertoBase: 'כלול בשכר הבסיס',
    confirmarBorrar: 'למחוק את המשמרת של',

    tipoRegular: 'רגיל',
    tipoNoche: 'לילה',
    tipoEspecial: 'מיוחד',
    tipoSeptimo: 'יום 7',
    tipoAuto: 'אוטומטי',

    motivoManual: 'נקבע ידנית',
    motivoHabil: 'יום חול',
    motivoFestivo: 'חג',
    motivoSeptimo: '7 ימים רצופים של עבודה',
    motivoEs: 'יום',
    motivoNoche: 'בתוך משמרת הלילה',
    motivoEntra: 'כניסה',

    objetivo: 'יעד',
    superaste: 'עברת את הסף: הבונוס של {monto} משולם.',
    faltan: 'חסרות {horas} שעות לקבלת הבונוס.',

    horasPorTarifa: 'שעות לפי תעריף',
    repartoVacio: 'הזינו משמרות כדי לראות את הפילוח.',

    deberiaCobrar: 'מה שאמור להשתלם',
    sueldoBase: 'שכר בסיס',
    bonusGlobal: 'שעות נוספות גלובליות',
    extrasRegulares: 'תוספות מימי חול',
    extrasNoche: 'תוספות ממשמרות לילה',
    extrasEspeciales: 'תוספות משישי, שבת וחג',
    extrasSeptimo: 'תוספות מיום 7',
    horasTrabajadas: 'שעות עבודה',
    viaticos: 'נסיעות',
    brutoMes: 'ברוטו לחודש',

    reciboEtiqueta: 'הברוטו שמופיע בתלוש',
    reciboPlaceholder: 'הזינו את הסכום מהתלוש',
    falta: 'חסר לתשלום',
    sobra: 'שולם ביתר',
    coincide: 'תואם',
    revisar: 'כדאי לבדוק עם הנהלת החשבונות לפני שפונים.',

    respaldo: 'גיבוי',
    descargarCopia: 'הורדת גיבוי',
    restaurar: 'שחזור מקובץ',
    respaldoNota: 'הנתונים נשמרים רק בטלפון הזה. אם מחליפים מכשיר או מוחקים את האפליקציה, הם נעלמים בלי גיבוי.',
    restaurado: 'הושלם: שוחזרו {n} משמרות.',
    errorArchivo: 'לא ניתן לקרוא את הקובץ: ',

    idioma: 'שפה',
    comoPagan: 'איך משלמים לך',
    modoMensual: 'שכר חודשי',
    modoHorario: 'שכר שעתי',
    salarioBase: 'שכר בסיס',
    salarioBaseAyuda: 'ברוטו קבוע לחודש',
    horasNorma: 'תקן שעות בחודש',
    horasNormaAyuda: 'המחלק לחישוב התעריף השעתי',
    tarifaHora: 'תעריף לשעה',
    tarifaHoraAyuda: 'ערך השעה ב־100%',
    pausa: 'הפסקה למשמרת',
    pausaAyuda: 'דקות שיורדות מכל יום',
    viaticosModo: 'איך משולמות הנסיעות',
    viaticosFijo: 'קבוע לחודש',
    viaticosDiario: 'לפי יום עבודה',
    viaticosMonto: 'סכום חודשי',
    viaticosPorDia: 'סכום ליום',
    notaTarifa: 'השעה שלך ב־100% שווה {tarifa}. כל האחוזים מחושבים מהמספר הזה.',

    bonusTitulo: 'שעות נוספות גלובליות',
    bonusAyuda: 'תוספת קבועה כשעוברים מכסת שעות',
    bonusMonto: 'סכום התוספת',
    bonusUmbral: 'החל מ־',
    bonusUmbralAyuda: 'שעות בחודש שצריך לעבור',

    diasEspeciales: 'ימים בתעריף מיוחד',
    festivos: 'חגי ישראל',
    festivosAyuda: 'מזוהים אוטומטית ומשולמים כיום מיוחד',
    septimo: 'יום שביעי רצוף',
    septimoAyuda: 'מסמן לבד את היום שאחרי 6 ימי עבודה',

    turnoNoche: 'משמרת לילה',
    turnoNocheAyuda: 'יום עבודה מקוצר כשנכנסים בלילה',
    nocheDesde: 'כניסה החל מ־',
    nocheHasta: 'ועד',
    nocheVentanaAyuda: 'אם המשמרת מתחילה בטווח הזה, מופעלת טבלת הלילה.',

    tramosTitulo: 'תעריפים לפי מדרגות שעות',
    tramosAyuda: 'כל שורה מכסה מדרגה במשמרת, נספרת מרגע הכניסה. השאירו את «עד» ריק כדי להגיע לסוף.',
    tramosRegular: 'יום רגיל',
    tramosNoche: 'משמרת לילה',
    tramosEspecial: 'שישי, שבת וחג',
    tramosSeptimo: 'יום שביעי רצוף',
    colDesde: 'מ־',
    colHasta: 'עד',
    colPct: '%',
    agregarTramo: 'הוספת מדרגה',
    quitarTramo: 'הסרת מדרגה',

    resetear: 'חזרה להגדרות ברירת המחדל',
    confirmarReset: 'הפעולה מחזירה את ההגדרות לברירת המחדל. המשמרות שהוזנו לא ייפגעו. להמשיך?',

    nuevaJornada: 'משמרת חדשה',
    editarJornada: 'עריכת משמרת',
    cancelar: 'ביטול',
    guardar: 'שמירה',
    fecha: 'תאריך',
    entrada: 'כניסה',
    salida: 'יציאה',
    tipoDia: 'סוג יום',
    nota: 'הערה (לא חובה)',
    notaPlaceholder: 'למשל: משמרת כוננות',
    horasNetas: '{h} שעות נטו',
    sinCubrir: '{h} שעות מחוץ למדרגות שהוגדרו',
    sinCubrirAyuda: 'השעות האלה לא משולמות. הרחיבו את המדרגה האחרונה בהגדרות.',
    sinCubrirMes: 'יש {h} שעות בחודש מחוץ למדרגות',
    pausaDescontada: 'ירדה הפסקה של {min} דקות',
    elegiFecha: 'יש לבחור תאריך.',
    horarioInvalido: 'בדקו את השעות: היציאה צריכה להיות אחרי הכניסה.',

    dias: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'],
    diasLetra: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'],
    diasLargo: ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'],
    meses: ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
            'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר']
  }
};

let actual = localStorage.getItem('shaot.idioma') || 'es';
if (!T[actual]) actual = 'es';

export function idioma() { return actual; }

export function setIdioma(codigo) {
  if (!T[codigo]) return;
  actual = codigo;
  localStorage.setItem('shaot.idioma', codigo);
  document.documentElement.lang = codigo;
  document.documentElement.dir = IDIOMAS[codigo].dir;
}

/** Devuelve el texto de la clave, reemplazando {marcadores}. */
export function t(clave, vars) {
  let v = T[actual][clave];
  if (v === undefined) v = T.es[clave];
  if (v === undefined) return clave;
  if (typeof v === 'string' && vars) {
    for (const k of Object.keys(vars)) v = v.replaceAll(`{${k}}`, vars[k]);
  }
  return v;
}

export function locale() { return IDIOMAS[actual].locale; }

/** Aplica las traducciones a los elementos con data-t / data-t-ph. */
export function traducirDOM() {
  document.querySelectorAll('[data-t]').forEach(el => {
    el.innerHTML = t(el.dataset.t);
  });
  document.querySelectorAll('[data-t-ph]').forEach(el => {
    el.placeholder = t(el.dataset.tPh);
  });
  document.querySelectorAll('[data-t-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.tAria));
  });
}
