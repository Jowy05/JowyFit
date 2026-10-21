// Guion del tutorial de la app: qué pantalla se pone, qué se señala (ancla `data-tour`) y qué se dice.
// Un guion por plataforma: en iPhone se explican las cosas adaptadas (pasos a mano, copia con Compartir,
// pitido y destello) y no sale nada que allí no funcione (reloj, báscula, recordatorios).
import type { Pestana } from '../nav'

export type PasoTutorial = {
  id: string
  /** Pestaña que se pone (su pantalla de entrada). Sin pestaña ni ancla, la tarjeta sale en el centro. */
  pestana?: Pestana
  /** Pantalla dentro de la pestaña (por ejemplo «aju», Ajustes). */
  ruta?: string
  /** Lo que se señala; con varios, el primero que se vea. Si no hay ninguno (nada que enseñar), el paso se salta. */
  sel?: string | string[]
  titulo: string
  texto: string
  /** Si no está lo que se señala, la tarjeta sale igual en el centro (en vez de saltarse el paso). */
  siempre?: boolean
}

export type PlataformaTutorial = { apple: boolean; android: boolean; instalada: boolean }

const ancla = (n: string) => `[data-tour="${n}"]`

export function pasosTutorial({ apple, android, instalada }: PlataformaTutorial): PasoTutorial[] {
  const p: PasoTutorial[] = [
    { id: 'hola', titulo: 'Así funciona JowyFit', texto: 'Un paseo rápido por lo importante. Toca «Siguiente» para avanzar; puedes salir cuando quieras.' },
    { id: 'semana', pestana: 'ini', sel: ancla('semana'), titulo: 'Tu semana de un vistazo', texto: 'Cada día te dice si toca entrenar, si ya está hecho o si se te pasó.' },
    { id: 'hoy', pestana: 'ini', sel: [`${ancla('hoy')} .today-hero`, ancla('hoy')], titulo: 'Lo que te toca hoy', texto: 'El entreno del día y cuánto dura. Toca «Empezar rutina» y la app te guía serie a serie.' },
    {
      id: 'entreno', titulo: 'Durante el entreno',
      texto: apple
        ? 'Te dice qué peso poner y cuánto descansar. Al acabar el descanso suena un pitido y la pantalla destella: déjala abierta.'
        : android
          ? 'Te dice qué peso poner y cuánto descansar, y te avisa al acabar el descanso, también en el reloj.'
          : 'Te dice qué peso poner y cuánto descansar, y te avisa al acabar el descanso.',
    },
    { id: 'atajos', pestana: 'ini', sel: ancla('atajos'), titulo: 'Apunta en un toque', texto: 'Lo que comes, un código de barras o tu peso, sin buscar en menús.' },
    {
      id: 'numeros', pestana: 'ini', sel: ancla('numeros'), titulo: 'Tu día en números',
      texto: apple
        ? 'Proteína, calorías y lo que gastas. Los pasos los apuntas tú: míralos en la app Salud.'
        : android
          ? 'Proteína, calorías, pasos y lo que gastas. Con Health Connect, los pasos llegan solos.'
          : 'Proteína, calorías, pasos y lo que gastas.',
    },
  ]
  if (apple) p.push({ id: 'pendientes', pestana: 'ini', sel: ancla('pendientes'), siempre: true, titulo: 'Tus pendientes de hoy', texto: 'En iPhone no hay recordatorios: aquí ves lo que te queda, como pesarte o apuntar los pasos.' })
  p.push(
    { id: 'rutina', pestana: 'rut', sel: ancla('rutina'), titulo: 'Tu rutina, hecha para ti', texto: 'Según tus días, tu tiempo y tu gimnasio. Si una máquina está ocupada, te da otra que trabaja lo mismo.' },
    { id: 'comida', pestana: 'com', sel: ancla('comida-anadir'), titulo: 'Apunta lo que comes', texto: 'Sin pesar nada: eliges Poco, Normal o Mucho, o escaneas el código de barras.' },
    { id: 'proteina', pestana: 'com', sel: ancla('proteina'), titulo: 'La proteína del día', texto: 'Lo que más cuenta para ganar músculo. La barra te dice cuánto te falta.' },
    { id: 'progreso', pestana: 'pro', sel: ancla('progreso'), titulo: 'Cómo vas', texto: 'Tu semana, tus récords de fuerza, tu cuerpo y tus fotos. El domingo te dice si vas bien.' },
  )
  if (android) p.push({ id: 'reloj', pestana: 'per', ruta: 'aju', sel: ancla('reloj'), titulo: 'Reloj y báscula', texto: 'Conecta Health Connect y los pasos, el peso y la grasa de tu báscula llegan solos.' })
  if (apple && !instalada) p.push({ id: 'instalar', pestana: 'per', ruta: 'aju', sel: ancla('instalar'), titulo: 'Ponla en tu pantalla de inicio', texto: 'Así se abre como una app, a pantalla completa y sin internet. Aquí tienes los pasos.' })
  p.push(
    {
      id: 'copia', pestana: 'per', ruta: 'aju', sel: ancla('copia'), titulo: 'Copias de seguridad',
      texto: apple
        ? 'Tus datos solo están en el móvil. Haz copias: se guardan con el menú Compartir, en Archivos o donde quieras.'
        : android
          ? 'Tus datos solo están en el móvil. La app hace una copia sola cada semana en Documentos/JowyFit.'
          : 'Tus datos solo están en este navegador. Haz una copia de vez en cuando.',
    },
    { id: 'informe', pestana: 'per', ruta: 'aju', sel: ancla('informe'), titulo: 'Tu informe en PDF', texto: 'Tus entrenos, tu comida y tu cuerpo en un PDF, para guardarlo o enseñarlo.' },
    { id: 'fin', pestana: 'per', ruta: 'aju', sel: ancla('tutorial'), titulo: '¡Listo! A entrenar', texto: 'Si algún día lo necesitas, este paseo está aquí, en Ajustes.' },
  )
  return p
}
