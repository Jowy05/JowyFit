// AJU-01 · Ajustes: menú organizado por categorías claras y subpantallas enfocadas (sin muro de botones).
import { useEffect, useState, type ReactNode } from 'react'
// Solo la versión: con el import entero, todo package.json (scripts y dependencias) acababa en la web.
import { version } from '../../../package.json'
import { guardarPerfil } from '../../datos/repos'
import { regenerarRutina } from '../../datos/acciones/rutina'
import { guardarAvisos } from '../../datos/acciones/avisos'
import type { Ajustes as TAjustes } from '../../datos/tipos'
import { useCatalogo } from '../../catalogo/catalogo'
import { duracion, hoyISO } from '../../dominio/fechas'
import { miles } from '../../dominio/formato'
import { capacidades, permisoNotificaciones } from '../../plataforma'
import { cx, Cab, Elegir, FilaInterruptor, Ico, Interruptor, Pantalla, useUnaVez } from '../../ui/componentes'
import { useNav, type Ruta, type SeccionAjustes } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useAjustes, useGimnasio, usePerfil, useRutina } from '../../datos/hooks'
import { guardarLetra, guardarTema, letraGuardada, temaGuardado, type Letra, type PreferenciaTema } from '../../ui/tema'
import { lanzarTutorial } from '../../ui/tutorial/Tutorial'
import { abrirInstrucciones } from '../instalar/Instalar'
import { diasTxt } from './textos'
import { CopiaDeSeguridad } from './AjustesCopias'
import { cuando } from './CopiasGuardadas'
import { ConectividadAjustes, useSalud } from './AjustesSalud'
import { ComidaAjustes, EntrenoAjustes } from './AjustesEntrenoComida'
import { IDIOMAS, idioma, ponerIdioma, t, tk, tn } from '../../i18n'
import { tr } from '../../i18n/jsx'

type Noti = TAjustes['noti']

const TITULO_SECCION: Record<SeccionAjustes, string> = {
  apariencia: tk('Apariencia e idioma'),
  cuerpo: tk('Cuerpo y salud'),
  entreno: tk('Entreno y rutina'),
  comida: tk('Comida y nutrición'),
  conectividad: tk('Conectividad y permisos'),
  recordatorios: tk('Recordatorios'),
  datos: tk('Datos y copias'),
}

const TEMA_TXT: Record<PreferenciaTema, string> = {
  sistema: tk('Sistema'),
  claro: tk('Claro'),
  oscuro: tk('Oscuro'),
}

export function Ajustes({ ruta }: { ruta: Ruta<'ajustes'> }) {
  const seccion = ruta.d?.seccion
  const salud = useSalud()

  if (seccion) {
    const cuerpo: Record<SeccionAjustes, ReactNode> = {
      apariencia: <AparienciaAjustes />,
      cuerpo: <CuerpoYSaludAjustes />,
      entreno: <EntrenoAjustes />,
      comida: <ComidaAjustes />,
      conectividad: <ConectividadAjustes salud={salud} />,
      recordatorios: <RecordatoriosAjustes />,
      datos: <DatosYCopiasAjustes />,
    }
    return (
      <Pantalla>
        <Cab atras crumb={t('Ajustes')} titulo={t(TITULO_SECCION[seccion])} />
        <div className="pg">{cuerpo[seccion]}</div>
      </Pantalla>
    )
  }

  return <IndiceAjustes salud={salud} />
}

