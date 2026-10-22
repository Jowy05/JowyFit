// Guion del tutorial: qué pantalla se pone, qué se señala (ancla `data-tour`) y qué se dice. Uno por plataforma: en
// iPhone se explica lo adaptado (pasos a mano, copia con Compartir) y no sale reloj, báscula ni recordatorios.
import type { CodigoPantalla, Pestana, SinDatos } from '../../app/nav'
import { t } from '../../i18n'

type PasoTutorial = {
  id: string
  /** Pestaña que se pone (su pantalla de entrada). Sin pestaña ni ancla, la tarjeta sale en el centro. */
  pestana?: Pestana
  /** Pantalla dentro de la pestaña (por ejemplo «aju», Ajustes). */
  ruta?: SinDatos<CodigoPantalla>
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
    { id: 'hola', titulo: t('Así funciona JowyFit'), texto: t('Un paseo rápido por lo importante. Toca «Siguiente» para avanzar; puedes salir cuando quieras.') },
    { id: 'semana', pestana: 'ini', sel: ancla('semana'), titulo: t('Tu semana de un vistazo'), texto: t('Cada día te dice si toca entrenar, si ya está hecho o si se te pasó.') },
    { id: 'hoy', pestana: 'ini', sel: [`${ancla('hoy')} .today-hero`, ancla('hoy')], titulo: t('Lo que te toca hoy'), texto: t('El entreno del día y cuánto dura. Toca «Empezar rutina» y la app te guía serie a serie.') },
    {
      id: 'entreno', titulo: t('Durante el entreno'),
      texto: apple
        ? t('Te dice qué peso poner y cuánto descansar. Al acabar el descanso suena un pitido y la pantalla destella: déjala abierta.')
        : android
          ? t('Te dice qué peso poner y cuánto descansar, y te avisa al acabar el descanso, también en el reloj.')
          : t('Te dice qué peso poner y cuánto descansar, y te avisa al acabar el descanso.'),
    },
    { id: 'atajos', pestana: 'ini', sel: ancla('atajos'), titulo: t('Apunta en un toque'), texto: t('Lo que comes, un código de barras o tu peso, sin buscar en menús.') },
    {
      id: 'numeros', pestana: 'ini', sel: ancla('numeros'), titulo: t('Tu día en números'),
      texto: apple
        ? t('Proteína, calorías y lo que gastas. Los pasos los apuntas tú: míralos en la app Salud.')
        : android
          ? t('Proteína, calorías, pasos y lo que gastas. Con Health Connect, los pasos llegan solos.')
          : t('Proteína, calorías, pasos y lo que gastas.'),
    },
  ]
  if (apple) p.push({ id: 'pendientes', pestana: 'ini', sel: ancla('pendientes'), siempre: true, titulo: t('Tus pendientes de hoy'), texto: t('En iPhone no hay recordatorios: aquí ves lo que te queda, como pesarte o apuntar los pasos.') })
  p.push(
    { id: 'rutina', pestana: 'rut', sel: ancla('rutina'), titulo: t('Tu rutina, hecha para ti'), texto: t('Según tus días, tu tiempo y tu gimnasio. Si una máquina está ocupada, te da otra que trabaja lo mismo.') },
    { id: 'comida', pestana: 'com', sel: ancla('comida-anadir'), titulo: t('Apunta lo que comes'), texto: t('Sin pesar nada: eliges Poco, Normal o Mucho, o escaneas el código de barras.') },
    { id: 'proteina', pestana: 'com', sel: ancla('proteina'), titulo: t('La proteína del día'), texto: t('Lo que más cuenta para ganar músculo. La barra te dice cuánto te falta.') },
    { id: 'progreso', pestana: 'pro', sel: ancla('progreso'), titulo: t('Cómo vas'), texto: t('Tu semana, tus récords de fuerza, tu cuerpo y tus fotos. El domingo te dice si vas bien.') },
  )
  if (android) p.push({ id: 'reloj', pestana: 'per', ruta: 'aju', sel: ancla('reloj'), titulo: t('Reloj y báscula'), texto: t('Conecta Health Connect y los pasos, el peso y la grasa de tu báscula llegan solos.') })
  if (apple && !instalada) p.push({ id: 'instalar', pestana: 'per', ruta: 'aju', sel: ancla('instalar'), titulo: t('Ponla en tu pantalla de inicio'), texto: t('Así se abre como una app, a pantalla completa y sin internet. Aquí tienes los pasos.') })
  p.push(
    {
      id: 'copia', pestana: 'per', ruta: 'aju', sel: ancla('copia'), titulo: t('Copias de seguridad'),
      texto: apple
        ? t('Tus datos solo están en el móvil. Haz copias: se guardan con el menú Compartir, en Archivos o donde quieras.')
        : android
          ? t('Tus datos solo están en el móvil. La app hace una copia sola cada semana en Documentos/JowyFit.')
          : t('Tus datos solo están en este navegador. Haz una copia de vez en cuando.'),
    },
    { id: 'informe', pestana: 'per', ruta: 'aju', sel: ancla('informe'), titulo: t('Tu informe en PDF'), texto: t('Tus entrenos, tu comida y tu cuerpo en un PDF, para guardarlo o enseñarlo.') },
    { id: 'fin', pestana: 'per', ruta: 'aju', sel: ancla('tutorial'), titulo: t('¡Listo! A entrenar'), texto: t('Si algún día lo necesitas, este paseo está aquí, en Ajustes.') },
  )
  return p
}
