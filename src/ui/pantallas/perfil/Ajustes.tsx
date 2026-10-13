// AJU-01 · Ajustes: apariencia, entreno, comida, actividad, avisos, copias, permisos y acerca de.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import paquete from '../../../../package.json'
import { db } from '../../../datos/db'
import { guardarAjustes } from '../../../datos/repos'
import { importar, nombreCopia } from '../../../datos/copias'
import { objetivosEnergia } from '../../../datos/consultas'
import type { Ajustes as TAjustes } from '../../../datos/tipos'
import { useCatalogo } from '../../../catalogo/catalogo'
import { aISO, duracion, fechaCorta, horaDe } from '../../../dominio/fechas'
import { copiasGuardadas, elegirArchivo, esIPhone, esNativo, leerCopiaGuardada, pasosDisponibles, pedirPermisoPasos, permisoNotificaciones } from '../../../plataforma'
import { cx, Cab, Elegir, Ico, Interruptor, Pantalla, Stepper } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { useAjustes, useGimnasio, usePerfil } from '../../datos'
import { guardarLetra, guardarTema, letraGuardada, temaGuardado, type Letra, type PreferenciaTema } from '../../tema'
import { hacerCopiaAhora, reprogramarNotificaciones, sincronizarPasos } from '../../servicios'
import { diasTxt } from './textos'

type Noti = TAjustes['noti']
type Copia = { nombre: string; fecha: number; tam: number }

