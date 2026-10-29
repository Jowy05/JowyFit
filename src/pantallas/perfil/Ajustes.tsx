// AJU-01 · Ajustes. Arriba lo de todo el mundo (letra, tema, recordatorios, tu rutina y tu salud, informe en PDF, copia);
// lo técnico (entreno, comida, pasos, permisos) plegado en «Más ajustes»; «Borrar todo», al final.
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
// Solo la versión: con el import entero, todo package.json (scripts y dependencias) acababa en la web.
import { version } from '../../../package.json'
import { guardarAjustes, guardarPerfil, leerPerfil } from '../../datos/repos'
import { regenerarRutina } from '../../datos/acciones/rutina'
import { guardarAvisos, reprogramarNotificaciones } from '../../datos/acciones/avisos'
import { objetivosEnergia } from '../../datos/consultas'
import type { Ajustes as TAjustes } from '../../datos/tipos'
import { useCatalogo } from '../../catalogo/catalogo'
import { duracion, hoyISO } from '../../dominio/fechas'
import { miles, num } from '../../dominio/formato'
import { capacidades, permisoNotificaciones } from '../../plataforma'
import { cx, Cab, Elegir, FilaInterruptor, Ico, Interruptor, Pantalla, Stepper, useUnaVez } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useAjustes, useGimnasio, usePerfil, useRutina } from '../../datos/hooks'
import { guardarLetra, guardarTema, letraGuardada, temaGuardado, type Letra, type PreferenciaTema } from '../../ui/tema'
import { lanzarTutorial } from '../../ui/tutorial/Tutorial'
import { abrirInstrucciones } from '../instalar/Instalar'
import { diasTxt } from './textos'
import { CopiaDeSeguridad } from './AjustesCopias'
import { PasosYBascula, RelojYBascula, useSalud } from './AjustesSalud'
import { IDIOMAS, idioma, ponerIdioma, t, tn } from '../../i18n'
import { tr } from '../../i18n/jsx'

type Noti = TAjustes['noti']