/** Pantalla principal de Ajustes: categorías claras con un resumen vivo de lo que tienes puesto. */
function IndiceAjustes({ salud }: { salud: ReturnType<typeof useSalud> }) {
  const nav = useNav()
  const a = useAjustes()
  const p = usePerfil()
  const gym = useGimnasio()
  const catalogo = useCatalogo()
  const cap = capacidades()
  const tema = temaGuardado()
  const letra = letraGuardada()
  const idiomaActual = IDIOMAS.find(x => x.v === idioma())?.nombre ?? 'Español'

  const resumenApariencia = `${t(TEMA_TXT[tema])} · ${letra === 'grande' ? t('Letra grande') : t('Letra normal')} · ${idiomaActual}`
  const resumenCuerpo = p.modoMayor?.activo
    ? t('Modo mayor activado · revisión semanal y salud')
    : t('Revisión semanal, salud, cuerpo y modo mayor')
  const resumenEntreno = [
    t('Descanso {grandes} / {pequenos}', { grandes: duracion(a.descansoCompuesto), pequenos: duracion(a.descansoAislamiento) }),
    gym?.nombre,
  ].filter(Boolean).join(' · ')
  const manualComida = a.kcalManual != null || a.proteinaManual != null
  const resumenComida = manualComida
    ? t('Objetivo manual · cafeína {n} mg', { n: a.cafeinaLimite })
    : t('Objetivo automático · cafeína {n} mg', { n: a.cafeinaLimite })

  const conectadoHC = a.fuentePasos === 'auto' || a.fuenteBascula === 'auto'
  const resumenConectividad = cap.apple
    ? t('Pasos a mano · trote y cámara')
    : cap.salud && salud.hayPasos
      ? (conectadoHC ? t('Health Connect conectado · pasos, báscula y permisos') : t('Health Connect, pasos, báscula y permisos'))
      : t('Pasos a mano · trote y permisos')

  const notiActivas = [a.noti.dormir, a.noti.pesarse, a.noti.batido, a.noti.creatina, a.noti.copia, a.noti.fotos, a.noti.domingo, !!a.noti.revision, !!a.noti.pasos].filter(Boolean).length
  const resumenRecordatorios = !cap.recordatorios
    ? t('Solo en la app de Android')
    : notiActivas > 0 ? tn(notiActivas, '{n} aviso activo', '{n} avisos activos') : t('Todos apagados')

  const resumenCopias = a.ultimaCopia
    ? t('Última copia: {cuando}', { cuando: cuando(new Date(a.ultimaCopia)) })
    : t('Aún no has hecho ninguna copia')

  return (
    <Pantalla>
      <Cab atras crumb={t('Perfil')} titulo={t('Ajustes')} />
      <div className="pg">
        <p className="grp-t">{t('Configuración')}</p>
        <div className="list">
          <button className="it" onClick={() => nav.ir('ajustes', { seccion: 'apariencia' })}>
            <span className="ico"><Ico n="palette" /></span>
            <span className="tx"><b>{t('Apariencia e idioma')}</b><small>{resumenApariencia}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
          <button className="it" onClick={() => nav.ir('ajustes', { seccion: 'cuerpo' })}>
            <span className="ico"><Ico n="heart-half" /></span>
            <span className="tx"><b>{t('Cuerpo y salud')}</b><small>{resumenCuerpo}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
          <button className="it" onClick={() => nav.ir('ajustes', { seccion: 'entreno' })}>
            <span className="ico"><Ico n="barbell" /></span>
            <span className="tx"><b>{t('Entreno y rutina')}</b><small>{resumenEntreno}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
          <button className="it" onClick={() => nav.ir('ajustes', { seccion: 'comida' })}>
            <span className="ico"><Ico n="fork-knife" /></span>
            <span className="tx"><b>{t('Comida y nutrición')}</b><small>{resumenComida}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
          <button className="it" data-tour={!cap.apple ? 'reloj' : undefined} onClick={() => nav.ir('ajustes', { seccion: 'conectividad' })}>
            <span className="ico"><Ico n="plugs-connected" /></span>
            <span className="tx"><b>{t('Conectividad y permisos')}</b><small>{resumenConectividad}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
          {!cap.apple && (
            <button className="it" onClick={() => nav.ir('ajustes', { seccion: 'recordatorios' })}>
              <span className="ico"><Ico n="bell" /></span>
              <span className="tx"><b>{t('Recordatorios')}</b><small>{resumenRecordatorios}</small></span>
              <Ico n="caret-right" className="car" />
            </button>
          )}
        </div>

        <p className="grp-t">{t('Datos e informe')}</p>
        <div className="list">
          <button className="it" data-tour="copia" onClick={() => nav.ir('ajustes', { seccion: 'datos' })}>
            <span className="ico"><Ico n="floppy-disk" /></span>
            <span className="tx"><b>{t('Datos y copias')}</b><small>{resumenCopias}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
          <button className="it" data-tour="informe" onClick={() => nav.hoja('hoja-informe')}>
            <span className="ico"><Ico n="file-pdf" /></span>
            <span className="tx"><b>{t('Informe en PDF')}</b><small>{t('Tus entrenos, tu comida y tu cuerpo en un PDF para guardar o enseñar')}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
        </div>

        <p className="grp-t">{t('Ayuda e información')}</p>
        <div className="list">
          {cap.instalar && (
            <button className="it" data-tour="instalar" onClick={abrirInstrucciones}>
              <span className="ico"><Ico n={cap.instalar === 'dock' ? 'desktop' : 'device-mobile'} /></span>
              <span className="tx"><b>{cap.instalar === 'dock' ? t('Cómo ponerla en el Dock') : t('Cómo ponerla en la pantalla de inicio')}</b><small>{cap.instalada ? t('Ya la tienes instalada · ver los pasos') : t('Se abre como una app, a pantalla completa y sin internet')}</small></span>
              <Ico n="caret-right" className="car" />
            </button>
          )}
          <button className="it" data-tour="tutorial" onClick={lanzarTutorial}>
            <span className="ico"><Ico n="hand-pointing" /></span>
            <span className="tx"><b>{t('Ver el tutorial')}</b><small>{t('Un paseo rápido por la app: qué hace cada pantalla')}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
          <button className="it" onClick={() => nav.hoja('hoja-actualizacion')}>
            <span className="ico"><Ico n="arrow-circle-down" /></span>
            <span className="tx"><b>{t('Buscar actualizaciones')}</b><small>{t('Versión {version} · comprueba si hay una más nueva', { version })}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
          <button className="it" onClick={() => nav.ir('creditos')}>
            <span className="ico"><Ico n="info" /></span>
            <span className="tx"><b>{t('Créditos y aviso legal')}</b><small>{t('De dónde salen los ejercicios y los alimentos · no es consejo médico')}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
        </div>

        <p className="small muted mt12 center">{t('JowyFit {version} · {n} ejercicios', { version, n: catalogo ? miles(catalogo.ejercicios.length) : '—' })}</p>
      </div>
    </Pantalla>
  )
}