/** «13 oct, 20:15» a partir de una fecha ISO con hora. */
function cuando(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${fechaCorta(aISO(d))}, ${horaDe(d.getTime())}`
}

export function Ajustes({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const a = useAjustes()
  const p = usePerfil()
  const gym = useGimnasio()
  const catalogo = useCatalogo()
  const nativo = esNativo()
  const refDatos = useRef<HTMLParagraphElement>(null)

  const [tema, setTema] = useState<PreferenciaTema>(temaGuardado())
  const [letra, setLetra] = useState<Letra>(letraGuardada())
  const [hayPasos, setHayPasos] = useState(false)
  const [permNoti, setPermNoti] = useState(false)
  const [copias, setCopias] = useState<Copia[]>([])
  const [confirmar, setConfirmar] = useState<string | null>(null)
  const [archivo, setArchivo] = useState<{ nombre: string; bytes: Uint8Array } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const auto = useLiveQuery(async () => {
    const perfil = await db.perfil.get('yo')
    return perfil ? objetivosEnergia(perfil) : undefined
  }, [])

  const refrescarCopias = useCallback(() => { void copiasGuardadas().then(setCopias) }, [])

  useEffect(() => {
    void pasosDisponibles().then(setHayPasos)
    void permisoNotificaciones(false).then(setPermNoti)
    refrescarCopias()
  }, [refrescarCopias])

  // Desde el aviso de Inicio («haz una copia») se abre directamente en «Datos y copias».
  useEffect(() => {
    if (ruta.d?.seccion !== 'datos') return
    const t = window.setTimeout(() => refDatos.current?.scrollIntoView({ block: 'start' }), 80)
    return () => window.clearTimeout(t)
  }, [ruta.d?.seccion])

  const guardar = (c: Partial<TAjustes>) => { void guardarAjustes(c) }

  // ---------- apariencia ----------
  const cambiarTema = (t: PreferenciaTema) => { guardarTema(t); setTema(t) }
  const cambiarLetra = (l: Letra) => {
    guardarLetra(l)
    setLetra(l)
    window.dispatchEvent(new Event('jf-letra'))
  }

  // ---------- comida ----------
  const manual = a.kcalManual != null || a.proteinaManual != null
  const ponerManual = (m: 'auto' | 'manual') => {
    if (m === 'auto') { guardar({ kcalManual: null, proteinaManual: null }); aviso('Objetivo automático'); return }
    guardar({ kcalManual: a.kcalManual ?? auto?.kcal ?? 2000, proteinaManual: a.proteinaManual ?? auto?.proteina ?? 140 })
  }

  // ---------- pasos ----------
  const activarPasos = async () => {
    const ok = await pedirPermisoPasos()
    if (!ok) { aviso('Sin permiso de Health Connect: los pasos se apuntan a mano'); return }
    await guardarAjustes({ fuentePasos: 'auto' })
    const sincronizado = await sincronizarPasos()
    aviso(sincronizado ? 'Pasos conectados con Health Connect' : 'Health Connect activado')
  }
  const cambiarFuente = (f: 'auto' | 'manual') => {
    if (f === 'auto') void activarPasos()
    else guardar({ fuentePasos: 'manual' })
  }

  // ---------- notificaciones ----------
  const cambiarNoti = async (c: Partial<Noti>) => {
    const activa = Object.values(c).some(v => v === true)
    if (activa && !permNoti) {
      const ok = await permisoNotificaciones(true)
      setPermNoti(ok)
      if (!ok) aviso('Sin permiso: actívalo en los ajustes del móvil para recibir avisos')
    }
    await guardarAjustes({ noti: { ...a.noti, ...c } })
    await reprogramarNotificaciones()
  }
  const activarNoti = async () => {
    const ok = await permisoNotificaciones(true)
    setPermNoti(ok)
    if (ok) { await reprogramarNotificaciones(); aviso('Notificaciones activadas') }
    else aviso('Actívalas en los ajustes del móvil')
  }

  // ---------- copias ----------
  const copiaAhora = async () => {
    setOcupado(true)
    try {
      const nombre = nombreCopia()
      await hacerCopiaAhora()
      aviso(nativo ? `Copia guardada en Documentos/JowyFit: ${nombre}` : `Copia descargada: ${nombre}`)
      refrescarCopias()
    } catch (e) {
      aviso(`No se pudo hacer la copia: ${String((e as Error).message ?? e)}`)
    } finally { setOcupado(false) }
  }
  const restaurar = async (bytes: Uint8Array) => {
    setOcupado(true)
    try {
      const tipo = await importar(bytes)
      aviso(tipo === 'copia' ? 'Copia restaurada' : 'Datos del perfil importados')
      window.setTimeout(() => location.reload(), 700)
    } catch (e) {
      aviso(`No se pudo restaurar: ${String((e as Error).message ?? e)}`)
      setOcupado(false)
    }
  }
  const elegir = async () => {
    const f = await elegirArchivo()
    if (f) setArchivo(f)
  }
  const restaurarGuardada = async (nombre: string) => {
    if (confirmar !== nombre) { setConfirmar(nombre); return }
    setConfirmar(null)
    try { await restaurar(await leerCopiaGuardada(nombre)) }
    catch (e) { aviso(`No se pudo leer la copia: ${String((e as Error).message ?? e)}`) }
  }
  const borrarTodo = () => nav.hoja('sheet-confirmar', { titulo: '¿Borrar todos los datos?', texto: 'Se borra todo lo que hay en este móvil. Haz antes una copia.', si: 'Borrar todo', peligro: true, accion: 'borrar-todo' })

  const pesarseTxt = p.diasPesaje.length ? `${diasTxt(p.diasPesaje)} a las` : 'A las'

  return (
    <Pantalla>
      <Cab atras crumb="Perfil" titulo="Ajustes" />
      <div className="pg">
        {/* ---------- Apariencia ---------- */}
        <p className="grp-t">Apariencia</p>
        <div className="list">
          <div className="it col">
            <span className="tx"><b>Tema</b><small>Por defecto, el del sistema</small></span>
            <div className="segc" role="radiogroup" aria-label="Tema">
              {([['sistema', 'Sistema'], ['claro', 'Claro'], ['oscuro', 'Oscuro']] as const).map(([v, t]) => (
                <button key={v} role="radio" aria-checked={tema === v} className={cx(tema === v && 'on')} onClick={() => cambiarTema(v)}>{t}</button>
              ))}
            </div>
          </div>
          <div className="it col">
            <span className="tx"><b>Tamaño de letra</b><small>Grande: pensado para leer sin gafas</small></span>
            <Elegir eq className="w100" opciones={[{ v: 'normal' as Letra, t: 'Normal' }, { v: 'grande' as Letra, t: <><span className="aa">Aa</span>Grande</> }]} valor={letra} onCambio={cambiarLetra} />
          </div>
        </div>

        {/* ---------- Entreno ---------- */}
        <p className="grp-t">Entreno</p>
        <div className="list">
          <div className="it col">
            <span className="tx"><b>Descanso por defecto</b><small>Compuestos {duracion(a.descansoCompuesto)} · aislamiento {duracion(a.descansoAislamiento)}</small></span>
            <div className="grid2">
              <div><span className="lbl fl">Compuestos</span><Stepper className="sm" valor={a.descansoCompuesto} paso={15} min={30} max={600} sufijo="s" etiqueta="Descanso de compuestos" onCambio={v => guardar({ descansoCompuesto: v })} /></div>
              <div><span className="lbl fl">Aislamiento</span><Stepper className="sm" valor={a.descansoAislamiento} paso={15} min={15} max={600} sufijo="s" etiqueta="Descanso de aislamiento" onCambio={v => guardar({ descansoAislamiento: v })} /></div>
            </div>
          </div>
          <Fila t="Vibrar al acabar el descanso" on={a.vibrar} c={v => guardar({ vibrar: v })} />
          <Fila t="Sonido al acabar el descanso" on={a.sonido} c={v => guardar({ sonido: v })} />
          <Fila t="Pantalla siempre encendida" d="Durante el entreno" on={a.pantallaEncendida} c={v => guardar({ pantallaEncendida: v })} />
          <Fila t="Calentamiento sugerido" d="Series de aproximación antes de las pesadas" on={a.calentamiento} c={v => guardar({ calentamiento: v })} />
          <Fila t="Avisos de seguridad" d="Banca y sentadilla con barra" on={a.avisosSeguridad} c={v => guardar({ avisosSeguridad: v })} />
        </div>

        {/* ---------- Comida ---------- */}
        <p className="grp-t">Comida</p>
        <div className="list">
          <Fila t="Mostrar kcal" d="La proteína se ve siempre" on={a.mostrarKcal} c={v => guardar({ mostrarKcal: v })} />
          <div className="it col">
            <span className="tx"><b>Objetivo del día</b><small>{manual ? 'Lo pones tú' : auto ? `Automático: ${auto.kcal} kcal · ${auto.proteina} g de proteína` : 'Lo calcula la app con tu peso y tu actividad'}</small></span>
            <Elegir eq className="w100" opciones={[{ v: 'auto' as const, t: 'Automático' }, { v: 'manual' as const, t: 'Manual' }]} valor={manual ? 'manual' : 'auto'} onCambio={ponerManual} />
            {manual && (
              <>
                <div className="grid2">
                  <div><span className="lbl fl">Kcal</span><Stepper className="sm" valor={a.kcalManual} paso={50} min={1000} max={5000} etiqueta="Kcal al día" onCambio={v => guardar({ kcalManual: v })} /></div>
                  <div><span className="lbl fl">Proteína</span><Stepper className="sm" valor={a.proteinaManual} paso={5} min={40} max={300} sufijo="g" etiqueta="Proteína al día" onCambio={v => guardar({ proteinaManual: v })} /></div>
                </div>
                <button className="btn ln sm" onClick={() => ponerManual('auto')}><Ico n="arrow-counter-clockwise" b />Volver a automático</button>
              </>
            )}
          </div>
          <div className="it col">
            <span className="tx"><b>Límite de cafeína</b><small>Y hora a partir de la que te avisamos</small></span>
            <div className="grid2">
              <div><span className="lbl fl">Máximo al día</span><Stepper className="sm" valor={a.cafeinaLimite} paso={50} min={0} max={1000} sufijo="mg" etiqueta="Límite de cafeína" onCambio={v => guardar({ cafeinaLimite: v })} /></div>
              <label><span className="lbl fl">Hora tope</span><input className="inp" type="time" value={a.cafeinaHoraTope} onChange={e => { if (e.target.value) guardar({ cafeinaHoraTope: e.target.value }) }} /></label>
            </div>
          </div>
        </div>

        {/* ---------- Actividad ---------- */}
        <p className="grp-t">Actividad</p>
        <div className="list">
          {hayPasos ? (
            <div className="it col">
              <span className="tx"><b>Fuente de pasos</b><small>{a.fuentePasos === 'auto' ? 'Se leen solos de Health Connect' : 'Los apuntas tú en Progreso → Pasos'}</small></span>
              <Elegir eq className="w100" opciones={[{ v: 'auto' as const, t: 'Health Connect' }, { v: 'manual' as const, t: 'A mano' }]} valor={a.fuentePasos} onCambio={cambiarFuente} />
            </div>
          ) : (
            <div className="it">
              <span className="ico"><Ico n="footprints" /></span>
              <span className="tx"><b>Fuente de pasos</b><small>En este móvil no hay Health Connect: los pasos se apuntan a mano en Progreso → Pasos.</small></span>
              <span className="end small">A mano</span>
            </div>
          )}
          <button className="it" onClick={() => nav.ir('per-sec', { s: 'preferencias' })}>
            <span className="tx"><b>Objetivo de pasos</b></span>
            <span className="end small">{p.pasosObjetivo.toLocaleString('es-ES')}</span>
            <Ico n="caret-right" className="car" />
          </button>
        </div>

        {/* ---------- Notificaciones ---------- */}
        <p className="grp-t">Notificaciones <span className="tag">Android</span></p>
        {nativo ? (
          <div className="list">
            <Fila t="1 h antes de dormir" d={`Con el entreno de mañana · te acuestas a las ${p.horaDormir.replace(/^0/, '')}`} on={a.noti.dormir} c={v => void cambiarNoti({ dormir: v })} />
            <FilaHora t="Pesarse" d={pesarseTxt} on={a.noti.pesarse} hora={a.noti.pesarseHora} c={v => void cambiarNoti({ pesarse: v })} h={v => void cambiarNoti({ pesarseHora: v })} />
            <FilaHora t="Batido de proteína" d="Cada día a las" on={a.noti.batido} hora={a.noti.batidoHora} c={v => void cambiarNoti({ batido: v })} h={v => void cambiarNoti({ batidoHora: v })} />
            <FilaHora t="Creatina" d="Cada día a las" on={a.noti.creatina} hora={a.noti.creatinaHora} c={v => void cambiarNoti({ creatina: v })} h={v => void cambiarNoti({ creatinaHora: v })} />
            <Fila t="Copia de seguridad semanal" d="Si hace 7 días de la última" on={a.noti.copia} c={v => void cambiarNoti({ copia: v })} />
            <Fila t="Foto de progreso" d={p.fotosCadaSemanas > 0 ? `Cada ${p.fotosCadaSemanas} semana${p.fotosCadaSemanas === 1 ? '' : 's'}` : 'Opcional'} on={a.noti.fotos} c={v => void cambiarNoti({ fotos: v })} />
            <Fila t="Resumen del domingo" d="¿Voy bien? Tu semana en 10 segundos" on={a.noti.domingo} c={v => void cambiarNoti({ domingo: v })} />
          </div>
        ) : (
          <p className="note plain"><Ico n="device-mobile" /><span><b>No disponible en iPhone:</b> los recordatorios se ven dentro de la app.</span></p>
        )}

        {/* ---------- Datos y copias ---------- */}
        <p className="grp-t" ref={refDatos} id="aju-datos">Datos y copias</p>
        <p className="note ok"><Ico n="device-mobile-camera" /><span><b>Todo se guarda en este móvil.</b> Sin cuentas ni nube: haz copias de vez en cuando.</span></p>
        <div className="list mt8">
          <button className="it" disabled={ocupado} onClick={() => void copiaAhora()}>
            <span className="ico"><Ico n="export" /></span>
            <span className="tx"><b>Hacer copia ahora</b><small>{a.ultimaCopia ? `Última: ${cuando(a.ultimaCopia)}` : 'Aún no has hecho ninguna'}</small></span>
          </button>
          <button className="it" disabled={ocupado} onClick={() => void elegir()}>
            <span className="ico"><Ico n="download-simple" /></span>
            <span className="tx"><b>Importar copia</b><small>Un archivo .jowyfit</small></span>
          </button>
          {archivo && (
            <div className="it col">
              <p className="note warn"><Ico n="warning" /><span>¿Restaurar <b>{archivo.nombre}</b>? Se sustituye todo lo que hay ahora en el móvil.</span></p>
              <div className="btns">
                <button className="btn gry sm" onClick={() => setArchivo(null)}>Cancelar</button>
                <button className="btn sm" disabled={ocupado} onClick={() => void restaurar(archivo.bytes)}>Restaurar</button>
              </div>
            </div>
          )}
          {nativo && (
            <div className="it">
              <span className="ico"><Ico n="clock-clockwise" /></span>
              <span className="tx"><b>Copia automática semanal</b><small>En Documentos/JowyFit</small></span>
              <Interruptor on={a.copiaAuto} onCambio={v => guardar({ copiaAuto: v })} etiqueta="Copia automática semanal" />
            </div>
          )}
          <button className="it danger" onClick={borrarTodo}>
            <span className="ico"><Ico n="trash" /></span>
            <span className="tx"><b>Borrar todos los datos</b><small>Te lo pediremos confirmar</small></span>
          </button>
        </div>
        {nativo && copias.length > 0 && (
          <>
            <p className="lbl fl mt16">Copias guardadas en el móvil</p>
            <div className="list">
              {copias.slice(0, 8).map(c => (
                <div key={c.nombre} className="it">
                  <span className="tx"><b className="mono small">{c.nombre}</b><small>{c.fecha ? cuando(new Date(c.fecha).toISOString()) : ''}{c.tam ? ` · ${Math.max(1, Math.round(c.tam / 1024)).toLocaleString('es-ES')} KB` : ''}</small></span>
                  <button className={cx('btn sm auto', confirmar === c.nombre ? 'badf' : 'gry')} disabled={ocupado} onClick={() => void restaurarGuardada(c.nombre)}>
                    {confirmar === c.nombre ? '¿Seguro?' : 'Restaurar'}
                  </button>
                </div>
              ))}
            </div>
            {confirmar && <p className="small muted mt8">Toca otra vez para restaurar. Se sustituye todo lo que hay ahora.</p>}
          </>
        )}

        {/* ---------- Gimnasios y permisos ---------- */}
        <p className="grp-t">Gimnasios y permisos</p>
        <div className="list">
          <button className="it" onClick={() => nav.ir('rut-gym', undefined, 'rut')}>
            <span className="ico"><Ico n="map-pin" /></span>
            <span className="tx"><b>Gimnasios</b><small>{gym ? `${gym.nombre} · activo` : 'Ninguno todavía'}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
          <Permiso ico="bell" t="Notificaciones" d={nativo ? undefined : esIPhone() ? 'No disponible en iPhone' : 'Solo en la app de Android'}
            estado={nativo ? permNoti : null} onActivar={() => void activarNoti()} />
          <Permiso ico="footprints" t="Health Connect" d="Para contar los pasos" estado={hayPasos ? a.fuentePasos === 'auto' : null} onActivar={() => void activarPasos()} />
          <div className="it">
            <span className="ico"><Ico n="camera" /></span>
            <span className="tx"><b>Cámara</b><small>Se pide la primera vez que escaneas o haces una foto</small></span>
          </div>
        </div>

        {/* ---------- Créditos y acerca de ---------- */}
        <p className="grp-t">Créditos y aviso legal</p>
        <div className="list">
          <button className="it" onClick={() => nav.ir('creditos')}>
            <span className="ico"><Ico n="info" /></span>
            <span className="tx"><b>Créditos y aviso legal</b><small>RepDB, Open Food Facts · no es consejo médico</small></span>
            <Ico n="caret-right" className="car" />
          </button>
        </div>

        <p className="grp-t">Acerca de</p>
        <div className="spec-box"><div className="spec">
          <p><span>Versión</span><b>{paquete.version}</b></p>
          <p><span>Ejercicios del catálogo</span><b>{catalogo ? catalogo.ejercicios.length.toLocaleString('es-ES') : '—'}</b></p>
        </div></div>
      </div>
    </Pantalla>
  )
}

function Fila({ t, d, on, c }: { t: string; d?: ReactNode; on: boolean; c: (v: boolean) => void }) {
  return (
    <div className="it">
      <span className="tx"><b>{t}</b>{d && <small>{d}</small>}</span>
      <Interruptor on={on} onCambio={c} etiqueta={t} />
    </div>
  )
}

/** Aviso con hora editable: interruptor y, si está activo, la hora. */
function FilaHora({ t, d, on, hora, c, h }: { t: string; d: string; on: boolean; hora: string; c: (v: boolean) => void; h: (v: string) => void }) {
  return (
    <div className="it">
      <span className="tx">
        <b>{t}</b>
        <small>{d} {on ? '' : hora.replace(/^0/, '')}</small>
      </span>
      {on && <input className="inp" type="time" value={hora} aria-label={`Hora de ${t.toLowerCase()}`} style={{ width: 104, minHeight: 40 }} onChange={e => { if (e.target.value) h(e.target.value) }} />}
      <Interruptor on={on} onCambio={c} etiqueta={t} />
    </div>
  )
}

/** Estado de un permiso: null = no disponible en este móvil. */
function Permiso({ ico, t, d, estado, onActivar }: { ico: string; t: string; d?: string; estado: boolean | null; onActivar: () => void }) {
  return (
    <div className="it">
      <span className="ico"><Ico n={ico} /></span>
      <span className="tx"><b>{t}</b>{d && <small>{d}</small>}</span>
      {estado === null ? <span className="tag">No disponible</span>
        : estado ? <span className="tag ok"><Ico n="check" b />Activado</span>
          : <button className="btn sm auto" onClick={onActivar}>Activar</button>}
    </div>
  )
}
