// Guion de la demo (/Demo): qué captura se enseña, qué se señala y qué se dice. Las capturas y la posición de
// lo señalado salen de la app de verdad (.cache/demo/capturas-demo.mjs → public/demo/ y focos.json).
// Android: un vistazo de un minuto. iPhone: algo más largo, porque explica lo que allí se hace de otra forma
// (instalarla, pasos a mano, pendientes en vez de recordatorios, copia con Compartir) y no promete lo que no hay.
import focos from './focos.json'

export type Plataforma = 'android' | 'apple'
export type Caja = [number, number, number, number]
export type PasoDemo = { capitulo: string; cap: string; foco: string; titulo: string; texto: string }

/** Pantalla de las capturas (px de CSS). */
export const ANCHO = 390
export const ALTO = 844

const comun = (apple: boolean): PasoDemo[] => [
  { capitulo: 'Inicio', cap: 'hoy', foco: 'semana', titulo: 'Tu semana de un vistazo', texto: 'Cada día te dice si toca entrenar, si ya está hecho o si se te pasó.' },
  { capitulo: 'Inicio', cap: 'hoy', foco: 'hoy', titulo: 'Tu rutina, hecha para ti', texto: 'Con tus días, tu tiempo y tu gimnasio. Cada día sabes qué toca y cuánto dura.' },
  { capitulo: 'Entreno', cap: 'hoy', foco: 'empezar', titulo: 'Un toque y a entrenar', texto: 'Empiezas la sesión normal, o la versión corta si vas con prisa.' },
  { capitulo: 'Entreno', cap: 'serie', foco: 'peso', titulo: 'Te dice qué peso poner', texto: 'El peso y las repeticiones ya vienen puestos: apuntas cada serie en dos toques.' },
  { capitulo: 'Entreno', cap: 'serie', foco: 'esfuerzo', titulo: '¿Cuánto te ha costado?', texto: 'Con eso la app sube o mantiene el peso la próxima vez. Sin hacer cuentas.' },
  {
    capitulo: 'Entreno', cap: 'descanso', foco: 'reloj', titulo: 'Descansa lo justo',
    texto: apple
      ? 'Cuenta atrás del descanso. Al acabar suena un pitido y la pantalla destella: déjala abierta.'
      : 'Cuenta atrás del descanso, con aviso al acabar aunque el móvil esté bloqueado. También en tu reloj.',
  },
  { capitulo: 'Entreno', cap: 'ocupado', foco: 'hoja', titulo: '¿Máquina ocupada?', texto: 'Te propone otra que trabaja lo mismo y sigues sin perder tiempo.' },
  { capitulo: 'Comida', cap: 'comida', foco: 'cuanto', titulo: 'Apunta la comida sin pesar', texto: 'Escribes qué has comido y eliges Poco, Normal o Mucho. Lo aproximado vale.' },
  { capitulo: 'Comida', cap: 'comida', foco: 'escanear', titulo: 'O escanea el código', texto: 'Con la cámara del móvil: calorías y proteína del producto al momento.' },
  { capitulo: 'Comida', cap: 'proteina', foco: 'proteina', titulo: 'La proteína del día', texto: 'Lo que más cuenta para ganar músculo, y cuánto te falta hoy.' },
]

const progreso: PasoDemo[] = [
  { capitulo: 'Progreso', cap: 'voy-bien', foco: 'nota', titulo: '¿Voy bien?', texto: 'Cada domingo, tu semana en un semáforo: entrenos, proteína, pasos y cintura.' },
  { capitulo: 'Progreso', cap: 'fuerza', foco: 'grafica', titulo: 'Tus pesos, subiendo', texto: 'Cada ejercicio que subes queda apuntado: ves cuánto más levantas que hace un mes.' },
]

export function guion(p: Plataforma): PasoDemo[] {
  if (p === 'android') return [...comun(false), ...progreso]
  return [
    { capitulo: 'Antes de empezar', cap: 'instalar', foco: 'compartir', titulo: 'Ponla en tu pantalla de inicio', texto: 'En el iPhone se usa desde Safari, sin descargar nada. Toca el botón Compartir…' },
    { capitulo: 'Antes de empezar', cap: 'instalar', foco: 'anadir', titulo: '…y «Añadir a pantalla de inicio»', texto: 'Así se abre como una app, a pantalla completa, y funciona sin internet.' },
    ...comun(true),
    { capitulo: 'En iPhone', cap: 'pendientes', foco: 'pendientes', titulo: 'Tus pendientes de hoy', texto: 'En iPhone no hay recordatorios: aquí ves lo que te queda, como pesarte o apuntar los pasos.' },
    { capitulo: 'En iPhone', cap: 'pasos', foco: 'apuntar', titulo: 'Los pasos, a mano', texto: 'Mira tus pasos en la app Salud y apúntalos aquí en un momento.' },
    ...progreso,
    { capitulo: 'En iPhone', cap: 'copia', foco: 'copia', titulo: 'Haz copias de seguridad', texto: 'Tus datos solo están en el móvil: guarda la copia con Compartir, en Archivos o en iCloud.' },
  ]
}

/** Caja (px de 390 × 844) de lo que señala un paso, o null si no se capturó. */
export function cajaDe(p: Plataforma, paso: PasoDemo): Caja | null {
  const f = (focos as unknown as Record<string, Record<string, Record<string, Caja | null>>>)[p]?.[paso.cap]?.[paso.foco]
  return f ?? null
}

/** Cuánto dura un paso: lo justo para leerlo con calma (entre 4 y 6,6 s; la de Android, en torno a un minuto). */
export const duracion = (paso: PasoDemo) => Math.min(6600, Math.max(4000, 1300 + (paso.titulo.length + paso.texto.length) * 34))