/** Subpantalla: tamaño de letra, tema e idioma. */
function AparienciaAjustes() {
  const [tema, setTema] = useState<PreferenciaTema>(temaGuardado())
  const [letra, setLetra] = useState<Letra>(letraGuardada())
  const cambiarTema = (x: PreferenciaTema) => { guardarTema(x); setTema(x) }
  const cambiarLetra = (l: Letra) => {
    guardarLetra(l)
    setLetra(l)
    window.dispatchEvent(new Event('jf-letra'))
  }
  return (
    <div className="list">
      <div className="it col">
        <span className="tx"><b>{t('Tamaño de letra')}</b><small>{t('Grande: pensado para leer sin gafas')}</small></span>
        <Elegir eq className="w100" opciones={[{ v: 'normal' as Letra, t: t('Normal') }, { v: 'grande' as Letra, t: <><span className="aa">Aa</span>{t('Grande')}</> }]} valor={letra} onCambio={cambiarLetra} />
      </div>
      <div className="it col">
        <span className="tx"><b>{t('Tema')}</b><small>{t('Claro u oscuro. «Sistema» usa el del móvil')}</small></span>
        <div className="segc" role="radiogroup" aria-label={t('Tema')}>
          {([['sistema', t('Sistema')], ['claro', t('Claro')], ['oscuro', t('Oscuro')]] as const).map(([v, n]) => (
            <button key={v} role="radio" aria-checked={tema === v} className={cx(tema === v && 'on')} onClick={() => cambiarTema(v)}>{n}</button>
          ))}
        </div>
      </div>
      {/* Cada idioma con su nombre en su idioma (como en la landing). Al elegir otro, la app se vuelve a abrir. */}
      <div className="it col" data-idioma="">
        <span className="tx"><b>{t('Idioma')}</b><small>{t('Al cambiarlo, la app se vuelve a abrir')}</small></span>
        <div className="segc" role="radiogroup" aria-label={t('Idioma')}>
          {IDIOMAS.map(x => (
            <button key={x.v} role="radio" lang={x.v} aria-checked={idioma() === x.v} className={cx(idioma() === x.v && 'on')} onClick={() => { if (x.v !== idioma()) ponerIdioma(x.v) }}>{x.nombre}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Subpantalla: salud, revisión semanal, modo mayor y accesos rápidos a tu ficha corporal. */
function CuerpoYSaludAjustes() {
  const nav = useNav()
  const aviso = useAviso()
  const p = usePerfil()
  const hayRutina = !!useRutina()
  const unaVez = useUnaVez()

  const cambiarModoMayor = unaVez(async (activo: boolean) => {
    if (!activo) { nav.hoja('hoja-modo-mayor', { quitar: true }); return }
    await guardarPerfil({ modoMayor: { activo: true, propuesto: p.modoMayor?.propuesto ?? hoyISO() } })
    if (hayRutina) await regenerarRutina()
    aviso(hayRutina ? t('Modo mayor activado: rutina rehecha') : t('Modo mayor activado'))
  })

  return (
    <>
      <p className="grp-t">{t('Salud y rutina adaptada')}</p>
      <div className="list">
        <button className="it" onClick={() => nav.ir('revision')}>
          <span className="ico"><Ico n="bandaids" /></span>
          <span className="tx"><b>{t('Revisión de la semana')}</b><small>{t('Cómo van tus molestias y qué cambia en los próximos entrenos')}</small></span>
          <Ico n="caret-right" className="car" />
        </button>
        <FilaInterruptor ico="armchair" titulo={t('Modo mayor')} d={t('Máquinas y apoyo, margen de 2 repeticiones y equilibrio')} on={!!p.modoMayor?.activo} onCambio={v => void cambiarModoMayor(v)} />
      </div>

      <p className="grp-t">{t('Tu ficha corporal')}</p>
      <div className="list">
        <button className="it" onClick={() => nav.ir('seccion-perfil', { s: 'salud' })}>
          <span className="ico"><Ico n="first-aid" /></span>
          <span className="tx"><b>{t('Salud y molestias')}</b><small>{t('Señales de aviso, dolores y condiciones médicas')}</small></span>
          <Ico n="caret-right" className="car" />
        </button>
        <button className="it" onClick={() => nav.ir('seccion-perfil', { s: 'datos' })}>
          <span className="ico"><Ico n="user" /></span>
          <span className="tx"><b>{t('Datos personales')}</b><small>{t('Nombre, edad, sexo y altura')}</small></span>
          <Ico n="caret-right" className="car" />
        </button>
        <button className="it" onClick={() => nav.ir('seccion-perfil', { s: 'cuerpo' })}>
          <span className="ico"><Ico n="scales" /></span>
          <span className="tx"><b>{t('Peso y medidas')}</b><small>{t('Tus últimos registros y composición corporal')}</small></span>
          <Ico n="caret-right" className="car" />
        </button>
        <button className="it" onClick={() => nav.ir('seccion-perfil', { s: 'seguimiento' })}>
          <span className="ico"><Ico n="camera" /></span>
          <span className="tx"><b>{t('Pesarte y fotos')}</b><small>{t('Días de pesaje y frecuencia de fotos de progreso')}</small></span>
          <Ico n="caret-right" className="car" />
        </button>
        <button className="it" onClick={() => nav.ir('seccion-perfil', { s: 'sueno' })}>
          <span className="ico"><Ico n="moon" /></span>
          <span className="tx"><b>{t('Sueño')}</b><small>{t('Horas de sueño habituales para ajustar el esfuerzo')}</small></span>
          <Ico n="caret-right" className="car" />
        </button>
      </div>
    </>
  )
}

/** Subpantalla: recordatorios locales (Android). */
function RecordatoriosAjustes() {
  const aviso = useAviso()
  const a = useAjustes()
  const p = usePerfil()
  const cap = capacidades()
  const [permNoti, setPermNoti] = useState(false)

  useEffect(() => { void permisoNotificaciones(false).then(setPermNoti) }, [])

  const cambiarNoti = async (c: Partial<Noti>) => {
    const activa = Object.values(c).some(v => v === true)
    if (activa && !permNoti) {
      const ok = await permisoNotificaciones(true)
      setPermNoti(ok)
      if (!ok) aviso(t('Sin permiso: actívalo en los ajustes del móvil para recibir avisos'))
    }
    await guardarAvisos(c)
  }

  const pesarseTxt = p.diasPesaje.length ? t('{dias} a las', { dias: diasTxt(p.diasPesaje) }) : t('A las')

  if (!cap.recordatorios) {
    return <p className="note plain"><Ico n="device-mobile" /><span>{tr('<b>Solo en la app de Android:</b> los recordatorios se ven dentro de la app.', { b: x => <b>{x}</b> })}</span></p>
  }
  return (
    <div className="list">
      <FilaInterruptor titulo={t('Una hora antes de dormir')} d={t('Te dice qué entrenas mañana · te acuestas a las {hora}', { hora: p.horaDormir.replace(/^0/, '') })} on={a.noti.dormir} onCambio={v => void cambiarNoti({ dormir: v })} />
      <FilaHora titulo={t('Pesarse')} d={pesarseTxt} on={a.noti.pesarse} hora={a.noti.pesarseHora} c={v => void cambiarNoti({ pesarse: v })} h={v => void cambiarNoti({ pesarseHora: v })} />
      <FilaHora titulo={t('Batido de proteína')} d={t('Cada día a las')} on={a.noti.batido} hora={a.noti.batidoHora} c={v => void cambiarNoti({ batido: v })} h={v => void cambiarNoti({ batidoHora: v })} />
      <FilaHora titulo={t('Creatina')} d={t('Cada día a las')} on={a.noti.creatina} hora={a.noti.creatinaHora} c={v => void cambiarNoti({ creatina: v })} h={v => void cambiarNoti({ creatinaHora: v })} />
      <FilaInterruptor titulo={t('Copia de seguridad')} d={t('Si hace una semana de la última')} on={a.noti.copia} onCambio={v => void cambiarNoti({ copia: v })} />
      <FilaInterruptor titulo={t('Foto de progreso')} d={p.fotosCadaSemanas > 0 ? tn(p.fotosCadaSemanas, 'Cada {n} semana', 'Cada {n} semanas') : t('Opcional')} on={a.noti.fotos} onCambio={v => void cambiarNoti({ fotos: v })} />
      <FilaInterruptor titulo={t('Resumen del domingo')} d={t('¿Voy bien? Tu semana en 10 segundos')} on={a.noti.domingo} onCambio={v => void cambiarNoti({ domingo: v })} />
      <FilaHora titulo={t('Revisión de la semana')} d={t('Los domingos a las')} on={!!a.noti.revision} hora={a.noti.revisionHora ?? '19:00'} c={v => void cambiarNoti({ revision: v })} h={v => void cambiarNoti({ revisionHora: v })} />
      <FilaHora titulo={t('Recordatorio de pasos')} d={t('Si llevas menos del 50 % a las')} on={!!a.noti.pasos} hora={a.noti.pasosHora ?? '18:00'} c={v => void cambiarNoti({ pasos: v })} h={v => void cambiarNoti({ pasosHora: v })} />
    </div>
  )
}

/** Subpantalla: copias de seguridad, cifrado, copias guardadas y borrado completo al fondo. */
function DatosYCopiasAjustes() {
  const nav = useNav()
  const borrarTodo = () => nav.hoja('hoja-confirmar', { titulo: t('¿Borrar todos los datos?'), texto: t('Se borra todo lo que hay en este móvil. Haz antes una copia.'), si: t('Borrar todo'), peligro: true, accion: 'borrar-todo' })
  return (
    <>
      <CopiaDeSeguridad />
      <div className="list aju-borrar">
        <button className="it danger" onClick={borrarTodo}>
          <span className="ico"><Ico n="trash" /></span>
          <span className="tx"><b>{t('Borrar todos los datos')}</b><small>{t('Deja la app como recién instalada. Te lo pediremos confirmar')}</small></span>
        </button>
      </div>
    </>
  )
}

/** Aviso con hora editable: interruptor y, si está activo, la hora. */
function FilaHora({ titulo, d, on, hora, c, h }: { titulo: string; d: string; on: boolean; hora: string; c: (v: boolean) => void; h: (v: string) => void }) {
  return (
    <div className="it">
      <span className="tx">
        <b>{titulo}</b>
        <small>{d} {on ? '' : hora.replace(/^0/, '')}</small>
      </span>
      {on && <input className="inp" type="time" value={hora} aria-label={t('Hora de {que}', { que: titulo.toLowerCase() })} style={{ width: 104, minHeight: 40 }} onChange={e => { if (e.target.value) h(e.target.value) }} />}
      <Interruptor on={on} onCambio={c} etiqueta={titulo} />
    </div>
  )
}
