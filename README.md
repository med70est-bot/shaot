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
| Tramos por tipo de día | Desde qué hora hasta cuál, y a qué porcentaje |

Los tramos son filas editables. Se pueden agregar y quitar sin tocar código,
así cada persona carga su propio esquema.

### El contrato que viene cargado

| Tipo de día | Tramo | % |
|---|---|---|
| Regular | 0–8 h | 100 |
| Regular | 8–10 h | 125 |
| Regular | 10 h en adelante | 150 |
| Viernes, sábado y festivos | 0–8 h | 150 |
| Viernes, sábado y festivos | 8–10 h | 175 |
| Viernes, sábado y festivos | 10 h en adelante | 200 |
| 7.º día seguido | todo el día | 200 |

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
│   └── app.js          interfaz
└── icons/
```

`calc.js` no toca la pantalla ni el almacenamiento: entra un contrato y unas jornadas,
sale un resultado. Eso permite probarlo por separado y es donde conviene mirar primero
para entender cómo funciona el cálculo.

---

## Aviso

La app calcula según lo que uno configura, no según la ley. Sirve para detectar
diferencias y tener una conversación informada con administración, no como
liquidación oficial ni como asesoramiento legal.
