// Textos de la demo en catalán (normativa del IEC, variante central; de tú). Mismas claves que es.ts:
// TypeScript avisa si falta alguna. Glosario y avisos: README, «Idiomas».
import type es from './es'

const ca: Record<keyof typeof es, string> = {
  // Página: título y descripción
  'demo.meta.descripcion': 'Demo de JowyFit: la teva rutina, l’entrenament, el menjar i com vas, amb captures de l’app de veritat.',
  'demo.meta.titulo': 'JowyFit · Així funciona l’app',

  // Cabecera
  'demo.cab.volver': 'Tornar a la pàgina',

  // Selector de idioma (el nombre de cada idioma no se traduce: va en su propio idioma)
  'idioma.boton': '{codigo} · Idioma: {nombre}',

  // Presentación (encima del móvil, en el ordenador)
  'demo.intro.titulillo': 'Demo · captures de l’app de veritat',
  'demo.intro.titulo': 'Així funciona JowyFit',
  'demo.intro.plataforma': 'Quin mòbil tens',

  // Tarjeta: botones y contador de pasos
  'demo.control.atras': 'Pas anterior',
  'demo.control.sigue': 'Pas següent',
  'demo.control.teclas': 'Espai per fer una pausa · fletxes per anar i tornar',
  'demo.control.n': '{n} de {total}',
  'demo.control.barra': 'Anar al pas {n}: {titulo}',
  'demo.control.pausar': 'Pausa',
  'demo.control.seguir': 'Continuar',

  // Enlace para ver la demo del otro móvil
  'demo.cambiar.iphone': 'Tens iPhone? Veure’n la demo',
  'demo.cambiar.android': 'Tens Android? Veure’n la demo',

  // Capítulos (encima del título de cada paso)
  'demo.capitulo.antes': 'Abans de començar',
  'demo.capitulo.inicio': 'Inici',
  'demo.capitulo.entreno': 'Entrenament',
  'demo.capitulo.comida': 'Menjar',
  'demo.capitulo.progreso': 'Progrés',
  'demo.capitulo.iphone': 'A l’iPhone',

  // Pasos: título (máx. 34 letras) y texto (máx. 125 letras) de cada uno; la captura sigue en castellano
  'demo.paso.compartir.titulo': 'Posa-la a la pantalla d’inici',
  'demo.paso.compartir.texto': 'A l’iPhone es fa servir des de Safari, sense baixar res. Toca el botó Comparteix…',
  'demo.paso.anadir.titulo': '…i «Afegeix a la pantalla d’inici»',
  'demo.paso.anadir.texto': 'Així s’obre com una app, a pantalla completa, i funciona sense internet.',
  'demo.paso.semana.titulo': 'La setmana d’un cop d’ull',
  'demo.paso.semana.texto': 'Cada dia et diu si toca entrenar, si ja està fet o si se t’ha passat.',
  'demo.paso.rutina.titulo': 'La rutina, feta per a tu',
  'demo.paso.rutina.texto': 'Amb els teus dies, el teu temps i el teu gimnàs. Cada dia saps què toca i quant dura.',
  'demo.paso.empezar.titulo': 'Un toc i a entrenar',
  'demo.paso.empezar.texto': 'Comences la sessió normal, o la versió curta si vas amb pressa.',
  'demo.paso.peso.titulo': 'Et diu quin pes posar',
  'demo.paso.peso.texto': 'El pes i les repeticions ja surten posats: apuntes cada sèrie en dos tocs.',
  'demo.paso.esfuerzo.titulo': 'Quant t’ha costat?',
  'demo.paso.esfuerzo.texto': 'Amb això l’app apuja o manté el pes la pròxima vegada. Sense fer comptes.',
  'demo.paso.descanso.titulo': 'Descansa el just',
  'demo.paso.descanso.texto.android': 'Compte enrere del descans, amb avís en acabar encara que el mòbil estigui bloquejat. També al rellotge.',
  'demo.paso.descanso.texto.apple': 'Compte enrere del descans. En acabar se sent un bip i la pantalla parpelleja: deixa-la oberta.',
  'demo.paso.ocupado.titulo': 'Màquina ocupada?',
  'demo.paso.ocupado.texto': 'Et proposa una altra que treballa el mateix i continues sense perdre temps.',
  'demo.paso.comida.titulo': 'Apunta el menjar sense pesar-lo',
  'demo.paso.comida.texto': 'Escrius què has menjat i tries Poc, Normal o Molt. No cal ser exacte.',
  'demo.paso.escanear.titulo': 'O escaneja el codi',
  'demo.paso.escanear.texto': 'Amb la càmera del mòbil: calories i proteïna del producte a l’instant.',
  'demo.paso.proteina.titulo': 'La proteïna del dia',
  'demo.paso.proteina.texto': 'El que més compta per guanyar múscul, i quanta te’n falta avui.',
  'demo.paso.pendientes.titulo': 'Els teus pendents d’avui',
  'demo.paso.pendientes.texto': 'A l’iPhone no hi ha recordatoris: aquí veus el que et queda, com pesar-te o apuntar els passos.',
  'demo.paso.pasos.titulo': 'Els passos, a mà',
  'demo.paso.pasos.texto': 'Mira els teus passos a l’app Salut i apunta’ls aquí en un moment.',
  'demo.paso.voy-bien.titulo': 'Vaig bé?',
  'demo.paso.voy-bien.texto': 'Cada diumenge, la teva setmana en un semàfor: entrenaments, proteïna, passos i cintura.',
  'demo.paso.fuerza.titulo': 'Els teus pesos, pujant',
  'demo.paso.fuerza.texto': 'Cada vegada que apuges el pes, queda apuntat: veus quant més aixeques que fa un mes.',
  'demo.paso.copia.titulo': 'Fes còpies de seguretat',
  'demo.paso.copia.texto': 'Les teves dades només són al mòbil: guarda la còpia amb Comparteix, a Fitxers o a iCloud.',

  // Final
  'demo.final.titulo': 'Les dades, només al teu mòbil.',
  'demo.final.texto': 'Gratis, sense comptes i sense anuncis. Comença suau i sigues constant.',
  'demo.final.descargar': 'Baixar l’app gratis',
  'demo.final.abrir': 'Obrir JowyFit gratis',
  'demo.final.otra': 'Tornar-la a veure',
}

export default ca
