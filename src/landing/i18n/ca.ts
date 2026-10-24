// Textos de la landing en catalán (normativa del IEC, variante central; de tú). Mismas claves que es.ts:
// TypeScript avisa si falta alguna. Glosario y avisos: README, «Idiomas».
import type es from './es'

const ca: Record<keyof typeof es, string> = {
  // Página: título y descripción (buscadores y al compartir el enlace)
  'meta.titulo': 'JowyFit · Menys pensar, més entrenar',
  'meta.descripcion': "L’app gratis per tornar al gimnàs: et fa la rutina segons els teus dies i el teu temps i t’apuja els pesos tota sola. Sense comptes, sense anuncis i les teves dades només al teu mòbil.",
  'meta.og-descripcion': "L’app gratis per tornar al gimnàs. Sense comptes, sense anuncis i les teves dades només al teu mòbil.",

  // Cabecera
  'cab.saltar': 'Anar al contingut',
  'cab.marca': 'JowyFit, inici',
  'cab.letra': 'Lletra gran',

  // Selector de idioma (el nombre de cada idioma no se traduce: va en su propio idioma)
  'idioma.boton': "{codigo} · Idioma: {nombre}",

  // Hero: lo primero que se ve
  'hero.titulo.1': 'Menys pensar.',
  'hero.titulo.2': 'Més <em class="subrayado">entrenar.</em>',
  'hero.sub': "L’app gratuïta que et fa la rutina segons els teus dies i el teu temps, i t’apuja els pesos tota sola.",
  'hero.nota-android': 'No ve de Google Play: s’instal·la amb el fitxer d’aquesta pàgina, en 3 passos. <a href="#android" data-abrir="d-android">Veure com s’instal·la</a>',
  'hero.nota-pc': "Ara ets a l’ordinador: obre aquesta pàgina al teu mòbil Android per instal·lar-la allà.",
  'hero.dentro-app': '<b>Ets dins d’una altra app.</b> Per tenir JowyFit a la teva pantalla, obre-la a Safari: toca «···» o la brúixola i tria «Obre a Safari».',
  'hero.nota-apple': "En tocar-lo, l’app s’obre a Safari i t’ensenya a deixar-la a la pantalla d’inici, com una icona més.",
  'hero.nota-appstore': 'No és a l’App Store i no cal: funciona des de Safari, gratis i sense baixar res. <a href="#appstore" data-abrir="d-appstore">Per què?</a>',
  'hero.otra-iphone': 'Tens iPhone? Es fa servir des de Safari, sense baixar res',
  'hero.otra-android': 'Tens Android? Mira com es baixa',

  // Botones (se repiten en el hero, en la franja del medio y en el cierre)
  'cta.descargar': "Baixar l’app gratis",
  'cta.empezada': 'Baixada iniciada',
  'cta.abrir': 'Obrir JowyFit gratis',
  'cta.demo': "Veure la demo <small class=\"solo-otro\">· 1 minut</small><small class=\"solo-apple\">· minut i mig</small>",
  'cta.abrir-corto': 'Obrir JowyFit',

  // Lo que te garantizamos (debajo de cada botón)
  'garantias.aria': "En resum",
  'garantias.gratis': 'Gratis',
  'garantias.cuentas': 'Sense comptes',
  'garantias.anuncios': 'Sense anuncis',
  'garantias.internet': 'Funciona sense internet',

  // Línea bajo el botón de Android (la escribe el JS): «Per a Android 8 o superior · 28 MB · actualitzada el 21 d’octubre del 2026 · Novetats»
  'version.android': 'Per a Android 8 o superior',
  'version.tamano': "{mb} MB",
  'version.fecha': 'actualitzada el {fecha}',
  'version.novedades': 'Novetats',
  'version.corta': 'Versió {version}',

  // «¿Es seguro instalarla?» (Android)
  'segura.titulo': 'És segur instal·lar-la?',
  'segura.sub': 'Quins permisos demana i què fa amb les teves dades',
  'segura.p1': "S’instal·la amb un fitxer d’aquesta pàgina, no des de Google Play. Per això el mòbil et demana permís i t’avisa: ho fa amb qualsevol app de fora de la botiga.",
  'segura.permisos': '<b>Demana pocs permisos.</b> Avisos, perquè soni el final del descans; la càmera, només per escanejar codis de barres. I, només si tu ho actives, llegir els passos, el pes i el greix de Health Connect, l’app de salut d’Android.',
  'segura.no-pide': '<b>No demana</b> la teva ubicació, els teus contactes ni el micròfon.',
  'segura.datos': '<b>Les teves dades no surten del mòbil.</b> Només fa servir internet amb l’escàner: busca el codi de barres a Open Food Facts (una llista pública d’aliments) i mostra la foto del producte des dels seus servidors. Envia aquest número i res més.',
  'segura.play-protect': '<b>Google Play Protect</b>, que ve als mòbils Android, la pot revisar en instal·lar-la, com qualsevol app.',
  'segura.firma': '<b>Sempre amb la mateixa signatura:</b> el mòbil només deixa instal·lar a sobre versions fetes per la mateixa persona.',
  'segura.huella': '<b>Per comprovar que és el fitxer de veritat:</b> la seva empremta (SHA-256) és <code class="huella" data-huella-valor=""></code>. Si la calcules amb el fitxer que has baixat i surt igual, és exactament el que es va publicar i ningú no l’ha canviat.',
  'segura.quitar': '<b>Es treu com qualsevol app:</b> mantén premuda la icona i toca «Desinstal·la».',

  // Pasos para dejarla en el iPhone (hero)
  'ios.aria': "Com deixar-la a l’iPhone",
  'ios.paso0': '<b>Abans, obre-la a Safari</b>, la brúixola blava.',
  'ios.whatsapp.titulo': "Te l’han enviat per WhatsApp?",
  'ios.whatsapp.texto': "S’obre dins de WhatsApp i des d’allà no es pot instal·lar. Toca la brúixola (a baix a la dreta) o els tres punts «···» i tria «Obre a Safari».",
  'ios.paso1': '<b>Toca «Obrir JowyFit gratis».</b> S’obre l’app.',
  'ios.paso2': '<b>Allà, toca Comparteix</b>, a la part de baix de la pantalla.',
  'ios.paso3': '<b>Toca «Afegeix a la pantalla d’inici»</b> i després <b>«Afegeix»</b>.',
  'ios.ipad-mac': "A l’iPad, Comparteix és a dalt a la dreta. Al Mac: menú Arxiu → «Afegeix al Dock».",

  // Pantallitas dibujadas: copian lo que pone el móvil (iOS, Chrome y Android en ese idioma)
  'pantallita.abrir-safari': 'Obre a Safari',
  'pantallita.compartir': 'Comparteix',
  'pantallita.anadir-inicio': "Afegeix a la pantalla d’inici",
  'pantallita.cancelar': 'Cancel·la',
  'pantallita.anadir': 'Afegeix',
  'pantallita.chrome.titulo': 'Vols baixar JowyFit.apk igualment?',
  'pantallita.chrome.texto': 'Aquest tipus de fitxer pot malmetre el dispositiu.',
  'pantallita.chrome.si': 'Baixa igualment',
  'pantallita.fuentes.titulo': 'Instal·la aplicacions desconegudes',
  'pantallita.fuentes.permitir': "Permet d’aquesta font",
  'pantallita.instalar.texto': 'Vols instal·lar aquesta aplicació?',
  'pantallita.instalar.si': 'Instal·la',

  // Móvil animado del hero
  'maqueta.alt': "La pantalla d’inici de JowyFit un dimarts a les 5:30: «Avui et toca» Cos complet A, uns 48 minuts, amb els seus exercicis i el botó Començar la rutina.",
  'maqueta.aviso': '<b>Descans acabat</b>Esquat posterior amb barra · sèrie següent',
  'maqueta.pie': 'Captures reals de l’app.<span class="solo-otro"> El rellotge és un dibuix: a Android, l’avís arriba també al rellotge.</span>',

  // Reloj dibujado y bloque «El descanso te avisa»
  'reloj.terminado': 'Descans acabat',
  'reloj.titulo': "El descans t’avisa, també al rellotge.",
  'reloj.texto': 'Sona en acabar encara que portis el mòbil a la butxaca. Si tens un rellotge connectat al mòbil, vibra al canell.',
  'reloj.serie': 'Sèrie 2',
  'reloj.etiqueta': 'Dibuix · a Android',

  // Botón de la animación del hero
  'anim.ver': "Veure l’animació",
  'anim.pausar': 'Pausa',
  'anim.seguir': 'Continuar',
  'anim.otra': 'Tornar a veure',

  // Lo que hace por ti
  'hace.titulo': "El que fa per tu.",
  'hace.hoy.titulo': 'Et diu què toca avui',
  'hace.hoy.texto': 'Li dius quins dies hi vas i quant de temps tens. La rutina es fa sola.',
  'hace.toques.titulo': 'Ho apuntes en dos tocs',
  'hace.toques.texto': "Toques «Fet» o «Igual que l’anterior», i a descansar.",
  'hace.peso.titulo': 'Apuja el pes quan toca',
  'hace.peso.texto': "Quan una sèrie et surt fàcil, la pròxima vegada t’hi posa una mica més.",

  // Cifras
  'cifras.ejercicios': 'exercicis, cadascun amb el seu dibuix',
  'cifras.mas-de': 'Més de {n}',

  // Así empiezas
  'empiezas.titulo': "El teu pla, en unes preguntes.",
  'empiezas.dias.aria': 'Exemple: dimarts, dijous i divendres',
  'empiezas.dias.l': 'Dl',
  'empiezas.dias.m': 'Dt',
  'empiezas.dias.x': 'Dc',
  'empiezas.dias.j': 'Dj',
  'empiezas.dias.v': 'Dv',
  'empiezas.dias.s': 'Ds',
  'empiezas.dias.d': 'Dg',
  'empiezas.paso1.titulo': 'Digues-nos els dies i el temps',
  'empiezas.paso1.texto': 'Dimarts, dijous i divendres, una hora… el que tinguis.',
  'empiezas.paso2.titulo': 'Tria el teu gimnàs',
  'empiezas.paso2.texto': 'Un de complet, o marques tu les màquines que hi ha.',
  'empiezas.paso3.titulo': 'Setmana de prova',
  'empiezas.paso3.texto': 'La primera setmana mesura quant trigues de veritat i ajusta la rutina.',
  'empiezas.paso4.titulo': 'Entrena i apunta',
  'empiezas.paso4.texto': 'Cada sèrie en segons. Els pesos pugen sols.',
  'empiezas.alt': 'El pas «Els teus horaris»: dimarts, dijous i divendres marcats, a les 5:30 i 60 minuts cada dia.',

  // Llamada del medio

  // Bloques de funciones
  'funciones.aria': "El que fa l’app",

  // Máquina ocupada
  'ocupado.titulo': "Màquina ocupada? Te’n dona una altra.",
  'ocupado.texto': "A l’hora punta, toca «Ocupada» i et proposa un altre exercici que treballa el mateix, amb el pes ja posat. I recorda què fas cada dia.",
  'ocupado.alt': "El panell «Ocupada»: si l’esquat amb barra està ocupat, proposa la premsa de cames amb 10 kg × 6-10.",

  // Comida
  'comida.titulo': 'Menja sense comptar calories.',
  'comida.texto': 'Apunta el que menges amb <strong>Poc</strong>, <strong>Normal</strong> o <strong>Molt</strong>. Primer veus la proteïna; la resta, en segon pla. I si té codi de barres, l’escaneges.',
  'comida.nota': "Els productes escanejats surten d’Open Food Facts, una llista pública i gratuïta d’aliments: en escanejar, se li envia el codi de barres i la foto del producte es carrega dels seus servidors.",
  'comida.alt': 'Apuntar menjar: «Llenties amb xoriço» amb els botons Poc, Normal i Molt, i Normal marcat (unes 600 kcal).',

  // ¿Voy bien?
  'voybien.titulo': 'Vaig bé?',
  'voybien.p1': "Cada diumenge, un semàfor et diu com ha anat la setmana: el que va bé i el que pots millorar.",
  'voybien.p2': "Si alguna cosa fluixeja, com la proteïna, t’ho fa notar per a la setmana següent. Els comptes els fa l’app: tu només apuntes el que menges.",
  'voybien.alt': 'La revisió del diumenge: semàfor en ambre, «Gairebé»: 3 de 3 entrenaments, un centímetre menys de cintura i, per millorar, la proteïna.',

  // Varios
  'comun.datos-ejemplo': "Dades d’exemple.",

  // Tu cuerpo
  'cuerpo.titulo': 'Mira com canvies.',
  'cuerpo.p1': "Pes, cintura i greix corporal en un gràfic senzill. Amb la mitjana de cada setmana, perquè el pes d’un sol dia enganya.",
  'cuerpo.android': "Si tens una bàscula o un rellotge connectats al mòbil, els passos i el pes s’apunten sols (a través de Health Connect, l’app de salut d’Android, i només si tu ho actives).",
  'cuerpo.iphone': "A l’iPhone, el pes i els passos els apuntes tu en un moment.",
  'cuerpo.alt': 'Progrés, pestanya Cos: el pes baixa de 85,2 a 82,3 kg en set setmanes i la cintura, de 98 a 95 cm.',

  // Privacidad
  'privacidad.titulo': 'Les dades es queden al teu mòbil.',
  'privacidad.intro': 'No hi ha comptes ni núvol. No hi ha res per robar ni per vendre.',
  'privacidad.pagina.titulo': 'Aquesta pàgina tampoc et segueix',
  'privacidad.pagina.texto': 'No té analítiques ni galetes.',
  'privacidad.internet.titulo': 'Funciona sense internet',
  'privacidad.internet.texto': "Només l’escàner necessita connexió: busca el codi a Open Food Facts i en carrega la foto del producte. No surt res més del mòbil.",
  'privacidad.cuentas.titulo': 'Sense comptes ni contrasenyes',
  'privacidad.cuentas.texto': "Obres l’app i comences.",
  'privacidad.copia.titulo': 'La còpia, al teu fitxer',
  'privacidad.copia.texto': "Guarda una còpia quan vulguis i emporta-te-la a un altre mòbil.",
  'privacidad.pierdo': "<b>I si perdo el mòbil?</b> Com que ningú més no té les teves dades, es perdrien amb ell: fes una còpia de tant en tant (l’app t’ho recorda). <a href=\"#cambiar\" data-abrir=\"d-cambiar\">Com es fa</a>",

  // Quién la ha hecho
  'autor.titulo': "Feta per algú que entrena d’hora.",
  'autor.texto': "La vaig fer per a mi. Entreno d’hora, tres dies a la setmana, i volia obrir el mòbil i saber què tocava sense pensar. També vaig pensar en el meu pare: si ell l’entén sense ajuda, està ben feta.",
  'autor.novedades': 'Novetats de cada versió',
  'autor.codigo': 'El codi és públic: qualsevol persona que sàpiga programar pot veure què fa l’app per dins, i fer-lo servir o canviar-lo dient qui l’ha fet. L’únic que no es pot fer és vendre’l. <a href="https://github.com/Jowy05/JowyFit/tree/prod">Veure el codi</a>',

  // Preguntas frecuentes
  'faq.titulo': 'El que et pots preguntar.',
  'faq.android.pregunta': "Com s’instal·la a Android?",
  'faq.android.paso1': '<b>1.</b> Toca «Baixar l’app gratis». Chrome pregunta el mateix amb totes les apps que no són de Google Play, sense mirar quina és. Toca «Baixa igualment».',
  'faq.android.paso2': '<b>2.</b> Obre el fitxer. Si t’ho demana, toca «Configuració», activa «Permet d’aquesta font» i torna enrere.',
  'faq.android.paso3': '<b>3.</b> Toca «Instal·la». Ja la tens a la pantalla d’inici.',
  'faq.android.rotulo': 'Dibuix orientatiu: al teu mòbil es pot veure una mica diferent.',
  'faq.android.p2': 'Pots treure aquest permís després, a la configuració del mòbil. Funciona a Android 8 o superior. <a href="#segura" data-abrir="d-segura">És segur instal·lar-la?</a>',
  'faq.googleplay.pregunta': 'Per què no és a Google Play?',
  'faq.googleplay.p1': "Per ser a Google Play cal donar-se d’alta com a desenvolupador, pagar una quota i passar un període de proves amb altres persones abans de publicar. Per a una app gratis que fa una sola persona, de moment no surt a compte.",
  'faq.googleplay.p2': 'El fitxer d’aquesta pàgina és l’app completa, la mateixa que hi hauria allà. Demana pocs permisos i les teves dades no surten del mòbil: <a href="#segura" data-abrir="d-segura">mira quins permisos demana i per què</a>.',
  'faq.iphone.pregunta': "I a l’iPhone o l’iPad?",
  'faq.iphone.p1': 'Es fa servir des de Safari, sense baixar res. Primer, obre-la a <b>Safari</b> (la brúixola blava): si te l’han enviat per WhatsApp, toca la brúixola o «···» i tria «Obre a Safari». Toca «Obrir JowyFit gratis» i, a l’app que s’obre:',
  'faq.iphone.paso1': '<b>1.</b> Toca Comparteix: a baix a l’iPhone, a dalt a la dreta a l’iPad.',
  'faq.iphone.paso2': '<b>2.</b> Més avall, toca «Afegeix a la pantalla d’inici».',
  'faq.iphone.paso3': '<b>3.</b> Toca «Afegeix». Ja està.',
  'faq.iphone.rotulo': 'Dibuix orientatiu: al teu iPhone es pot veure una mica diferent.',
  'faq.iphone.p2': "El que no pot fer a l’iPhone: avisar al rellotge quan s’acaba el descans i apuntar tota sola els passos i el pes. Això ho apuntes tu.",
  'faq.appstore.pregunta': "Per què no és a l’App Store?",
  'faq.appstore.p1': "Perquè no cal. A l’iPhone i l’iPad funciona des de Safari: sense baixar res, gratis i sense demanar-te el compte d’Apple. I quan la deixes a la pantalla d’inici s’obre com qualsevol altra app.",
  'faq.appstore.p2': "Per ser a l’App Store cal pagar una quota a Apple cada any, i una app gratis que fa una sola persona no ho necessita.",
  'faq.gratis.pregunta': 'És gratis de veritat?',
  'faq.gratis.respuesta': "Sí. Sense pagaments, sense períodes de prova que s’acaben i sense anuncis.",
  'faq.internet.pregunta': 'Funciona sense internet?',
  'faq.internet.respuesta': "Sí. Només l’escàner necessita connexió per buscar el producte; si no n’hi ha, guarda el codi i el busca després.",
  'faq.mayores.pregunta': 'Em serveix si tinc 60 anys o no he anat mai al gimnàs?',
  'faq.mayores.respuesta': "Sí. La primera vegada t’ensenya el més important amb un passeig guiat, pots posar la lletra gran i la rutina comença suau, amb pesos còmodes.",
  'faq.actualizar.pregunta': "Com s’actualitza? Perdo el que he apuntat?",
  'faq.actualizar.android': "No perds res. Quan surti una versió nova, baixa-la des d’aquesta pàgina i instal·la-la a sobre de la que tens: les teves dades es queden.",
  'faq.actualizar.iphone': "No perds res. S’actualitza sola quan l’obres amb internet, i les teves dades es queden.",
  'faq.actualizar.novedades': 'El que canvia a cada versió ho tens a <a href="#novedades" data-abrir="d-novedades">Novetats</a>.',
  'faq.cambiar.pregunta': 'Què passa si canvio de mòbil o el perdo?',
  'faq.cambiar.p1': "Les teves dades només són al teu mòbil, així que la còpia la guardes tu. Fes-la a Perfil → Configuració → «Còpia de seguretat»: és un fitxer que et pots enviar per correu o guardar a Drive o a l’ordinador. L’app t’avisa si fa una setmana que no en fas cap.",
  'faq.cambiar.p2': "Al mòbil nou, obre l’app i toca «Tinc una còpia».",
  'faq.quitar.pregunta': 'Com la trec?',
  'faq.quitar.respuesta': "Com qualsevol app: mantén premuda la icona i toca «Desinstal·la» (a l’iPhone, «Elimina l’app»). Les teves dades s’esborren amb ella, així que fes abans una còpia si les vols guardar.",
  'faq.novedades.pregunta': 'Novetats: què ha canviat a cada versió',

  // Novedades de cada versión (fechas como las pone el navegador en catalán: «21 d’octubre del 2026»)
  'nov.0-6-1.cab': "<b>Versió 0.6.1</b> · 24 d’octubre del 2026",
  'nov.0-6-1.texto': "Arranjaments: els avisos de la còpia i de la foto ja no s’ajornen cada vegada que obres l’app; l’avís del descans torna si el mòbil tanca l’app; els escanejats sense connexió es busquen sols quan torna la cobertura; i si et dones d’alta el cap de setmana, la setmana 1 comença amb el teu primer entrenament.",
  'nov.0-6-0.cab': "<b>Versió 0.6.0</b> · 24 d’octubre del 2026",
  'nov.0-6-0.texto': "Els exercicis, en català: el nom, els passos i els consells de més de 600. I en anglès, els rècords passen a dir-se «PR».",
  'nov.0-5-0.cab': '<b>Versió 0.5.0</b> · 23 d’octubre del 2026',
  'nov.0-5-0.texto': 'Calistènia i cardio, fàcils de trobar: a Rutina → Exercicis hi ha dos filtres nous, i si cerques «calistènia» o «cardio» també els trobes. Les dominades, els fons, les anelles i el TRX s’apunten per repeticions, sense demanar-te quilos. L’hora d’entrenament es pot posar a qualsevol hora, també de nit i de matinada. I la llicència canvia: pots fer servir, copiar i canviar JowyFit dient qui l’ha fet, però no vendre-la.',
  'nov.0-4-1.cab': '<b>Versió 0.4.1</b> · 23 d’octubre del 2026',
  'nov.0-4-1.texto': 'L’informe en PDF, més clar i amb els colors de l’app. La pàgina i la demo, més fàcils de llegir i d’utilitzar amb el teclat. Arranjaments: el % de greix surt igual a Inici, Metes i l’informe, i els avisos de suplements surten en el teu idioma. Per dins, l’app està ordenada per créixer sense errors.',
  'nov.0-4-0.cab': '<b>Versió 0.4.0</b> · 22 d’octubre del 2026',
  'nov.0-4-0.texto': "L’app, en tres idiomes: castellà, català i anglès. Per defecte continua en castellà; canvia-ho a Configuració → Aparença → Idioma. Dates, hores, números i els exercicis (en anglès) surten en el teu idioma.",
  'nov.0-3-0.cab': '<b>Versió 0.3.0</b> · 21 d’octubre del 2026',
  'nov.0-3-0.texto': "Tutorial dins de l’app: la primera vegada t’ofereix un passeig pel més important, i el tens sempre a Configuració. A l’iPhone explica el que allà es fa d’una altra manera. I en aquesta pàgina, una demo d’un minut.",
  'nov.0-2-1.cab': '<b>Versió 0.2.1</b> · 21 d’octubre del 2026',
  'nov.0-2-1.texto': "Aspecte nou: icona nova i l’app passa del taronja al morat. L’informe en PDF estrena un disseny més net, amb el mateix morat.",
  'nov.0-2-0.cab': '<b>Versió 0.2.0</b> · 21 d’octubre del 2026',
  'nov.0-2-0.texto': "Informe en PDF: tria els dies i què inclou (entrenaments, esforç de cada exercici, rècords, menjar, cos i passos) i guarda’l o envia’l. Les còpies de seguretat es revisen abans de recuperar-les, i l’app ja funciona a l’iPhone des de Safari.",
  'nov.0-1-6.cab': '<b>Versió 0.1.6</b> · 20 d’octubre del 2026',
  'nov.0-1-6.texto': "Repàs complet de l’app i 20 errors arreglats: tornar a l’entrenament després de l’última sèrie, els avisos del descans, la pantalla encesa a l’iPhone i corregir les sèries d’un entrenament ja guardat. «Esborrar-ho tot» demana confirmar-ho dues vegades.",
  'nov.0-1-5.cab': '<b>Versió 0.1.5</b> · 19 d’octubre del 2026',
  'nov.0-1-5.texto': 'A Inici veus les calories que gastes en repòs i entrenant. I «Saltar aquest exercici» és a la vista.',
  'nov.0-1-4.cab': '<b>Versió 0.1.4</b> · 18 d’octubre del 2026',
  'nov.0-1-4.texto': 'Connectar el rellotge i la bàscula és més fàcil: un sol botó a Configuració (Android).',
  'nov.0-1-3.cab': '<b>Versió 0.1.3</b> · 18 d’octubre del 2026',
  'nov.0-1-3.texto': 'El pes i el greix de la bàscula arriben sols (Android).',
  'nov.0-1-2.cab': '<b>Versió 0.1.2</b> · 17 d’octubre del 2026',
  'nov.0-1-2.texto': 'En apuntar el que menges tries Poc, Normal o Molt. Els suplements porten la seva quantitat i el batut suma la seva proteïna.',
  'nov.0-1-1.cab': '<b>Versió 0.1.1</b> · 17 d’octubre del 2026',
  'nov.0-1-1.texto': 'Racions més lògiques, més dades dels productes escanejats, i el botó enrere pregunta abans de deixar un entrenament.',
  'nov.0-1-0.cab': '<b>Versió 0.1.0</b> · 15 d’octubre del 2026',
  'nov.0-1-0.texto': 'La primera versió: rutina, entrenament, menjar i progrés.',

  // Cierre
  'cierre.titulo': 'Comença suau. Sigues constant.',
  'cierre.iphone': "A l’iPhone i l’iPad, obre-la a Safari i deixa-la a la pantalla d’inici.",

  // Pie
  'pie.enlaces': "<b translate=\"no\">JowyFit</b> · Gratis i amb el codi a la vista · <a href=\"#novedades\" data-abrir=\"d-novedades\">Novetats</a> · <a href=\"privacypolicy.html\">Política de privadesa</a> (en castellà)",
  'pie.creditos': 'Crèdits: els exercicis i els seus dibuixos són de RepDB; els aliments, d’Open Food Facts. Icones Phosphor i lletra Barlow. <span data-version-corta=""></span> · Llicència PolyForm Noncommercial · <a href="https://github.com/Jowy05/JowyFit/tree/prod">Codi</a>',

  // Barra fija del móvil
  // Landing «Historias»: cabecera, hora grande del hero, historias del móvil, tu plan y los ceros de privacidad.
  'cab.secciones': "Seccions",
  'cab.instalar': "Com s’instal·la",
  'cab.privacidad': "Privadesa",
  'cab.preguntas': "Preguntes",
  'hora.0': "Dimarts. La teva rutina ja és a punt.",
  'hora.1': "Apuntes la sèrie amb dos tocs.",
  'hora.2': "Descans. T’avisa quan s’acaba.",
  'hero.tienes-iphone': "Tens iPhone?",
  'historias.aria': "El que fa per tu, en set històries",
  'historias.1': "Història 1 de 7",
  'historias.2': "Història 2 de 7",
  'historias.3': "Història 3 de 7",
  'historias.4': "Història 4 de 7",
  'historias.5': "Història 5 de 7",
  'historias.6': "Història 6 de 7",
  'historias.7': "Història 7 de 7",
  'historias.saltar': "Saltar les històries",
  'historias.seguir': "Continuar",
  'historias.toques.titulo': "Ho apuntes en dos tocs.",
  'historias.toques.texto': "Toques «Fet» o «Igual que l’anterior». Si et surt fàcil, la pròxima vegada t’hi posa una mica més.",
  'historias.toques.alt': "Una sèrie d’esquat: l’última vegada 20 kg × 6; avui, 20 kg, amb els botons Ocupada i Fet.",
  'historias.descanso.titulo': "El descans t’avisa.",
  'historias.descanso.iphone': "Un compte enrere entre sèries. En acabar se sent un bip i la pantalla parpelleja: deixa-la oberta.",
  'historias.descanso.alt': "El descans entre sèries: queden 2:29 i el següent és la sèrie 2, 20 kg × 6-10.",
  'historias.ocupado.texto': "Toca «Ocupada» i et proposa un altre exercici que treballa el mateix, amb el pes ja posat.",
  'historias.comida.texto': "Apunta amb <strong>Poc</strong>, <strong>Normal</strong> o <strong>Molt</strong>. Primer veus la proteïna. I si té codi de barres, l’escaneges.",
  'historias.cuerpo.texto': "Pes, cintura i greix, amb la mitjana de cada setmana: el pes d’un sol dia enganya.",
  'plan.aria': "Quins dies hi vas? Toca per marcar o treure",
  'plan.menos': "Menys temps",
  'plan.mas': "Més temps",
  'plan.salida': "<b>{dias}</b>: {n}, {min} min cada dia. La rutina es fa sola.",
  'plan.n.uno': "1 dia",
  'plan.n.varios': "{n} dies",
  'plan.vacio': "Toca almenys un dia.",
  'seis.ejercicios': "exercicis.",
  'seis.texto': "Cadascun amb el seu dibuix, també de calistènia i cardio. Li dius què hi ha al teu gimnàs i tria entre ells.",
  'privacidad.cero.cuentas': "<span class=\"oculto\">Zero </span>comptes per crear",
  'privacidad.cero.anuncios': "<span class=\"oculto\">Zero </span>anuncis",
  'privacidad.cero.nube': "<span class=\"oculto\">Zero </span>dades al núvol",
  'privacidad.cero.cookies': "<span class=\"oculto\">Zero </span>galetes en aquesta pàgina",
  'barra.descargar': 'Baixar gratis',
}

export default ca
