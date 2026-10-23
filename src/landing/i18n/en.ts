// Textos de la landing en inglés (EE. UU., sencillo). Mismas claves que es.ts: TypeScript avisa si falta alguna.
// Glosario y avisos: README, «Idiomas».
import type es from './es'

const en: Record<keyof typeof es, string> = {
  // Página: título y descripción (buscadores y al compartir el enlace)
  'meta.titulo': 'JowyFit · Less thinking, more training',
  'meta.descripcion': 'The free app for getting back to the gym: it builds your routine around your days and your time, and raises your weights for you. No accounts, no ads, and your data stays on your phone.',
  'meta.og-descripcion': 'The free app for getting back to the gym. No accounts, no ads, and your data stays on your phone.',

  // Cabecera
  'cab.saltar': 'Skip to content',
  'cab.marca': 'JowyFit, home',
  'cab.letra': 'Large text',

  // Selector de idioma (el nombre de cada idioma no se traduce: va en su propio idioma)
  'idioma.boton': "{codigo} · Language: {nombre}",

  // Hero: lo primero que se ve
  'hero.titulo.1': 'Less thinking.',
  'hero.titulo.2': 'More <em class="subrayado">training.</em>',
  'hero.sub': "The free app that builds your routine around your days and your time, and raises your weights for you.",
  'hero.nota-android': 'It doesn’t come from Google Play: you install it with the file on this page, in 3 steps. <a href="#android" data-abrir="d-android">See how to install it</a>',
  'hero.nota-pc': 'You’re on a computer: open this page on your Android phone to install it there.',
  'hero.dentro-app': '<b>You’re inside another app.</b> To put JowyFit on your Home Screen, open it in Safari: tap “···” or the compass and choose “Open in Safari.”',
  'hero.nota-apple': 'Tap it and the app opens in Safari and shows you how to put it on your Home Screen, just like any other icon.',
  'hero.nota-appstore': 'It’s not on the App Store, and it doesn’t need to be: it works from Safari, free and with nothing to download. <a href="#appstore" data-abrir="d-appstore">Why?</a>',
  'hero.otra-iphone': 'Have an iPhone? Use it from Safari, nothing to download',
  'hero.otra-android': "Have an Android phone? See how to download it",

  // Botones (se repiten en el hero, en la franja del medio y en el cierre)
  'cta.descargar': 'Download the free app',
  'cta.empezada': 'Download started',
  'cta.abrir': 'Open JowyFit for free',
  'cta.demo': "Watch the demo <small class=\"solo-otro\">· 1 minute</small><small class=\"solo-apple\">· a minute and a half</small>",
  'cta.abrir-corto': 'Open JowyFit',

  // Lo que te garantizamos (debajo de cada botón)
  'garantias.aria': "At a glance",
  'garantias.gratis': 'Free',
  'garantias.cuentas': 'No accounts',
  'garantias.anuncios': 'No ads',
  'garantias.internet': 'Works offline',

  // Línea bajo el botón de Android (la escribe el JS): «Para Android 8 o superior · 28 MB · actualizada el 21 de octubre de 2026 · Novedades»
  'version.android': 'For Android 8 or later',
  'version.tamano': "{mb} MB",
  'version.fecha': 'updated {fecha}',
  'version.novedades': 'What’s new',
  'version.corta': 'Version {version}',

  // «¿Es seguro instalarla?» (Android)
  'segura.titulo': 'Is it safe to install?',
  'segura.sub': 'What permissions it asks for and what it does with your data',
  'segura.p1': 'You install it with a file from this page, not from Google Play. That’s why your phone asks for permission and warns you: it does that with any app from outside the store.',
  'segura.permisos': '<b>It asks for very few permissions.</b> Notifications, so you hear when your rest is over; the camera, only to scan barcodes. And, only if you turn it on, reading your steps, weight, and body fat from Health Connect, Android’s health app.',
  'segura.no-pide': '<b>It doesn’t ask for</b> your location, your contacts, or the microphone.',
  'segura.datos': '<b>Your data never leaves your phone.</b> It only uses the internet for the scanner: it looks up the barcode on Open Food Facts (a public list of foods) and shows the product photo from their servers. It sends that number and nothing else.',
  'segura.play-protect': '<b>Google Play Protect</b>, which comes on Android phones, may check it when you install it, like any other app.',
  'segura.firma': '<b>Always with the same signature:</b> your phone only lets you install a new version over it if it was made by the same person.',
  'segura.huella': '<b>To check it’s the real file:</b> its fingerprint (SHA-256) is <code class="huella" data-huella-valor=""></code>. If you calculate it for the file you downloaded and it matches, it’s exactly the one that was published and nobody has changed it.',
  'segura.quitar': '<b>You remove it like any other app:</b> press and hold the icon and tap “Uninstall.”',

  // Pasos para dejarla en el iPhone (hero)
  'ios.aria': 'How to put it on your iPhone',
  'ios.paso0': '<b>First, open it in Safari</b>, the blue compass.',
  'ios.whatsapp.titulo': 'Got it on WhatsApp?',
  'ios.whatsapp.texto': 'It opens inside WhatsApp, and you can’t install it from there. Tap the compass (bottom right) or the three dots “···” and choose “Open in Safari.”',
  'ios.paso1': '<b>Tap “Open JowyFit for free.”</b> The app opens.',
  'ios.paso2': '<b>There, tap Share</b>, at the bottom of the screen.',
  'ios.paso3': '<b>Tap “Add to Home Screen”</b> and then <b>“Add.”</b>',
  'ios.ipad-mac': 'On iPad, Share is at the top right. On a Mac: File menu → “Add to Dock.”',

  // Pantallitas dibujadas: copian lo que pone el móvil (iOS, Chrome y Android en ese idioma)
  'pantallita.abrir-safari': 'Open in Safari',
  'pantallita.compartir': 'Share',
  'pantallita.anadir-inicio': 'Add to Home Screen',
  'pantallita.cancelar': 'Cancel',
  'pantallita.anadir': 'Add',
  'pantallita.chrome.titulo': 'Do you want to download JowyFit.apk anyway?',
  'pantallita.chrome.texto': 'This type of file can harm your device.',
  'pantallita.chrome.si': 'Download anyway',
  'pantallita.fuentes.titulo': 'Install unknown apps',
  'pantallita.fuentes.permitir': 'Allow from this source',
  'pantallita.instalar.texto': 'Do you want to install this app?',
  'pantallita.instalar.si': 'Install',

  // Móvil animado del hero
  'maqueta.alt': 'The JowyFit home screen on a Tuesday at 5:20 a.m.: “Today’s workout” is Full body A, about 48 minutes, with its exercises and the Start workout button.',
  'maqueta.aviso': '<b>Rest over</b>Barbell Back Squat · next set',
  'maqueta.pie': 'Real screenshots from the app.<span class="solo-otro"> The watch is a drawing: on Android, the notification reaches your watch too.</span>',

  // Reloj dibujado y bloque «El descanso te avisa»
  'reloj.terminado': 'Rest over',
  'reloj.titulo': 'Your rest timer alerts you, even on your watch.',
  'reloj.texto': 'It goes off when rest is over, even with your phone in your pocket. If you have a watch connected to your phone, it buzzes on your wrist.',
  'reloj.serie': 'Set 2',
  'reloj.etiqueta': 'Drawing · on Android',

  // Botón de la animación del hero
  'anim.ver': 'Play the animation',
  'anim.pausar': 'Pause',
  'anim.seguir': 'Resume',
  'anim.otra': 'Watch again',

  // Lo que hace por ti
  'hace.titulo': "What it does for you.",
  'hace.hoy.titulo': 'Tells you what to do today',
  'hace.hoy.texto': 'Tell it which days you go and how much time you have. Your routine builds itself.',
  'hace.toques.titulo': 'Log it in two taps',
  'hace.toques.texto': "Tap “Done” or “Same as last,” then rest.",
  'hace.peso.titulo': 'Adds weight when it’s time',
  'hace.peso.texto': 'When a set feels easy, it adds a little more next time.',

  // Cifras
  'cifras.ejercicios': 'exercises, each with its own drawing',
  'cifras.mas-de': 'Over {n}',

  // Así empiezas
  'empiezas.titulo': "Your plan, in a few questions.",
  'empiezas.dias.aria': 'Example: Tuesday, Thursday, and Friday',
  'empiezas.dias.l': 'M',
  'empiezas.dias.m': 'T',
  'empiezas.dias.x': 'W',
  'empiezas.dias.j': 'T',
  'empiezas.dias.v': 'F',
  'empiezas.dias.s': 'S',
  'empiezas.dias.d': 'S',
  'empiezas.paso1.titulo': 'Tell us your days and time',
  'empiezas.paso1.texto': 'Tuesday, Thursday, and Friday, one hour… whatever you have.',
  'empiezas.paso2.titulo': 'Pick your gym',
  'empiezas.paso2.texto': 'A fully equipped one, or you check off the machines it has.',
  'empiezas.paso3.titulo': 'Trial week',
  'empiezas.paso3.texto': 'The first week measures how long you really take and adjusts your routine.',
  'empiezas.paso4.titulo': 'Train and log it',
  'empiezas.paso4.texto': 'Each set in seconds. Your weights go up on their own.',
  'empiezas.alt': 'The “Your schedule” step: Tuesday, Thursday, and Friday checked, at 5:30 a.m. for 60 minutes each day.',

  // Llamada del medio

  // Bloques de funciones
  'funciones.aria': 'What the app does',

  // Máquina ocupada
  'ocupado.titulo': 'Machine taken? It finds you another.',
  'ocupado.texto': "At rush hour, tap “Taken” and it suggests another exercise that works the same muscles, with the weight already filled in. And it remembers what you do each day.",
  'ocupado.alt': 'The “Taken” sheet: if the barbell squat is taken, it suggests the leg press with 10 kg × 6-10.',

  // Comida
  'comida.titulo': 'Eat without counting calories.',
  'comida.texto': 'Log what you eat with <strong>A little</strong>, <strong>Normal</strong>, or <strong>A lot</strong>. You see protein first; the rest stays in the background. And if it has a barcode, you scan it.',
  'comida.nota': 'Scanned products come from Open Food Facts, a free public list of foods: when you scan, the barcode is sent to it, and the product photo loads from their servers.',
  'comida.alt': 'Logging food: “Lentils with chorizo” with the A little, Normal, and A lot buttons, and Normal selected (about 600 kcal).',

  // ¿Voy bien?
  'voybien.titulo': 'Am I on track?',
  'voybien.p1': "Every Sunday, a traffic light tells you how your week went: what’s going well and what you can improve.",
  'voybien.p2': 'If something is falling behind, like protein, it points it out for next week. The app does the math: you just log what you eat.',
  'voybien.alt': 'The Sunday review: amber light, “Almost”: 3 of 3 workouts, 1 cm off your waist, and protein to work on.',

  // Varios
  'comun.datos-ejemplo': 'Sample data.',

  // Tu cuerpo
  'cuerpo.titulo': 'See how you change.',
  'cuerpo.p1': 'Weight, waist, and body fat in a simple chart. With each week’s average, because a single day’s weight can fool you.',
  'cuerpo.android': 'If you have a scale or a watch connected to your phone, your steps and weight are logged for you (through Health Connect, Android’s health app, and only if you turn it on).',
  'cuerpo.iphone': 'On iPhone, you log your weight and steps yourself in seconds.',
  'cuerpo.alt': 'Progress, Body tab: weight drops from 85.2 to 82.3 kg in seven weeks, and waist from 98 to 95 cm.',

  // Privacidad
  'privacidad.titulo': 'Your data stays on your phone.',
  'privacidad.intro': 'No accounts, no cloud. Nothing to steal and nothing to sell.',
  'privacidad.pagina.titulo': 'This page doesn’t track you either',
  'privacidad.pagina.texto': 'No analytics, no cookies.',
  'privacidad.internet.titulo': 'Works offline',
  'privacidad.internet.texto': 'Only the scanner needs a connection: it looks up the code on Open Food Facts and loads the product photo from there. Nothing else leaves your phone.',
  'privacidad.cuentas.titulo': 'No accounts or passwords',
  'privacidad.cuentas.texto': 'Open the app and start.',
  'privacidad.copia.titulo': 'Your backup, your file',
  'privacidad.copia.texto': 'Save a backup whenever you want and take it to another phone.',
  'privacidad.pierdo': "<b>What if I lose my phone?</b> Since nobody else has your data, it would be lost with it: make a backup now and then (the app reminds you). <a href=\"#cambiar\" data-abrir=\"d-cambiar\">How to do it</a>",

  // Quién la ha hecho
  'autor.titulo': 'Made by someone who works out early.',
  'autor.texto': "I made it for myself. I work out early, three days a week, and I wanted to open my phone and know what to do without thinking. I also thought of my dad: if he can figure it out without help, I got it right.",
  'autor.novedades': 'What’s new in each version',
  'autor.codigo': 'The code is public: anyone who knows how to code can see what the app does on the inside, and use or change it as long as they say who made it. The only thing you can’t do is sell it. <a href="https://github.com/Jowy05/JowyFit/tree/prod">See the code</a>',

  // Preguntas frecuentes
  'faq.titulo': 'Things you might be wondering.',
  'faq.android.pregunta': 'How do I install it on Android?',
  'faq.android.paso1': '<b>1.</b> Tap “Download the free app.” Chrome asks the same thing for every app that doesn’t come from Google Play, no matter which one it is. Tap “Download anyway.”',
  'faq.android.paso2': '<b>2.</b> Open the file. If it asks, tap “Settings,” turn on “Allow from this source,” and go back.',
  'faq.android.paso3': '<b>3.</b> Tap “Install.” It’s now on your home screen.',
  'faq.android.rotulo': 'Approximate drawing: it may look a little different on your phone.',
  'faq.android.p2': 'You can take that permission away later in your phone’s settings. It works on Android 8 or later. <a href="#segura" data-abrir="d-segura">Is it safe to install?</a>',
  'faq.googleplay.pregunta': 'Why isn’t it on Google Play?',
  'faq.googleplay.p1': 'To be on Google Play, you have to sign up as a developer, pay a fee, and go through a testing period with other people before publishing. For a free app made by one person, it’s not worth it for now.',
  'faq.googleplay.p2': 'The file on this page is the full app, the same one that would be there. It asks for very few permissions and your data never leaves your phone: <a href="#segura" data-abrir="d-segura">see what permissions it asks for and why</a>.',
  'faq.iphone.pregunta': 'And on iPhone or iPad?',
  'faq.iphone.p1': 'You use it from Safari, with nothing to download. First, open it in <b>Safari</b> (the blue compass): if someone sent it to you on WhatsApp, tap the compass or “···” and choose “Open in Safari.” Tap “Open JowyFit for free” and, in the app that opens:',
  'faq.iphone.paso1': '<b>1.</b> Tap Share: at the bottom on iPhone, at the top right on iPad.',
  'faq.iphone.paso2': '<b>2.</b> Scroll down and tap “Add to Home Screen.”',
  'faq.iphone.paso3': '<b>3.</b> Tap “Add.” That’s it.',
  'faq.iphone.rotulo': 'Approximate drawing: it may look a little different on your iPhone.',
  'faq.iphone.p2': 'What it can’t do on iPhone: alert you on your watch when rest is over, or bring in your steps and weight on its own. You log those yourself.',
  'faq.appstore.pregunta': 'Why isn’t it on the App Store?',
  'faq.appstore.p1': 'Because it doesn’t need to be. On iPhone and iPad it works from Safari: nothing to download, free, and it doesn’t ask for your Apple Account. And once it’s on your Home Screen, it opens like any other app.',
  'faq.appstore.p2': 'To be on the App Store, you have to pay Apple a fee every year, and a free app made by one person doesn’t need that.',
  'faq.gratis.pregunta': 'Is it really free?',
  'faq.gratis.respuesta': 'Yes. No payments, no trials that run out, and no ads.',
  'faq.internet.pregunta': 'Does it work offline?',
  'faq.internet.respuesta': 'Yes. Only the scanner needs a connection to look up the product; if there isn’t one, it saves the code and looks it up later.',
  'faq.mayores.pregunta': 'Is it for me if I’m 60 or have never been to a gym?',
  'faq.mayores.respuesta': "Yes. The first time, a short guided tour shows you the important parts, you can turn on large text, and the routine starts easy, with comfortable weights.",
  'faq.actualizar.pregunta': 'How do I update it? Will I lose what I’ve logged?',
  'faq.actualizar.android': 'You won’t lose anything. When a new version comes out, download it from this page and install it over the one you have: your data stays.',
  'faq.actualizar.iphone': 'You won’t lose anything. It updates itself when you open it while you’re online, and your data stays.',
  'faq.actualizar.novedades': 'You’ll find what changes in each version in <a href="#novedades" data-abrir="d-novedades">What’s new</a>.',
  'faq.cambiar.pregunta': 'What if I get a new phone or lose mine?',
  'faq.cambiar.p1': 'Your data is only on your phone, so you keep the backup yourself. Make it in Profile → Settings → “Backup”: it’s a file you can email to yourself or save to Drive or your computer. The app reminds you if you go a week without making one.',
  'faq.cambiar.p2': 'On your new phone, open the app and tap “I have a backup.”',
  'faq.quitar.pregunta': 'How do I remove it?',
  'faq.quitar.respuesta': 'Like any other app: press and hold the icon and tap “Uninstall” (on iPhone, “Delete App”). Your data is deleted with it, so make a backup first if you want to keep it.',
  'faq.novedades.pregunta': 'What’s new: what changed in each version',

  // Novedades de cada versión
  'nov.0-4-1.cab': '<b>Version 0.4.1</b> · October 23, 2026',
  'nov.0-4-1.texto': 'A clearer PDF report in the app’s colors. The page and the demo are easier to read and to use with a keyboard. Fixes: body fat % now matches across Home, Goals, and the report, and supplement reminders show in your language. Under the hood, the app is reorganized to grow without bugs.',
  'nov.0-4-0.cab': '<b>Version 0.4.0</b> · October 22, 2026',
  'nov.0-4-0.texto': 'The app now comes in three languages: Spanish, Catalan, and English. It still starts in Spanish; switch it in Settings → Appearance → Language. Dates, times, numbers, and exercises (in English) show up in your language.',
  'nov.0-3-0.cab': '<b>Version 0.3.0</b> · October 21, 2026',
  'nov.0-3-0.texto': 'A tour inside the app: the first time, it offers to walk you through the important parts, and it’s always there in Settings. On iPhone, it explains what works differently there. And on this page, a one-minute demo.',
  'nov.0-2-1.cab': '<b>Version 0.2.1</b> · October 21, 2026',
  'nov.0-2-1.texto': 'A new look: a new icon, and the app goes from orange to purple. The PDF report gets a cleaner design, in the same purple.',
  'nov.0-2-0.cab': '<b>Version 0.2.0</b> · October 21, 2026',
  'nov.0-2-0.texto': 'PDF report: pick the days and what goes in it (workouts, effort for each exercise, personal bests, food, body, and steps), then save or send it. Backups are checked before you restore them, and the app now works on iPhone from Safari.',
  'nov.0-1-6.cab': '<b>Version 0.1.6</b> · October 20, 2026',
  'nov.0-1-6.texto': 'A full review of the app and 20 bugs fixed: going back to the workout after the last set, rest notifications, keeping the iPhone screen on, and fixing the sets of a workout you already saved. “Delete everything” asks you to confirm twice.',
  'nov.0-1-5.cab': '<b>Version 0.1.5</b> · October 19, 2026',
  'nov.0-1-5.texto': 'On Home, you see the calories you burn at rest and while training. And “Skip this exercise” is now in plain sight.',
  'nov.0-1-4.cab': '<b>Version 0.1.4</b> · October 18, 2026',
  'nov.0-1-4.texto': 'Connecting your watch and scale is easier: just one button in Settings (Android).',
  'nov.0-1-3.cab': '<b>Version 0.1.3</b> · October 18, 2026',
  'nov.0-1-3.texto': 'Weight and body fat from your scale come in on their own (Android).',
  'nov.0-1-2.cab': '<b>Version 0.1.2</b> · October 17, 2026',
  'nov.0-1-2.texto': 'When you log a meal, you pick A little, Normal, or A lot. Supplements have their own amount, and the shake adds its protein.',
  'nov.0-1-1.cab': '<b>Version 0.1.1</b> · October 17, 2026',
  'nov.0-1-1.texto': 'More sensible servings, more details on scanned products, and the back button asks before you leave a workout.',
  'nov.0-1-0.cab': '<b>Version 0.1.0</b> · October 15, 2026',
  'nov.0-1-0.texto': 'The first version: routine, workout, food, and progress.',

  // Cierre
  'cierre.titulo': 'Start easy. Stay consistent.',
  'cierre.iphone': 'On iPhone and iPad, open it in Safari and put it on your Home Screen.',

  // Pie
  'pie.enlaces': "<b translate=\"no\">JowyFit</b> · Free, with public code · <a href=\"#novedades\" data-abrir=\"d-novedades\">What’s new</a> · <a href=\"privacypolicy.html\">Privacy policy</a> (in Spanish)",
  'pie.creditos': 'Credits: the exercises and their drawings are from RepDB; the foods, from Open Food Facts. Phosphor icons and Barlow font. <span data-version-corta=""></span> · PolyForm Noncommercial License · <a href="https://github.com/Jowy05/JowyFit/tree/prod">Code</a>',

  // Barra fija del móvil
  'barra.descargar': 'Download for free',
}

export default en
