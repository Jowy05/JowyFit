// Textos de la landing (index.html) en castellano: el original, tal cual está en la página.
// Cada clave es la de un data-i18n / data-i18n-html / data-i18n-attr del HTML, o la de un texto que pone el JS.
// Los que llevan {algo} se rellenan al pintarse. Los que llevan etiquetas (<b>, <a>…) se ponen como HTML: se dejan
// las etiquetas y sus atributos tal cual y se traduce solo el texto. Glosario y avisos: README, «Idiomas».
const es = {
  // Página: título y descripción (buscadores y al compartir el enlace)
  'meta.titulo': 'JowyFit · Menos pensar, más entrenar',
  'meta.descripcion': 'La app gratis para volver al gimnasio: te hace la rutina según tus días y tu tiempo y te sube los pesos sola. Sin cuentas, sin anuncios y tus datos solo en tu móvil.',
  'meta.og-descripcion': 'La app gratis para volver al gimnasio. Sin cuentas, sin anuncios y tus datos solo en tu móvil.',

  // Cabecera
  'cab.saltar': 'Ir al contenido',
  'cab.marca': 'JowyFit, inicio',
  'cab.letra': 'Letra grande',

  // Selector de idioma (el nombre de cada idioma no se traduce: va en su propio idioma)
  'idioma.boton': "{codigo} · Idioma: {nombre}",

  // Hero: lo primero que se ve
  'hero.titulo.1': 'Menos pensar.',
  'hero.titulo.2': 'Más <em class="subrayado">entrenar.</em>',
  'hero.sub': "La app gratis que te hace la rutina según tus días y tu tiempo, y te sube los pesos sola.",
  'hero.nota-android': 'No viene de Google Play: se instala con el archivo de esta página, en 3 pasos. <a href="#android" data-abrir="d-android">Ver cómo se instala</a>',
  'hero.nota-pc': 'Estás en un ordenador: abre esta página en tu móvil Android para instalarla allí.',
  'hero.dentro-app': '<b>Estás dentro de otra app.</b> Para dejar JowyFit en tu pantalla, ábrela en Safari: toca «···» o la brújula y elige «Abrir en Safari».',
  'hero.nota-apple': 'Al tocarlo se abre la app en Safari y te enseña a dejarla en tu pantalla de inicio, como un icono más.',
  'hero.nota-appstore': 'No está en la App Store y no hace falta: funciona desde Safari, gratis y sin descargar nada. <a href="#appstore" data-abrir="d-appstore">¿Por qué?</a>',
  'hero.otra-iphone': '¿Tienes iPhone? Se usa desde Safari, sin descargar nada',
  'hero.otra-android': '¿Tienes Android? Mira cómo se descarga',

  // Botones (se repiten en el hero, en la franja del medio y en el cierre)
  'cta.descargar': 'Descargar la app gratis',
  'cta.empezada': 'Descarga empezada',
  'cta.abrir': 'Abrir JowyFit gratis',
  'cta.demo': "Ver la demo <small class=\"solo-otro\">· 1 minuto</small><small class=\"solo-apple\">· minuto y medio</small>",
  'cta.abrir-corto': 'Abrir JowyFit',

  // Lo que te garantizamos (debajo de cada botón)
  'garantias.aria': "En resumen",
  'garantias.gratis': 'Gratis',
  'garantias.cuentas': 'Sin cuentas',
  'garantias.anuncios': 'Sin anuncios',
  'garantias.internet': 'Funciona sin internet',

  // Línea bajo el botón de Android (la escribe el JS): «Para Android 8 o superior · 28 MB · actualizada el 21 de octubre de 2026 · Novedades»
  'version.android': 'Para Android 8 o superior',
  'version.tamano': "{mb} MB",
  'version.fecha': 'actualizada el {fecha}',
  'version.novedades': 'Novedades',
  'version.corta': 'Versión {version}',

  // «¿Es seguro instalarla?» (Android)
  'segura.titulo': '¿Es seguro instalarla?',
  'segura.sub': 'Qué permisos pide y qué hace con tus datos',
  'segura.p1': 'Se instala con un archivo de esta página, no desde Google Play. Por eso el móvil te pide permiso y te avisa: lo hace con cualquier app de fuera de la tienda.',
  'segura.permisos': '<b>Pide pocos permisos.</b> Avisos, para que suene el final del descanso; la cámara, solo para escanear códigos de barras. Y, solo si tú lo activas, leer tus pasos, tu peso y tu grasa de Health Connect, la app de salud de Android.',
  'segura.no-pide': '<b>No pide</b> tu ubicación, tus contactos ni el micrófono.',
  'segura.datos': '<b>Tus datos no salen del móvil.</b> Solo usa internet con el escáner: busca el código de barras en Open Food Facts (una lista pública de alimentos) y enseña la foto del producto desde sus servidores. Envía ese número y nada más.',
  'segura.play-protect': '<b>Google Play Protect</b>, que viene en los móviles Android, puede revisarla al instalarla, como a cualquier app.',
  'segura.firma': '<b>Siempre con la misma firma:</b> el móvil solo deja instalar encima versiones hechas por la misma persona.',
  'segura.huella': '<b>Para comprobar que es el archivo de verdad:</b> su huella (SHA-256) es <code class="huella" data-huella-valor=""></code>. Si la calculas con el archivo que has descargado y sale igual, es exactamente el que se publicó y nadie lo ha cambiado.',
  'segura.quitar': '<b>Se quita como cualquier app:</b> mantén pulsado el icono y toca «Desinstalar».',

  // Pasos para dejarla en el iPhone (hero)
  'ios.aria': 'Cómo dejarla en el iPhone',
  'ios.paso0': '<b>Antes, ábrela en Safari</b>, la brújula azul.',
  'ios.whatsapp.titulo': '¿Te la han mandado por WhatsApp?',
  'ios.whatsapp.texto': 'Se abre dentro de WhatsApp y desde ahí no se puede instalar. Toca la brújula (abajo a la derecha) o los tres puntos «···» y elige «Abrir en Safari».',
  'ios.paso1': '<b>Toca «Abrir JowyFit gratis».</b> Se abre la app.',
  'ios.paso2': '<b>Allí, toca Compartir</b>, abajo en la pantalla.',
  'ios.paso3': '<b>Toca «Añadir a pantalla de inicio»</b> y luego <b>«Añadir»</b>.',
  'ios.ipad-mac': 'En el iPad, Compartir está arriba a la derecha. En el Mac: menú Archivo → «Añadir al Dock».',

  // Pantallitas dibujadas: copian lo que pone el móvil (iOS, Chrome y Android en ese idioma)
  'pantallita.abrir-safari': 'Abrir en Safari',
  'pantallita.compartir': 'Compartir',
  'pantallita.anadir-inicio': 'Añadir a pantalla de inicio',
  'pantallita.cancelar': 'Cancelar',
  'pantallita.anadir': 'Añadir',
  'pantallita.chrome.titulo': '¿Quieres descargar JowyFit.apk de todos modos?',
  'pantallita.chrome.texto': 'Este tipo de archivo puede dañar tu dispositivo.',
  'pantallita.chrome.si': 'Descargar de todos modos',
  'pantallita.fuentes.titulo': 'Instalar apps desconocidas',
  'pantallita.fuentes.permitir': 'Permitir de esta fuente',
  'pantallita.instalar.texto': '¿Quieres instalar esta aplicación?',
  'pantallita.instalar.si': 'Instalar',

  // Móvil animado del hero
  'maqueta.alt': 'La pantalla de inicio de JowyFit un martes a las 5:30: «Hoy te toca» Cuerpo completo A, unos 48 minutos, con sus ejercicios y el botón Empezar rutina.',
  'maqueta.aviso': '<b>Descanso terminado</b>Sentadilla Trasera con Barra · siguiente serie',
  'maqueta.pie': 'Capturas reales de la app.<span class="solo-otro"> El reloj es un dibujo: en Android, el aviso llega también al reloj.</span>',

  // Reloj dibujado y bloque «El descanso te avisa»
  'reloj.terminado': 'Descanso terminado',
  'reloj.titulo': 'El descanso te avisa, también en el reloj.',
  'reloj.texto': 'Suena al acabar aunque lleves el móvil en el bolsillo. Si tienes un reloj conectado al móvil, vibra en la muñeca.',
  'reloj.serie': 'Serie 2',
  'reloj.etiqueta': 'Dibujo · en Android',

  // Botón de la animación del hero
  'anim.ver': 'Ver la animación',
  'anim.pausar': 'Pausar',
  'anim.seguir': 'Seguir',
  'anim.otra': 'Ver otra vez',

  // Lo que hace por ti
  'hace.titulo': "Lo que hace por ti.",
  'hace.hoy.titulo': 'Te dice qué toca hoy',
  'hace.hoy.texto': 'Le dices qué días vas y cuánto tiempo tienes. La rutina se hace sola.',
  'hace.toques.titulo': 'Apuntas en dos toques',
  'hace.toques.texto': "Tocas «Hecho» o «Igual que la anterior», y a descansar.",
  'hace.peso.titulo': 'Sube el peso cuando toca',
  'hace.peso.texto': 'Cuando una serie te sale fácil, la próxima vez te pone un poco más.',

  // Cifras
  'cifras.ejercicios': 'ejercicios, cada uno con su dibujo',
  'cifras.mas-de': 'Más de {n}',

  // Así empiezas
  'empiezas.titulo': "Tu plan, en unas preguntas.",
  'empiezas.dias.aria': 'Ejemplo: martes, jueves y viernes',
  'empiezas.dias.l': 'L',
  'empiezas.dias.m': 'M',
  'empiezas.dias.x': 'X',
  'empiezas.dias.j': 'J',
  'empiezas.dias.v': 'V',
  'empiezas.dias.s': 'S',
  'empiezas.dias.d': 'D',
  'empiezas.paso1.titulo': 'Dinos tus días y tu tiempo',
  'empiezas.paso1.texto': 'Martes, jueves y viernes, una hora… lo que tengas.',
  'empiezas.paso2.titulo': 'Elige tu gimnasio',
  'empiezas.paso2.texto': 'Uno completo, o marcas tú las máquinas que hay.',
  'empiezas.paso3.titulo': 'Semana de prueba',
  'empiezas.paso3.texto': 'La primera semana mide cuánto tardas de verdad y ajusta la rutina.',
  'empiezas.paso4.titulo': 'Entrena y apunta',
  'empiezas.paso4.texto': 'Cada serie en segundos. Los pesos suben solos.',
  'empiezas.alt': 'El paso «Tus horarios»: martes, jueves y viernes marcados, a las 5:30 y 60 minutos cada día.',

  // Llamada del medio

  // Bloques de funciones
  'funciones.aria': 'Lo que hace la app',

  // Máquina ocupada
  'ocupado.titulo': '¿Máquina ocupada? Te da otra.',
  'ocupado.texto': "En hora punta, toca «Ocupado» y te propone otro ejercicio que trabaja lo mismo, con el peso ya puesto. Y se acuerda de qué haces cada día.",
  'ocupado.alt': 'La hoja «Ocupado»: si la sentadilla con barra está ocupada, propone la prensa de piernas con 10 kg × 6-10.',

  // Comida
  'comida.titulo': 'Come sin contar calorías.',
  'comida.texto': 'Apunta lo que comes con <strong>Poco</strong>, <strong>Normal</strong> o <strong>Mucho</strong>. Primero ves la proteína; lo demás, en segundo plano. Y si tiene código de barras, lo escaneas.',
  'comida.nota': 'Los productos escaneados salen de Open Food Facts, una lista pública y gratuita de alimentos: al escanear se le envía el código de barras y la foto del producto se carga de sus servidores.',
  'comida.alt': 'Apuntar comida: «Lentejas con chorizo» con los botones Poco, Normal y Mucho, y Normal marcado (unas 600 kcal).',

  // ¿Voy bien?
  'voybien.titulo': '¿Voy bien?',
  'voybien.p1': "Cada domingo, un semáforo te dice cómo ha ido la semana: lo que va bien y lo que puedes mejorar.",
  'voybien.p2': 'Si algo flojea, como la proteína, te lo señala para la semana siguiente. Las cuentas las hace la app: tú solo apuntas lo que comes.',
  'voybien.alt': 'La revisión del domingo: semáforo en ámbar, «Casi»: 3 de 3 entrenos, un centímetro menos de cintura y, a mejorar, la proteína.',

  // Varios
  'comun.datos-ejemplo': 'Datos de ejemplo.',

  // Tu cuerpo
  'cuerpo.titulo': 'Ve cómo cambias.',
  'cuerpo.p1': 'Peso, cintura y grasa corporal en una gráfica sencilla. Con la media de cada semana, porque el peso de un día suelto engaña.',
  'cuerpo.android': 'Si tienes una báscula o un reloj conectados al móvil, los pasos y el peso se apuntan solos (a través de Health Connect, la app de salud de Android, y solo si tú lo activas).',
  'cuerpo.iphone': 'En el iPhone, el peso y los pasos los apuntas tú en un momento.',
  'cuerpo.alt': 'Progreso, pestaña Cuerpo: el peso baja de 85,2 a 82,3 kg en siete semanas y la cintura, de 98 a 95 cm.',

  // Privacidad
  'privacidad.titulo': 'Tus datos se quedan en tu móvil.',
  'privacidad.intro': 'No hay cuentas ni nube. No hay nada que robar ni que vender.',
  'privacidad.pagina.titulo': 'Esta página tampoco te sigue',
  'privacidad.pagina.texto': 'No tiene analíticas ni cookies.',
  'privacidad.internet.titulo': 'Funciona sin internet',
  'privacidad.internet.texto': 'Solo el escáner necesita conexión: busca el código en Open Food Facts y carga de allí la foto del producto. Nada más sale del móvil.',
  'privacidad.cuentas.titulo': 'Sin cuentas ni contraseñas',
  'privacidad.cuentas.texto': 'Abres la app y empiezas.',
  'privacidad.copia.titulo': 'Tu copia, en tu archivo',
  'privacidad.copia.texto': 'Guarda una copia cuando quieras y llévatela a otro móvil.',
  'privacidad.pierdo': "<b>¿Y si pierdo el móvil?</b> Como nadie más tiene tus datos, se perderían con él: haz una copia de vez en cuando (la app te lo recuerda). <a href=\"#cambiar\" data-abrir=\"d-cambiar\">Cómo se hace</a>",

  // Quién la ha hecho
  'autor.titulo': 'Hecha por alguien que entrena temprano.',
  'autor.texto': "La hice para mí. Entreno temprano, tres días a la semana, y quería abrir el móvil y saber qué tocaba sin pensar. También pensé en mi padre: si él la entiende sin ayuda, está bien hecha.",
  'autor.novedades': 'Novedades de cada versión',
  'autor.codigo': 'El código es público: cualquiera que sepa programar puede ver lo que hace la app por dentro, y usarlo o cambiarlo diciendo quién lo hizo. Lo único que no se puede es venderlo. <a href="https://github.com/Jowy05/JowyFit/tree/prod">Ver el código</a>',

  // Preguntas frecuentes
  'faq.titulo': 'Lo que te puedes preguntar.',
  'faq.android.pregunta': '¿Cómo se instala en Android?',
  'faq.android.paso1': '<b>1.</b> Toca «Descargar la app gratis». Chrome pregunta lo mismo con todas las apps que no vienen de Google Play, sin mirar cuál es. Toca «Descargar de todos modos».',
  'faq.android.paso2': '<b>2.</b> Abre el archivo. Si te lo pide, toca «Ajustes», activa «Permitir de esta fuente» y vuelve atrás.',
  'faq.android.paso3': '<b>3.</b> Toca «Instalar». Ya la tienes en tu pantalla de inicio.',
  'faq.android.rotulo': 'Dibujo orientativo: en tu móvil puede verse un poco distinto.',
  'faq.android.p2': 'Puedes quitar ese permiso después, en los ajustes del móvil. Funciona en Android 8 o superior. <a href="#segura" data-abrir="d-segura">¿Es seguro instalarla?</a>',
  'faq.googleplay.pregunta': '¿Por qué no está en Google Play?',
  'faq.googleplay.p1': 'Para estar en Google Play hay que darse de alta como desarrollador, pagar una cuota y pasar un periodo de pruebas con otras personas antes de publicar. Para una app gratis que hace una sola persona, de momento no compensa.',
  'faq.googleplay.p2': 'El archivo de esta página es la app completa, la misma que estaría allí. Pide pocos permisos y tus datos no salen del móvil: <a href="#segura" data-abrir="d-segura">mira qué permisos pide y por qué</a>.',
  'faq.iphone.pregunta': '¿Y en iPhone o iPad?',
  'faq.iphone.p1': 'Se usa desde Safari, sin descargar nada. Primero, ábrela en <b>Safari</b> (la brújula azul): si te la han mandado por WhatsApp, toca la brújula o «···» y elige «Abrir en Safari». Toca «Abrir JowyFit gratis» y, en la app que se abre:',
  'faq.iphone.paso1': '<b>1.</b> Toca Compartir: abajo en el iPhone, arriba a la derecha en el iPad.',
  'faq.iphone.paso2': '<b>2.</b> Baja y toca «Añadir a pantalla de inicio».',
  'faq.iphone.paso3': '<b>3.</b> Toca «Añadir». Ya está.',
  'faq.iphone.rotulo': 'Dibujo orientativo: en tu iPhone puede verse un poco distinto.',
  'faq.iphone.p2': 'Lo que no puede hacer en iPhone: avisar en el reloj al acabar el descanso y traer solos los pasos y el peso. Esos los apuntas tú.',
  'faq.appstore.pregunta': '¿Por qué no está en la App Store?',
  'faq.appstore.p1': 'Porque no hace falta. En el iPhone y el iPad funciona desde Safari: sin descargar nada, gratis y sin pedirte tu cuenta de Apple. Y al dejarla en tu pantalla de inicio se abre como cualquier otra app.',
  'faq.appstore.p2': 'Para estar en la App Store hay que pagar una cuota a Apple cada año, y una app gratis que hace una sola persona no lo necesita.',
  'faq.gratis.pregunta': '¿Es gratis de verdad?',
  'faq.gratis.respuesta': 'Sí. Sin pagos, sin pruebas que caducan y sin anuncios.',
  'faq.internet.pregunta': '¿Funciona sin internet?',
  'faq.internet.respuesta': 'Sí. Solo el escáner necesita conexión para buscar el producto; si no hay, guarda el código y lo busca después.',
  'faq.mayores.pregunta': '¿Sirve si tengo 60 años o nunca he ido al gimnasio?',
  'faq.mayores.respuesta': "Sí. La primera vez te enseña lo importante con un paseo guiado, puedes poner la letra grande y la rutina empieza suave, con pesos cómodos.",
  'faq.actualizar.pregunta': '¿Cómo se actualiza? ¿Pierdo lo que he apuntado?',
  'faq.actualizar.android': 'No pierdes nada. Cuando salga una versión nueva, descárgala desde esta página e instálala encima de la que tienes: tus datos se quedan.',
  'faq.actualizar.iphone': 'No pierdes nada. Se actualiza sola cuando la abres con internet, y tus datos se quedan.',
  'faq.actualizar.novedades': 'Lo que cambia en cada versión lo tienes en <a href="#novedades" data-abrir="d-novedades">Novedades</a>.',
  'faq.cambiar.pregunta': '¿Qué pasa si cambio de móvil o lo pierdo?',
  'faq.cambiar.p1': 'Tus datos solo están en tu móvil, así que la copia la guardas tú. Hazla en Perfil → Ajustes → «Copia de seguridad»: es un archivo que puedes mandarte por correo o guardar en Drive o en el ordenador. La app te avisa si llevas una semana sin hacerla.',
  'faq.cambiar.p2': 'En el móvil nuevo, abre la app y toca «Tengo una copia».',
  'faq.quitar.pregunta': '¿Cómo la quito?',
  'faq.quitar.respuesta': 'Como cualquier app: mantén pulsado el icono y toca «Desinstalar» (en el iPhone, «Eliminar app»). Tus datos se borran con ella, así que haz antes una copia si los quieres guardar.',
  'faq.novedades.pregunta': 'Novedades: qué ha cambiado en cada versión',

  // Novedades de cada versión
  'nov.0-8-0.cab': "<b>Versión 0.8.0</b> · 29 de octubre de 2026",
  'nov.0-8-0.texto': "Tu rutina, a tu medida: siete objetivos, más trabajo en las zonas que elijas y fuera lo que no quieras hacer. Apunta tus molestias con tres toques y, cada domingo, una revisión de 20 segundos ajusta los próximos entrenos (con «Deshacer»). Además: rutina en orden para no perder ningún entreno, sesión mínima de 15 minutos, modo mayor desde los 65, pasos y cardio que suben poco a poco y una página nueva en el PDF con tu rutina y tu salud.",
  'nov.0-7-1.cab': "<b>Versión 0.7.1</b> · 24 de octubre de 2026",
  'nov.0-7-1.texto': "Arreglo: los avisos de «a dormir» de la semana que viene ya no se pierden (con el alta en fin de semana no salía ninguno), y al acabar un entreno el «próximo» es de verdad el siguiente.",
  'nov.0-7-0.cab': "<b>Versión 0.7.0</b> · 24 de octubre de 2026",
  'nov.0-7-0.texto': "Crea tus propios ejercicios: para lo que no está en la lista, con su nombre, qué trabaja, con qué y cómo lo apuntas (y una foto y notas, si quieres). Salen con la marca «Tuyo», se añaden al plan y al entreno como los demás y, si los borras, lo que ya hiciste se queda en el historial.",
  'nov.0-6-1.cab': "<b>Versión 0.6.1</b> · 24 de octubre de 2026",
  'nov.0-6-1.texto': "Arreglos: los avisos de la copia y de la foto ya no se aplazan cada vez que abres la app; el aviso del descanso vuelve si el móvil cierra la app; los escaneados sin conexión se buscan solos al volver la cobertura; y si te das de alta en fin de semana, la semana 1 empieza con tu primer entreno.",
  'nov.0-6-0.cab': "<b>Versión 0.6.0</b> · 24 de octubre de 2026",
  'nov.0-6-0.texto': "Los ejercicios, en catalán: el nombre, los pasos y los consejos de los más de 600. Y en inglés, los récords pasan a llamarse «PR».",
  'nov.0-5-0.cab': '<b>Versión 0.5.0</b> · 23 de octubre de 2026',
  'nov.0-5-0.texto': 'Calistenia y cardio, fáciles de encontrar: en Rutina → Ejercicios hay dos filtros nuevos, y buscar «calistenia» o «cardio» también los encuentra. Las dominadas, los fondos, las anillas y el TRX se apuntan por repeticiones, sin pedirte kilos. La hora de entreno se puede poner a cualquier hora, también de noche y de madrugada. Y la licencia cambia: puedes usar, copiar y cambiar JowyFit diciendo quién lo hizo, pero no venderla.',
  'nov.0-4-1.cab': '<b>Versión 0.4.1</b> · 23 de octubre de 2026',
  'nov.0-4-1.texto': 'El informe en PDF, más claro y con los colores de la app. La página y la demo, más fáciles de leer y de usar con el teclado. Arreglos: el % de grasa sale igual en Inicio, Metas y el informe, y los avisos de suplementos salen en tu idioma. Por dentro, la app está ordenada para crecer sin fallos.',
  'nov.0-4-0.cab': '<b>Versión 0.4.0</b> · 22 de octubre de 2026',
  'nov.0-4-0.texto': 'La app, en tres idiomas: castellano, catalán e inglés. Por defecto sigue en castellano; cámbialo en Ajustes → Apariencia → Idioma. Fechas, horas, números y los ejercicios (en inglés) salen en tu idioma.',
  'nov.0-3-0.cab': '<b>Versión 0.3.0</b> · 21 de octubre de 2026',
  'nov.0-3-0.texto': 'Tutorial dentro de la app: la primera vez te ofrece un paseo por lo importante, y lo tienes siempre en Ajustes. En iPhone explica lo que allí se hace de otra forma. Y en esta página, una demo de un minuto.',
  'nov.0-2-1.cab': '<b>Versión 0.2.1</b> · 21 de octubre de 2026',
  'nov.0-2-1.texto': 'Nuevo aspecto: icono nuevo y la app pasa del naranja al morado. El informe en PDF estrena un diseño más limpio, con el mismo morado.',
  'nov.0-2-0.cab': '<b>Versión 0.2.0</b> · 21 de octubre de 2026',
  'nov.0-2-0.texto': 'Informe en PDF: elige los días y qué lleva (entrenos, esfuerzo de cada ejercicio, récords, comida, cuerpo y pasos) y guárdalo o envíalo. Las copias de seguridad se revisan antes de recuperarlas, y la app ya funciona en el iPhone desde Safari.',
  'nov.0-1-6.cab': '<b>Versión 0.1.6</b> · 20 de octubre de 2026',
  'nov.0-1-6.texto': 'Repaso completo de la app y 20 fallos arreglados: volver al entreno tras la última serie, los avisos del descanso, la pantalla encendida en el iPhone y corregir las series de un entreno ya guardado. «Borrar todo» pide confirmarlo dos veces.',
  'nov.0-1-5.cab': '<b>Versión 0.1.5</b> · 19 de octubre de 2026',
  'nov.0-1-5.texto': 'En Inicio ves las calorías que gastas en reposo y entrenando. Y «Saltar este ejercicio» está a la vista.',
  'nov.0-1-4.cab': '<b>Versión 0.1.4</b> · 18 de octubre de 2026',
  'nov.0-1-4.texto': 'Conectar el reloj y la báscula es más fácil: un solo botón en Ajustes (Android).',
  'nov.0-1-3.cab': '<b>Versión 0.1.3</b> · 18 de octubre de 2026',
  'nov.0-1-3.texto': 'El peso y la grasa de la báscula llegan solos (Android).',
  'nov.0-1-2.cab': '<b>Versión 0.1.2</b> · 17 de octubre de 2026',
  'nov.0-1-2.texto': 'Al apuntar una comida eliges Poco, Normal o Mucho. Los suplementos llevan su cantidad y el batido suma su proteína.',
  'nov.0-1-1.cab': '<b>Versión 0.1.1</b> · 17 de octubre de 2026',
  'nov.0-1-1.texto': 'Raciones más lógicas, más datos de los productos escaneados, y el botón atrás pregunta antes de dejar un entreno.',
  'nov.0-1-0.cab': '<b>Versión 0.1.0</b> · 15 de octubre de 2026',
  'nov.0-1-0.texto': 'La primera versión: rutina, entreno, comida y progreso.',

  // Cierre
  'cierre.titulo': 'Empieza suave. Sigue constante.',
  'cierre.iphone': 'En iPhone y iPad, ábrela en Safari y déjala en tu pantalla de inicio.',

  // Pie
  'pie.enlaces': "<b translate=\"no\">JowyFit</b> · Gratis y con el código a la vista · <a href=\"#novedades\" data-abrir=\"d-novedades\">Novedades</a> · <a href=\"privacypolicy.html\">Política de privacidad</a>",
  'pie.creditos': 'Créditos: los ejercicios y sus dibujos son de RepDB; los alimentos, de Open Food Facts. Iconos Phosphor y letra Barlow. <span data-version-corta=""></span> · Licencia PolyForm Noncommercial · <a href="https://github.com/Jowy05/JowyFit/tree/prod">Código</a>',

  // Barra fija del móvil
  // Landing «Historias»: cabecera, hora grande del hero, historias del móvil, tu plan y los ceros de privacidad.
  'cab.secciones': "Secciones",
  'cab.instalar': "Cómo se instala",
  'cab.privacidad': "Privacidad",
  'cab.preguntas': "Preguntas",
  'hora.0': "Martes. Tu rutina ya está lista.",
  'hora.1': "Apuntas la serie en dos toques.",
  'hora.2': "Descanso. Te avisa al acabar.",
  'hero.tienes-iphone': "¿Tienes iPhone?",
  'historias.aria': "Lo que hace por ti, en siete historias",
  'historias.1': "Historia 1 de 7",
  'historias.2': "Historia 2 de 7",
  'historias.3': "Historia 3 de 7",
  'historias.4': "Historia 4 de 7",
  'historias.5': "Historia 5 de 7",
  'historias.6': "Historia 6 de 7",
  'historias.7': "Historia 7 de 7",
  'historias.saltar': "Saltar historias",
  'historias.seguir': "Seguir",
  'historias.toques.titulo': "Apuntas en dos toques.",
  'historias.toques.texto': "Tocas «Hecho» o «Igual que la anterior». Si te sale fácil, la próxima vez te pone un poco más.",
  'historias.toques.alt': "Una serie de sentadilla: la última vez 20 kg × 6; hoy, 20 kg, con los botones Ocupado y Hecho.",
  'historias.descanso.titulo': "El descanso te avisa.",
  'historias.descanso.iphone': "Una cuenta atrás entre series. Al acabar suena un pitido y la pantalla destella: déjala abierta.",
  'historias.descanso.alt': "El descanso entre series: quedan 2:29 y lo siguiente es la serie 2, 20 kg × 6-10.",
  'historias.ocupado.texto': "Toca «Ocupado» y te propone otro ejercicio que trabaja lo mismo, con el peso ya puesto.",
  'historias.comida.texto': "Apunta con <strong>Poco</strong>, <strong>Normal</strong> o <strong>Mucho</strong>. Primero ves la proteína. Y si tiene código de barras, lo escaneas.",
  'historias.cuerpo.texto': "Peso, cintura y grasa, con la media de cada semana: el peso de un día suelto engaña.",
  'plan.aria': "¿Qué días vas? Toca para marcar o quitar",
  'plan.menos': "Menos tiempo",
  'plan.mas': "Más tiempo",
  'plan.salida': "<b>{dias}</b>: {n}, {min} min cada día. La rutina se hace sola.",
  'plan.n.uno': "1 día",
  'plan.n.varios': "{n} días",
  'plan.vacio': "Toca al menos un día.",
  'seis.ejercicios': "ejercicios.",
  'seis.texto': "Cada uno con su dibujo, también de calistenia y cardio. Le dices qué hay en tu gimnasio y elige entre ellos.",
  'privacidad.cero.cuentas': "<span class=\"oculto\">Cero </span>cuentas que crear",
  'privacidad.cero.anuncios': "<span class=\"oculto\">Cero </span>anuncios",
  'privacidad.cero.nube': "<span class=\"oculto\">Cero </span>datos en la nube",
  'privacidad.cero.cookies': "<span class=\"oculto\">Cero </span>cookies en esta página",
  'barra.descargar': 'Descargar gratis',
}

export default es
