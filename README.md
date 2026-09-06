# Shaot — control de horas y sueldo

App personal para registrar jornadas y verificar que el recibo de sueldo esté bien calculado.
Pensada para el marco laboral israelí: sueldo global, tramos de horas extra, viernes/sábado,
festivos judíos y séptimo día consecutivo.

---

## Cómo publicarla en Cloudflare Pages

No hace falta compilar nada: son archivos estáticos.

### Con Git (recomendado)

1. Subí esta carpeta a un repositorio de GitHub.
2. En el panel de Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**.
3. Elegí el repositorio y dejá la configuración en blanco:
   - Framework preset: `None`
   - Build command: *(vacío)*
   - Build output directory: `/`
4. **Save and Deploy**.

Cada `git push` publica sola.

### Sin Git

En **Workers & Pages → Create → Pages → Upload assets**, arrastrá la carpeta entera.

---

## Instalarla en el iPhone

1. Abrí la URL en **Safari** (no funciona desde Chrome en iOS).
2. Botón de compartir → **Añadir a pantalla de inicio**.
3. Abrila desde el ícono, no desde Safari.

Esto último importa: iOS borra los datos de un sitio web después de siete días sin
usarlo, salvo que esté instalado en la pantalla de inicio. Instalada, los datos quedan.

---

## Dónde viven los datos

En `localStorage`, dentro del teléfono. No hay servidor ni base de datos:
nadie más puede ver las horas ni el sueldo de nadie. La contra es que si se pierde
el teléfono o se desinstala la app, los datos se van con ella.

Por eso está el botón **Descargar copia de seguridad** en la pestaña Resumen.
Conviene bajarla una vez por mes y guardarla en Drive.

---

## Qué se puede configurar

Todo lo que cambia entre un contrato y otro:

| Ajuste | Para qué sirve |
|---|---|
| Sueldo mensual o por hora | Cambia toda la lógica de cálculo |
| Sueldo base y horas norma | De ahí sale la tarifa de la hora al 100 % |
| Pausa por jornada | Minutos que se descuentan de cada día |
| Bonus por horas globales | Monto y cantidad de horas a superar |
| Días con tarifa especial | Cuáles días de la semana pagan distinto |
| Turno de noche | Franja horaria que activa la jornada corta |
| Viáticos | Monto fijo del mes, o tanto por jornada trabajada |
| Tramos por tipo de día | Desde qué hora hasta cuál, y a qué porcentaje |
| Idioma | Español o hebreo, con la pantalla dada vuelta |

Los tramos son filas editables. Se pueden agregar y quitar sin tocar código,
así cada persona carga su propio esquema.

### El contrato que viene cargado

| Tipo de día | Tramo | % |
|---|---|---|
| Regular | 0–8 h | 100 |
| Regular | 8–10 h | 125 |
| Regular | 10 h en adelante | 150 |
| Turno de noche | 0–7 h | 100 |
| Turno de noche | 7–9 h | 125 |
| Turno de noche | 9–12 h | 150 |
| Viernes, sábado y festivos | 0–8 h | 150 |
| Viernes, sábado y festivos | 8–10 h | 175 |
| Viernes, sábado y festivos | 10 h en adelante | 200 |
| 7.º día seguido | todo el día | 200 |

Los tramos se cuentan **desde que se entra**, no por hora del reloj. Un tramo
«0 a 7» significa las primeras siete horas del turno, no de 00:00 a 07:00.

### Turno de noche

No se decide por la hora de entrada, sino por **cuántas horas del turno caen
dentro de la franja nocturna**. Con la franja por defecto (22:00 a 06:00) y un
mínimo de 2 horas:

| Turno | En la franja | Tipo | Reparto |
|---|---|---|---|
| 22:00 → 06:00 | 8 h | Noche | 7 h al 100 %, 0.5 h al 125 % |
| 18:00 → 06:00 | 8 h | Noche | 7 h al 100 %, 2 h al 125 %, 2.5 h al 150 % |
| 20:00 → 08:00 | 8 h | Noche | 7 h al 100 %, 2 h al 125 %, 2.5 h al 150 % |
| 14:00 → 23:00 | 1 h | Regular | no llega al mínimo de 2 h |
| 08:00 → 17:00 | 0 h | Regular | — |

