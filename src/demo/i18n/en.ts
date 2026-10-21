// Textos de la demo en inglés (EE. UU., sencillo). Mismas claves que es.ts: TypeScript avisa si falta alguna.
// Glosario y avisos: docs/GLOSARIO-IDIOMAS.md.
import type es from './es'

const en: Record<keyof typeof es, string> = {
  // Página: título y descripción
  'demo.meta.descripcion': 'A one-minute JowyFit demo: your routine, your workout, your food, and how you’re doing, with screenshots of the real app.',
  'demo.meta.titulo': 'JowyFit · One-minute demo',

  // Cabecera
  'demo.cab.volver': 'Back to the page',

  // Selector de idioma (el nombre de cada idioma no se traduce: va en su propio idioma)
  'idioma.boton': 'Language: {nombre}',

  // Presentación (encima del móvil, en el ordenador)
  'demo.intro.titulillo': 'Demo · screenshots of the real app',
  'demo.intro.titulo': 'How JowyFit works',
  'demo.intro.plataforma': 'Your phone',

  // Tarjeta: botones y contador de pasos
  'demo.control.atras': 'Previous step',
  'demo.control.sigue': 'Next step',
  'demo.control.teclas': 'Space to pause · arrows to go back and forth',
  'demo.control.n': '{n} of {total}',
  'demo.control.barra': 'Go to step {n}: {titulo}',
  'demo.control.pausar': 'Pause',
  'demo.control.seguir': 'Resume',

  // Enlace para ver la demo del otro móvil
  'demo.cambiar.iphone': 'Have an iPhone? See the iPhone demo',
  'demo.cambiar.android': 'Have an Android? See the Android demo',

  // Capítulos (encima del título de cada paso)
  'demo.capitulo.antes': 'Before you start',
  'demo.capitulo.inicio': 'Home',
  'demo.capitulo.entreno': 'Workout',
  'demo.capitulo.comida': 'Food',
  'demo.capitulo.progreso': 'Progress',
  'demo.capitulo.iphone': 'On iPhone',

  // Pasos: título (máx. 34 letras) y texto (máx. 125 letras) de cada uno; la captura sigue en castellano
  'demo.paso.compartir.titulo': 'Put it on your Home Screen',
  'demo.paso.compartir.texto': 'On iPhone, you use it from Safari, with nothing to download. Tap the Share button…',
  'demo.paso.anadir.titulo': '…and “Add to Home Screen”',
  'demo.paso.anadir.texto': 'That way it opens like an app, full screen, and works offline.',
  'demo.paso.semana.titulo': 'Your week at a glance',
  'demo.paso.semana.texto': 'Each day shows if it’s a workout day, if it’s done, or if you missed it.',
  'demo.paso.rutina.titulo': 'Your routine, made for you',
  'demo.paso.rutina.texto': 'Built around your days, your time, and your gym. Each day you know what’s on and how long it takes.',
  'demo.paso.empezar.titulo': 'One tap and you’re training',
  'demo.paso.empezar.texto': 'Start the normal session, or the short version if you’re in a hurry.',
  'demo.paso.peso.titulo': 'It tells you what weight to use',
  'demo.paso.peso.texto': 'The weight and reps are already filled in: you log each set in two taps.',
  'demo.paso.esfuerzo.titulo': 'How hard was it?',
  'demo.paso.esfuerzo.texto': 'Based on that, the app raises the weight next time or keeps it the same. No math needed.',
  'demo.paso.descanso.titulo': 'Rest just enough',
  'demo.paso.descanso.texto.android': 'A rest countdown that alerts you when it’s over, even with your phone locked. On your watch too.',
  'demo.paso.descanso.texto.apple': 'A rest countdown. When it’s over, it beeps and the screen flashes: keep the app open.',
  'demo.paso.ocupado.titulo': 'Machine taken?',
  'demo.paso.ocupado.texto': 'It suggests another one that works the same muscles, so you keep going without wasting time.',
  'demo.paso.comida.titulo': 'Log food without weighing it',
  'demo.paso.comida.texto': 'Type what you ate and pick A little, Normal, or A lot. Close enough is fine.',
  'demo.paso.escanear.titulo': 'Or scan the barcode',
  'demo.paso.escanear.texto': 'With your phone’s camera: the product’s calories and protein in an instant.',
  'demo.paso.proteina.titulo': 'Today’s protein',
  'demo.paso.proteina.texto': 'What matters most for building muscle, and how much you still need today.',
  'demo.paso.pendientes.titulo': 'Today’s to-dos',
  'demo.paso.pendientes.texto': 'On iPhone there are no reminders: here you see what’s left to do, like weighing yourself or logging your steps.',
  'demo.paso.pasos.titulo': 'Log your steps by hand',
  'demo.paso.pasos.texto': 'Check your steps in the Health app and log them here in seconds.',
  'demo.paso.voy-bien.titulo': 'Am I on track?',
  'demo.paso.voy-bien.texto': 'Every Sunday, your week as a traffic light: workouts, protein, steps, and waist.',
  'demo.paso.fuerza.titulo': 'Your weights, going up',
  'demo.paso.fuerza.texto': 'Every time you add weight, it’s saved: you see how much more you lift than a month ago.',
  'demo.paso.copia.titulo': 'Back up your data',
  'demo.paso.copia.texto': 'Your data is only on your phone: save the backup with Share, to Files or iCloud.',

  // Final
  'demo.final.titulo': 'Your data, only on your phone.',
  'demo.final.texto': 'Free, no accounts, and no ads. Start easy and stay consistent.',
  'demo.final.descargar': 'Download the free app',
  'demo.final.abrir': 'Open JowyFit for free',
  'demo.final.otra': 'Watch it again',
}

export default en