export function Ajustes({ ruta }: { ruta: Ruta<'ajustes'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const a = useAjustes()
  const p = usePerfil()
  const gym = useGimnasio()
  const hayRutina = !!useRutina()
  const catalogo = useCatalogo()
  // Qué hace este aparato. En la web de Apple (iPhone, iPad, Mac) no se enseña nada que allí no funcione.
  const cap = capacidades()
  const salud = useSalud()
  const refDatos = useRef<HTMLParagraphElement>(null)
  const refComida = useRef<HTMLParagraphElement>(null)

  const [tema, setTema] = useState<PreferenciaTema>(temaGuardado())
  const [letra, setLetra] = useState<Letra>(letraGuardada())
  const [permNoti, setPermNoti] = useState(false)
  // «Más ajustes» se abre solo si venimos a tocar algo de dentro (p. ej. el objetivo manual de comida).
  const [masAbierto, setMasAbierto] = useState(ruta.d?.seccion === 'comida')

  const auto = useLiveQuery(async () => {
    const perfil = await leerPerfil()
    return perfil ? objetivosEnergia(perfil) : undefined
  }, [])

  useEffect(() => { void permisoNotificaciones(false).then(setPermNoti) }, [])

  // Desde el aviso de Inicio («haz una copia») se abre directamente en «Datos y copias»;
  // desde «Tu objetivo de energía» («cambiar a objetivo manual»), en «Comida».
  useEffect(() => {
    const destino = ruta.d?.seccion === 'datos' ? refDatos : ruta.d?.seccion === 'comida' ? refComida : null
    if (!destino) return
    if (ruta.d?.seccion === 'comida') setMasAbierto(true)
    const temporizador = window.setTimeout(() => destino.current?.scrollIntoView({ block: 'start' }), 80)
    return () => window.clearTimeout(temporizador)
  }, [ruta.d?.seccion])

  const guardar = (c: Partial<TAjustes>) => { void guardarAjustes(c) }

  const cambiarTema = (x: PreferenciaTema) => { guardarTema(x); setTema(x) }
  const cambiarLetra = (l: Letra) => {
    guardarLetra(l)
    setLetra(l)
    window.dispatchEvent(new Event('jf-letra'))
  }

  const manual = a.kcalManual != null || a.proteinaManual != null
  const ponerManual = (m: 'auto' | 'manual') => {
    if (m === 'auto') { guardar({ kcalManual: null, proteinaManual: null }); aviso(t('Objetivo automático')); return }
    guardar({ kcalManual: a.kcalManual ?? auto?.kcal ?? 2000, proteinaManual: a.proteinaManual ?? auto?.proteina ?? 140 })
  }

  const cambiarNoti = async (c: Partial<Noti>) => {
    const activa = Object.values(c).some(v => v === true)
    if (activa && !permNoti) {
      const ok = await permisoNotificaciones(true)
      setPermNoti(ok)
      if (!ok) aviso(t('Sin permiso: actívalo en los ajustes del móvil para recibir avisos'))
    }
    await guardarAvisos(c)
  }
  const activarNoti = async () => {
    const ok = await permisoNotificaciones(true)
    setPermNoti(ok)
    if (ok) { await reprogramarNotificaciones(); aviso(t('Notificaciones activadas')) }
    else aviso(t('Actívalas en los ajustes del móvil'))
  }

  const borrarTodo = () => nav.hoja('hoja-confirmar', { titulo: t('¿Borrar todos los datos?'), texto: t('Se borra todo lo que hay en este móvil. Haz antes una copia.'), si: t('Borrar todo'), peligro: true, accion: 'borrar-todo' })

  // El modo mayor se enciende aquí sin preguntar (rehace la rutina); para apagarlo, la hoja pide confirmar.
  const unaVez = useUnaVez()
  const cambiarModoMayor = unaVez(async (activo: boolean) => {
    if (!activo) { nav.hoja('hoja-modo-mayor', { quitar: true }); return }
    await guardarPerfil({ modoMayor: { activo: true, propuesto: p.modoMayor?.propuesto ?? hoyISO() } })
    if (hayRutina) await regenerarRutina()
    aviso(hayRutina ? t('Modo mayor activado: rutina rehecha') : t('Modo mayor activado'))
  })

  const pesarseTxt = p.diasPesaje.length ? t('{dias} a las', { dias: diasTxt(p.diasPesaje) }) : t('A las')

  return (
    <Pantalla>
      <Cab atras crumb={t('Perfil')} titulo={t('Ajustes')} />
      <div className="pg">
        {/* Apariencia, lo primero: para leer bien todo lo demás. */}
        <p className="grp-t">{t('Apariencia')}</p>
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

        {!cap.apple && <p className="grp-t">{t('Recordatorios')}</p>}
        {cap.apple ? null : cap.recordatorios ? (
          <div className="list">
            <FilaInterruptor titulo={t('Una hora antes de dormir')} d={t('Te dice qué entrenas mañana · te acuestas a las {hora}', { hora: p.horaDormir.replace(/^0/, '') })} on={a.noti.dormir} onCambio={v => void cambiarNoti({ dormir: v })} />
            <FilaHora titulo={t('Pesarse')} d={pesarseTxt} on={a.noti.pesarse} hora={a.noti.pesarseHora} c={v => void cambiarNoti({ pesarse: v })} h={v => void cambiarNoti({ pesarseHora: v })} />
            <FilaHora titulo={t('Batido de proteína')} d={t('Cada día a las')} on={a.noti.batido} hora={a.noti.batidoHora} c={v => void cambiarNoti({ batido: v })} h={v => void cambiarNoti({ batidoHora: v })} />
            <FilaHora titulo={t('Creatina')} d={t('Cada día a las')} on={a.noti.creatina} hora={a.noti.creatinaHora} c={v => void cambiarNoti({ creatina: v })} h={v => void cambiarNoti({ creatinaHora: v })} />
            <FilaInterruptor titulo={t('Copia de seguridad')} d={t('Si hace una semana de la última')} on={a.noti.copia} onCambio={v => void cambiarNoti({ copia: v })} />
            <FilaInterruptor titulo={t('Foto de progreso')} d={p.fotosCadaSemanas > 0 ? tn(p.fotosCadaSemanas, 'Cada {n} semana', 'Cada {n} semanas') : t('Opcional')} on={a.noti.fotos} onCambio={v => void cambiarNoti({ fotos: v })} />
            <FilaInterruptor titulo={t('Resumen del domingo')} d={t('¿Voy bien? Tu semana en 10 segundos')} on={a.noti.domingo} onCambio={v => void cambiarNoti({ domingo: v })} />
            <FilaHora titulo={t('Revisión de la semana')} d={t('Los domingos a las')} on={!!a.noti.revision} hora={a.noti.revisionHora ?? '19:00'} c={v => void cambiarNoti({ revision: v })} h={v => void cambiarNoti({ revisionHora: v })} />
          </div>
        ) : (
          <p className="note plain"><Ico n="device-mobile" /><span>{tr('<b>Solo en la app de Android:</b> los recordatorios se ven dentro de la app.', { b: x => <b>{x}</b> })}</span></p>
        )}

        {/* Reloj y báscula (Health Connect), a la vista. */}
        <RelojYBascula salud={salud} />

        {/* Apple: cómo tenerla en la pantalla de inicio (las instrucciones del arranque, otra vez). */}
        {cap.instalar && (
          <>
            <p className="grp-t">{cap.instalar === 'dock' ? t('App en el Dock') : t('App en la pantalla de inicio')}</p>
            <div className="list" data-tour="instalar">
              <button className="it" onClick={abrirInstrucciones}>
                <span className="ico"><Ico n={cap.instalar === 'dock' ? 'desktop' : 'device-mobile'} /></span>
                <span className="tx"><b>{cap.instalar === 'dock' ? t('Cómo ponerla en el Dock') : t('Cómo ponerla en la pantalla de inicio')}</b><small>{cap.instalada ? t('Ya la tienes instalada · ver los pasos') : t('Se abre como una app, a pantalla completa y sin internet')}</small></span>
                <Ico n="caret-right" className="car" />
              </button>
            </div>
          </>
        )}

        <p className="grp-t">{t('Tu rutina y tu salud')}</p>
        <div className="list">
          <button className="it" onClick={() => nav.ir('revision')}>
            <span className="ico"><Ico n="bandaids" /></span>
            <span className="tx"><b>{t('Revisión de la semana')}</b><small>{t('Cómo van tus molestias y qué cambia en los próximos entrenos')}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
          <button className="it" onClick={() => nav.hoja('hoja-no-quiero')}>
            <span className="ico"><Ico n="prohibit" /></span>
            <span className="tx"><b>{t('Lo que no quieres hacer')}</b><small>{p.noQuiero?.length ? t('{n} fuera de tu rutina', { n: p.noQuiero.length }) : t('Nada: puede salir de todo')}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
          <FilaInterruptor ico="armchair" titulo={t('Modo mayor')} d={t('Máquinas y apoyo, margen de 2 repeticiones y equilibrio')} on={!!p.modoMayor?.activo} onCambio={v => void cambiarModoMayor(v)} />
        </div>

        {/* Informe en PDF arriba, junto a la copia: aquí se busca para enseñar o guardar los datos. */}
        <p className="grp-t">{t('Informe en PDF')}</p>
        <div className="list" data-tour="informe">
          <button className="it" onClick={() => nav.hoja('hoja-informe')}>
            <span className="ico"><Ico n="file-pdf" /></span>
            <span className="tx"><b>{t('Informe en PDF')}</b><small>{t('Tus entrenos, tu comida y tu cuerpo en un PDF para guardar o enseñar')}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
        </div>

        <p className="grp-t">{t('Ayuda')}</p>
        <div className="list" data-tour="tutorial">
          <button className="it" onClick={lanzarTutorial}>
            <span className="ico"><Ico n="hand-pointing" /></span>
            <span className="tx"><b>{t('Ver el tutorial')}</b><small>{t('Un paseo rápido por la app: qué hace cada pantalla')}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
        </div>

        <CopiaDeSeguridad refTitulo={refDatos} />

        {/* Más ajustes: lo técnico, plegado (los valores por defecto ya sirven). */}
        <details className="fold mt24 aju-mas" open={masAbierto} onToggle={e => setMasAbierto(e.currentTarget.open)}>
          <summary><Ico n="sliders-horizontal" className="blue" /><span className="tx"><b>{t('Más ajustes')}</b><small>{t('Entreno, comida, pasos y permisos')}</small></span><Ico n="caret-down" /></summary>
          <div className="in">
            <p className="grp-t">{t('Entreno')}</p>
            <div className="list">
              {/* Sin vibración (iPhone): no se ofrece; al acabar el descanso destella la pantalla. */}
              {cap.vibracion && <FilaInterruptor titulo={t('Vibrar al acabar el descanso')} on={a.vibrar} onCambio={v => guardar({ vibrar: v })} />}
              <FilaInterruptor titulo={t('Sonido al acabar el descanso')} on={a.sonido} onCambio={v => guardar({ sonido: v })} />
              <FilaInterruptor titulo={t('Pantalla siempre encendida')} d={t('Durante el entreno')} on={a.pantallaEncendida} onCambio={v => guardar({ pantallaEncendida: v })} />
              <div className="it col">
                <span className="tx"><b>{t('Descanso entre series')}</b><small>{t('Ejercicios grandes {grandes} · pequeños {pequenos} · se usa al crear la rutina', { grandes: duracion(a.descansoCompuesto), pequenos: duracion(a.descansoAislamiento) })}</small></span>
                <div className="grid2">
                  <div><span className="lbl fl">{t('Grandes')}</span><Stepper className="sm" valor={a.descansoCompuesto} paso={15} min={30} max={600} sufijo="s" etiqueta={t('Descanso de compuestos')} onCambio={v => guardar({ descansoCompuesto: v })} /></div>
                  <div><span className="lbl fl">{t('Pequeños')}</span><Stepper className="sm" valor={a.descansoAislamiento} paso={15} min={15} max={600} sufijo="s" etiqueta={t('Descanso de aislamiento')} onCambio={v => guardar({ descansoAislamiento: v })} /></div>
                </div>
                <small className="small muted">{t('Grandes: sentadilla, press, remo… Pequeños: bíceps, gemelos…')}</small>
              </div>
              <FilaInterruptor titulo={t('Calentamiento sugerido')} d={t('Unas series ligeras antes de las pesadas')} on={a.calentamiento} onCambio={v => guardar({ calentamiento: v })} />
              <FilaInterruptor titulo={t('Avisos de seguridad')} d={t('En banca y sentadilla con barra')} on={a.avisosSeguridad} onCambio={v => guardar({ avisosSeguridad: v })} />
            </div>

            <p className="grp-t" ref={refComida}>{t('Comida')}</p>
            <div className="list">
              <FilaInterruptor titulo={t('Mostrar calorías')} d={t('La proteína se ve siempre')} on={a.mostrarKcal} onCambio={v => guardar({ mostrarKcal: v })} />
              <div className="it col">
                <span className="tx"><b>{t('Objetivo del día')}</b><small>{manual ? t('Lo pones tú') : auto ? t('Automático: {kcal} kcal · {proteina} g de proteína', { kcal: num(auto.kcal, 0), proteina: auto.proteina }) : t('Lo calcula la app con tu peso y tu actividad')}</small></span>
                <Elegir eq className="w100" opciones={[{ v: 'auto' as const, t: t('Automático') }, { v: 'manual' as const, t: t('Lo pongo yo') }]} valor={manual ? 'manual' : 'auto'} onCambio={ponerManual} />
                {manual && (
                  <>
                    <div className="grid2">
                      <div><span className="lbl fl">{t('Calorías')}</span><Stepper className="sm" valor={a.kcalManual} paso={50} min={1000} max={5000} etiqueta={t('Kcal al día')} onCambio={v => guardar({ kcalManual: v })} /></div>
                      <div><span className="lbl fl">{t('Proteína')}</span><Stepper className="sm" valor={a.proteinaManual} paso={5} min={40} max={300} sufijo="g" etiqueta={t('Proteína al día')} onCambio={v => guardar({ proteinaManual: v })} /></div>
                    </div>
                    <button className="btn ln sm" onClick={() => ponerManual('auto')}><Ico n="arrow-counter-clockwise" b />{t('Volver a automático')}</button>
                  </>
                )}
              </div>
              <div className="it col">
                <span className="tx"><b>{t('Límite de cafeína')}</b><small>{t('Cuánta al día y desde qué hora te avisamos')}</small></span>
                <div className="grid2">
                  <div><span className="lbl fl">{t('Máximo al día')}</span><Stepper className="sm" valor={a.cafeinaLimite} paso={50} min={0} max={1000} sufijo="mg" etiqueta={t('Límite de cafeína')} onCambio={v => guardar({ cafeinaLimite: v })} /></div>
                  <label><span className="lbl fl">{t('Hora tope')}</span><input className="inp" type="time" value={a.cafeinaHoraTope} onChange={e => { if (e.target.value) guardar({ cafeinaHoraTope: e.target.value }) }} /></label>
                </div>
                <small className="small muted">{t('Un café son unos 80 mg.')}</small>
              </div>
            </div>

            <PasosYBascula salud={salud} />

            <p className="grp-t">{t('Gimnasios y permisos')}</p>
            <div className="list">
              <button className="it" onClick={() => nav.ir('gimnasios', undefined, 'rut')}>
                <span className="ico"><Ico n="map-pin" /></span>
                <span className="tx"><b>{t('Gimnasios')}</b><small>{gym ? t('{nombre} · activo', { nombre: gym.nombre }) : t('Ninguno todavía')}</small></span>
                <Ico n="caret-right" className="car" />
              </button>
              {!cap.apple && <Permiso ico="bell" titulo={t('Notificaciones')} d={cap.recordatorios ? undefined : t('Solo en la app de Android')}
                estado={cap.recordatorios ? permNoti : null} onActivar={() => void activarNoti()} />}
              {!cap.apple && <Permiso ico="footprints" titulo="Health Connect" d={t('Para contar los pasos')} estado={salud.hayPasos ? a.fuentePasos === 'auto' : null} onActivar={() => void salud.activarPasos()} />}
              <div className="it">
                <span className="ico"><Ico n="camera" /></span>
                <span className="tx"><b>{t('Cámara')}</b><small>{cap.apple ? t('Safari la pide la primera vez que escaneas') : t('Se pide la primera vez que escaneas o haces una foto')}</small></span>
              </div>
            </div>
          </div>
        </details>

        <p className="grp-t">{t('Créditos y aviso legal')}</p>
        <div className="list">
          <button className="it" onClick={() => nav.ir('creditos')}>
            <span className="ico"><Ico n="info" /></span>
            <span className="tx"><b>{t('Créditos y aviso legal')}</b><small>{t('De dónde salen los ejercicios y los alimentos · no es consejo médico')}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
        </div>
        <p className="small muted mt8 center">{t('JowyFit {version} · {n} ejercicios', { version, n: catalogo ? miles(catalogo.ejercicios.length) : '—' })}</p>

        {/* Borrar todo: al final y aparte. */}
        <div className="list aju-borrar">
          <button className="it danger" onClick={borrarTodo}>
            <span className="ico"><Ico n="trash" /></span>
            <span className="tx"><b>{t('Borrar todos los datos')}</b><small>{t('Deja la app como recién instalada. Te lo pediremos confirmar')}</small></span>
          </button>
        </div>
      </div>
    </Pantalla>
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

/** Estado de un permiso: null = no disponible en este móvil. */
function Permiso({ ico, titulo, d, estado, onActivar }: { ico: string; titulo: string; d?: string; estado: boolean | null; onActivar: () => void }) {
  return (
    <div className="it">
      <span className="ico"><Ico n={ico} /></span>
      <span className="tx"><b>{titulo}</b>{d && <small>{d}</small>}</span>
      {estado === null ? <span className="tag">{t('No disponible')}</span>
        : estado ? <span className="tag ok"><Ico n="check" b />{t('Activado')}</span>
          : <button className="btn sm auto" onClick={onActivar}>{t('Activar')}</button>}
    </div>
  )
}