Un turno de 18:00 a 06:00 es nocturno aunque arranque de tarde, porque tiene
ocho horas dentro de la franja. El descanso se descuenta del total antes de
repartir en tramos.

El primero entra dentro de la ventana, así que usa la tabla de noche, donde la
jornada regular es de 7 h. El segundo arranca a las 18:00, fuera de la ventana,
y va con la tabla regular de 8 h.

---

## Detección automática

- **Festivos judíos** — se traen de la API pública de Hebcal y quedan cacheados
  por año, así funcionan sin conexión. Sólo se marcan los días de יום טוב.
- **7.º día seguido** — si los seis días anteriores tienen jornada cargada,
  el día se marca solo. Mira también el mes anterior, así que un séptimo día
  que cae a principio de mes se detecta igual.

Cualquiera de las dos se puede pisar a mano desde el selector de tipo de día.

---

## Estructura del proyecto

```
shaot/
├── index.html          estructura de las tres pestañas
├── manifest.json       datos para instalarla como app
├── sw.js               service worker: la hace funcionar sin señal
├── css/app.css
├── js/
│   ├── calc.js         motor de cálculo (funciones puras, sin DOM)
│   ├── store.js        persistencia y API de festivos
│   ├── i18n.js         textos en español y hebreo
│   ├── impuestos.js    descuentos de ley (tasas 2026)
│   └── app.js          interfaz
└── icons/
```

`calc.js` no toca la pantalla ni el almacenamiento: entra un contrato y unas jornadas,
sale un resultado. Eso permite probarlo por separado y es donde conviene mirar primero
para entender cómo funciona el cálculo.

---

## Estimación del neto

La pestaña Resumen muestra, además del bruto, lo que quedaría después de los
descuentos de ley, con las tasas israelíes de 2026:

| Descuento | Cómo se calcula |
|---|---|
| מס הכנסה | Tramos mensuales, menos puntos de crédito y el crédito por pensión |
| ביטוח לאומי | 1.04 % hasta ₪7.703, 7.00 % por encima, con tope en ₪51.910 |
| ביטוח בריאות | 3.23 % hasta ₪7.703, 5.17 % por encima |
| קרן פנסיה | El porcentaje que se configure, sobre el sueldo base o sobre el bruto |

Los tramos de impuesto se ensancharon en enero de 2026 (tikún 288): el 20 %
llega hasta ₪19.000 y el 31 % hasta ₪25.100.

**Es una estimación, no una liquidación.** El impuesto a las ganancias en Israel
se calcula acumulado sobre el año, así que el número de un mes aislado puede
diferir del recibo aunque el total anual cierre. Los aportes a la seguridad
social sí son exactos: se verificaron contra un recibo real y dan la misma cifra
al shekel.

En Ajustes se configuran los puntos de crédito, el porcentaje de pensión, sobre
qué base se calcula, y un campo libre para cualquier retención fija que no esté
en la lista.

---

## Horas fuera de los tramos

El último tramo de noche cierra en 12 h. Si una jornada las supera, esas horas
no entran en ninguna banda: la app **no las descarta en silencio**, muestra un
aviso naranja en el día y en el resumen del mes indicando cuántas quedaron
afuera. Para que se paguen hay que extender el último tramo en Ajustes,
dejando el «hasta» vacío o poniendo un tope más alto.

---

## Agregar otro idioma

En `js/i18n.js` hay un objeto con las claves y su texto. Se copia el bloque
`es`, se traducen los valores y se agrega el idioma a `IDIOMAS` indicando si
se escribe de izquierda a derecha (`ltr`) o al revés (`rtl`). Las claves no se tocan.

---

## Aviso

La app calcula según lo que uno configura, no según la ley. Sirve para detectar
diferencias y tener una conversación informada con administración, no como
liquidación oficial ni como asesoramiento legal.
