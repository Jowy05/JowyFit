// AJU-01 · Ajustes. Arriba lo de todo el mundo (letra, tema, recordatorios, informe en PDF, copia);
// lo técnico (entreno, comida, pasos, permisos) plegado en «Más ajustes»; «Borrar todo», al final.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import paquete from '../../../../package.json'
import { db } from '../../../datos/db'
import { guardarAjustes } from '../../../datos/repos'
import { importar } from '../../../datos/copias'
import { objetivosEnergia } from '../../../datos/consultas'
import type { Ajustes as TAjustes } from '../../../datos/tipos'
import { useCatalogo } from '../../../catalogo/catalogo'
import { aISO, duracion, fechaCorta, horaDe } from '../../../dominio/fechas'
import { abrirHealthConnect, copiasGuardadas, dispositivoApple, elegirArchivo, esAndroid, esNativo, estaInstalada, leerCopiaGuardada, pasosDisponibles, pedirPermisoPasos, permisoNotificaciones, puedeVibrar } from '../../../plataforma'
import { cx, Cab, Elegir, Ico, Interruptor, Pantalla, Stepper } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { useAjustes, useGimnasio, usePerfil } from '../../datos'
import { guardarLetra, guardarTema, letraGuardada, temaGuardado, type Letra, type PreferenciaTema } from '../../tema'
import { activarBascula, comprobarSalud, conectarSalud, copiaCompartiendo, hacerCopiaAhora, reprogramarNotificaciones, sincronizarPasos, type CopiaPreparada } from '../../servicios'
import { lanzarTutorial } from '../../tutorial/Tutorial'
import { abrirInstrucciones } from '../instalar/Instalar'
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
  // Web de Apple (iPhone, iPad, Mac): no se enseña nada que allí no funcione (Health Connect, recordatorios, vibración…).
  const apple = dispositivoApple()
  const refDatos = useRef<HTMLParagraphElement>(null)
  const refComida = useRef<HTMLParagraphElement>(null)

  const [tema, setTema] = useState<PreferenciaTema>(temaGuardado())
  const [letra, setLetra] = useState<Letra>(letraGuardada())
  const [hayPasos, setHayPasos] = useState(false)
  // Resultado de «Comprobar Health Connect» (para probar en el móvil).
  const [salud, setSalud] = useState<string[] | null>(null)
  const conectado = a.fuentePasos === 'auto' || a.fuenteBascula === 'auto'
  const conectadoTodo = a.fuentePasos === 'auto' && a.fuenteBascula === 'auto'
  const [permNoti, setPermNoti] = useState(false)
  const [copias, setCopias] = useState<Copia[]>([])
  const [confirmar, setConfirmar] = useState<string | null>(null)
  const [archivo, setArchivo] = useState<{ nombre: string; bytes: Uint8Array } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  // iPhone: la copia está hecha pero Safari no dejó abrir el menú Compartir (tardó demasiado tras el toque).
  const [copiaLista, setCopiaLista] = useState<CopiaPreparada | null>(null)
  // «Más ajustes» se abre solo si venimos a tocar algo de dentro (p. ej. el objetivo manual de comida).
  const [masAbierto, setMasAbierto] = useState(ruta.d?.seccion === 'comida')

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

  // Desde el aviso de Inicio («haz una copia») se abre directamente en «Datos y copias»;
  // desde «Tu objetivo de energía» («cambiar a objetivo manual»), en «Comida».
  useEffect(() => {
    const destino = ruta.d?.seccion === 'datos' ? refDatos : ruta.d?.seccion === 'comida' ? refComida : null
    if (!destino) return
    if (ruta.d?.seccion === 'comida') setMasAbierto(true)
    const t = window.setTimeout(() => destino.current?.scrollIntoView({ block: 'start' }), 80)
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
  const cambiarBascula = (f: 'auto' | 'manual') => {
    if (f === 'auto') void activarBascula().then(t => aviso(t))
    else guardar({ fuenteBascula: 'manual' })
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
      if (apple) {
        // Menú Compartir: «Guardar en Archivos», AirDrop, WhatsApp… Si no se puede, se descarga.
        const r = await copiaCompartiendo(copiaLista ?? undefined)
        setCopiaLista(r.resultado === 'sin-gesto' ? r.copia : null)
        if (r.resultado === 'compartido') aviso('Copia hecha. Guárdala en Archivos o envíatela')
        else if (r.resultado === 'descargado') aviso(`Copia guardada en Archivos → Descargas: ${r.copia.nombre}`)
        else if (r.resultado === 'cancelado') aviso('No se ha guardado la copia')
        return
      }
      const nombre = await hacerCopiaAhora()
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
      aviso(tipo === 'copia' ? 'Copia recuperada' : 'Datos del perfil recuperados')
      window.setTimeout(() => location.reload(), 700)
    } catch (e) {
      aviso(`No se pudo recuperar: ${String((e as Error).message ?? e)}`)
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
        {/* ---------- Apariencia: lo primero, para leer bien todo lo demás ---------- */}
        <p className="grp-t">Apariencia</p>
        <div className="list">
          <div className="it col">
            <span className="tx"><b>Tamaño de letra</b><small>Grande: pensado para leer sin gafas</small></span>
            <Elegir eq className="w100" opciones={[{ v: 'normal' as Letra, t: 'Normal' }, { v: 'grande' as Letra, t: <><span className="aa">Aa</span>Grande</> }]} valor={letra} onCambio={cambiarLetra} />
          </div>
          <div className="it col">
            <span className="tx"><b>Tema</b><small>Claro u oscuro. «Sistema» usa el del móvil</small></span>
            <div className="segc" role="radiogroup" aria-label="Tema">
              {([['sistema', 'Sistema'], ['claro', 'Claro'], ['oscuro', 'Oscuro']] as const).map(([v, t]) => (
                <button key={v} role="radio" aria-checked={tema === v} className={cx(tema === v && 'on')} onClick={() => cambiarTema(v)}>{t}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ---------- Recordatorios ---------- */}
        {!apple && <p className="grp-t">Recordatorios</p>}
        {apple ? null : nativo ? (
          <div className="list">
            <Fila t="Una hora antes de dormir" d={`Te dice qué entrenas mañana · te acuestas a las ${p.horaDormir.replace(/^0/, '')}`} on={a.noti.dormir} c={v => void cambiarNoti({ dormir: v })} />
            <FilaHora t="Pesarse" d={pesarseTxt} on={a.noti.pesarse} hora={a.noti.pesarseHora} c={v => void cambiarNoti({ pesarse: v })} h={v => void cambiarNoti({ pesarseHora: v })} />
            <FilaHora t="Batido de proteína" d="Cada día a las" on={a.noti.batido} hora={a.noti.batidoHora} c={v => void cambiarNoti({ batido: v })} h={v => void cambiarNoti({ batidoHora: v })} />
            <FilaHora t="Creatina" d="Cada día a las" on={a.noti.creatina} hora={a.noti.creatinaHora} c={v => void cambiarNoti({ creatina: v })} h={v => void cambiarNoti({ creatinaHora: v })} />
            <Fila t="Copia de seguridad" d="Si hace una semana de la última" on={a.noti.copia} c={v => void cambiarNoti({ copia: v })} />
            <Fila t="Foto de progreso" d={p.fotosCadaSemanas > 0 ? `Cada ${p.fotosCadaSemanas} semana${p.fotosCadaSemanas === 1 ? '' : 's'}` : 'Opcional'} on={a.noti.fotos} c={v => void cambiarNoti({ fotos: v })} />
            <Fila t="Resumen del domingo" d="¿Voy bien? Tu semana en 10 segundos" on={a.noti.domingo} c={v => void cambiarNoti({ domingo: v })} />
          </div>
        ) : (
          <p className="note plain"><Ico n="device-mobile" /><span><b>Solo en la app de Android:</b> los recordatorios se ven dentro de la app.</span></p>
        )}

        {/* ---------- Reloj y báscula: Health Connect, a la vista (antes estaba dentro de «Más ajustes» y no se encontraba) ---------- */}
        {!apple && <p className="grp-t">Reloj y báscula</p>}
        {apple ? null : !esAndroid() ? (
          <p className="note plain"><Ico n="watch" /><span><b>Solo en la app de Android:</b> los pasos y el peso se apuntan a mano.</span></p>
        ) : hayPasos ? (
          <div className="list" data-tour="reloj">
            <div className="it col">
              <span className="row"><span className="ico"><Ico n="heartbeat" /></span><span className="tx"><b>Health Connect</b><small>{conectado
                ? `Conectado: ${conectadoTodo ? 'pasos, peso y grasa' : a.fuentePasos === 'auto' ? 'pasos' : 'peso y grasa'}. Se actualiza solo al abrir la app.`
                : 'Trae solos los pasos de tu reloj y el peso y la grasa de tu báscula (Garmin, Samsung, Xiaomi, Fitdays…).'}</small></span></span>
              {!conectadoTodo && <button className="btn sm w100" onClick={() => void conectarSalud().then(t => aviso(t))}><Ico n="link" b />{conectado ? 'Conectar también lo que falta' : 'Conectar Health Connect'}</button>}
              <button className="btn ln sm w100" onClick={() => { setSalud(['Comprobando…']); void comprobarSalud().then(setSalud) }}><Ico n="heartbeat" />Comprobar qué llega</button>
              {salud && <p className="small muted">{salud.join(' · ')}</p>}
              <button className="lnk" onClick={() => void abrirHealthConnect()}>Abrir Health Connect (permisos) <Ico n="caret-right" /></button>
            </div>
          </div>
        ) : (
          <div className="list" data-tour="reloj">
            <div className="it col">
              <span className="row"><span className="ico"><Ico n="heartbeat" /></span><span className="tx"><b>Health Connect no está listo en este móvil</b><small>En Android 14 o más viene con el móvil: Ajustes → Seguridad y privacidad → Privacidad → Health Connect. En Android 13 o menos, se instala desde Google Play.</small></span></span>
              <button className="btn ln sm w100" onClick={() => void abrirHealthConnect().then(ok => { if (!ok) aviso('No se ha podido abrir: búscalo en los ajustes del móvil o en Google Play') })}>Abrir Health Connect</button>
            </div>
          </div>
        )}

        {/* ---------- Apple: cómo tenerla en la pantalla de inicio (las instrucciones del arranque, otra vez) ---------- */}
        {apple && (
          <>
            <p className="grp-t">{apple === 'mac' ? 'App en el Dock' : 'App en la pantalla de inicio'}</p>
            <div className="list" data-tour="instalar">
              <button className="it" onClick={abrirInstrucciones}>
                <span className="ico"><Ico n={apple === 'mac' ? 'desktop' : 'device-mobile'} /></span>
                <span className="tx"><b>{apple === 'mac' ? 'Cómo ponerla en el Dock' : 'Cómo ponerla en la pantalla de inicio'}</b><small>{estaInstalada() ? 'Ya la tienes instalada · ver los pasos' : 'Se abre como una app, a pantalla completa y sin internet'}</small></span>
                <Ico n="caret-right" className="car" />
              </button>
            </div>
          </>
        )}

        {/* ---------- Informe en PDF: arriba, junto a la copia (se busca aquí para enseñar o guardar los datos) ---------- */}
        <p className="grp-t">Informe en PDF</p>
        <div className="list" data-tour="informe">
          <button className="it" onClick={() => nav.hoja('sheet-informe')}>
            <span className="ico"><Ico n="file-pdf" /></span>
            <span className="tx"><b>Informe en PDF</b><small>Tus entrenos, tu comida y tu cuerpo en un PDF para guardar o enseñar</small></span>
            <Ico n="caret-right" className="car" />
          </button>
        </div>

        {/* ---------- Ayuda: el tutorial, siempre a mano ---------- */}
        <p className="grp-t">Ayuda</p>
        <div className="list" data-tour="tutorial">
          <button className="it" onClick={lanzarTutorial}>
            <span className="ico"><Ico n="hand-pointing" /></span>
            <span className="tx"><b>Ver el tutorial</b><small>Un paseo rápido por la app: qué hace cada pantalla</small></span>
            <Ico n="caret-right" className="car" />
          </button>
        </div>

        {/* ---------- Copia de seguridad ---------- */}
        <p className="grp-t" ref={refDatos} id="aju-datos">Copia de seguridad</p>
        <p className="note ok"><Ico n="device-mobile-camera" /><span><b>Todo se guarda en este móvil.</b> Una copia de vez en cuando te sirve si cambias de móvil o se borra algo.</span></p>
        <div className="list mt8" data-tour="copia">
          <button className="it" disabled={ocupado} onClick={() => void copiaAhora()}>
            <span className="ico"><Ico n="floppy-disk" /></span>
            <span className="tx"><b>{copiaLista ? 'Guardar la copia' : 'Hacer copia ahora'}</b><small>{copiaLista
              ? 'Está lista: toca para elegir dónde guardarla'
              : <>{apple ? 'Guárdala en Archivos o envíatela' : 'Guarda una copia de todo'} · {a.ultimaCopia ? `la última, ${cuando(a.ultimaCopia)}` : 'aún no has hecho ninguna'}</>}</small></span>
          </button>
          <button className="it" disabled={ocupado} onClick={() => void elegir()}>
            <span className="ico"><Ico n="clock-counter-clockwise" /></span>
            <span className="tx"><b>Recuperar una copia</b><small>{apple ? 'Elige en Archivos el .jowyfit que guardaste antes' : 'Elige un archivo .jowyfit que guardaste antes'}</small></span>
          </button>
          {archivo && (
            <div className="it col">
              <p className="note warn"><Ico n="warning" /><span>¿Recuperar <b>{archivo.nombre}</b>? Lo que hay ahora en el móvil se cambia por lo que tiene la copia.</span></p>
              <div className="btns">
                <button className="btn gry sm" onClick={() => setArchivo(null)}>Cancelar</button>
                <button className="btn sm" disabled={ocupado} onClick={() => void restaurar(archivo.bytes)}>Recuperar</button>
              </div>
            </div>
          )}
          {nativo && (
            <div className="it">
              <span className="ico"><Ico n="calendar-check" /></span>
              <span className="tx"><b>Copia sola cada semana</b><small>Se guarda en Documentos/JowyFit</small></span>
              <Interruptor on={a.copiaAuto} onCambio={v => guardar({ copiaAuto: v })} etiqueta="Copia automática semanal" />
            </div>
          )}
        </div>
        {nativo && copias.length > 0 && (
          <details className="fold mt8">
            <summary><Ico n="folder-open" className="blue" />Copias guardadas en el móvil <span className="tag">{copias.length}</span><Ico n="caret-down" /></summary>
            <div className="in">
              <div className="list">
                {copias.slice(0, 8).map(c => (
                  <div key={c.nombre} className="it">
                    <span className="tx"><b className="small">{c.fecha ? cuando(new Date(c.fecha).toISOString()) : c.nombre}</b><small className="mono">{c.nombre}{c.tam ? ` · ${Math.max(1, Math.round(c.tam / 1024)).toLocaleString('es-ES')} KB` : ''}</small></span>
                    <button className={cx('btn sm auto', confirmar === c.nombre ? 'badf' : 'gry')} disabled={ocupado} onClick={() => void restaurarGuardada(c.nombre)}>
                      {confirmar === c.nombre ? '¿Seguro?' : 'Recuperar'}
                    </button>
                  </div>
                ))}
              </div>
              {confirmar && <p className="small muted mt8">Toca otra vez para recuperarla. Lo que hay ahora se cambia por lo de la copia.</p>}
            </div>
          </details>
        )}

        {/* ---------- Más ajustes: lo técnico, plegado (los valores por defecto ya sirven) ---------- */}
        <details className="fold mt24 aju-mas" open={masAbierto} onToggle={e => setMasAbierto(e.currentTarget.open)}>
          <summary><Ico n="sliders-horizontal" className="blue" /><span className="tx"><b>Más ajustes</b><small>Entreno, comida, pasos y permisos</small></span><Ico n="caret-down" /></summary>
          <div className="in">
            {/* ---------- Entreno ---------- */}
            <p className="grp-t">Entreno</p>
            <div className="list">
              {/* Sin vibración (iPhone): no se ofrece; al acabar el descanso destella la pantalla. */}
              {puedeVibrar() && <Fila t="Vibrar al acabar el descanso" on={a.vibrar} c={v => guardar({ vibrar: v })} />}
              <Fila t="Sonido al acabar el descanso" on={a.sonido} c={v => guardar({ sonido: v })} />
              <Fila t="Pantalla siempre encendida" d="Durante el entreno" on={a.pantallaEncendida} c={v => guardar({ pantallaEncendida: v })} />
              <div className="it col">
                <span className="tx"><b>Descanso entre series</b><small>Ejercicios grandes {duracion(a.descansoCompuesto)} · pequeños {duracion(a.descansoAislamiento)} · se usa al crear la rutina</small></span>
                <div className="grid2">
                  <div><span className="lbl fl">Grandes</span><Stepper className="sm" valor={a.descansoCompuesto} paso={15} min={30} max={600} sufijo="s" etiqueta="Descanso de compuestos" onCambio={v => guardar({ descansoCompuesto: v })} /></div>
                  <div><span className="lbl fl">Pequeños</span><Stepper className="sm" valor={a.descansoAislamiento} paso={15} min={15} max={600} sufijo="s" etiqueta="Descanso de aislamiento" onCambio={v => guardar({ descansoAislamiento: v })} /></div>
                </div>
                <small className="small muted">Grandes: sentadilla, press, remo… Pequeños: bíceps, gemelos…</small>
              </div>
              <Fila t="Calentamiento sugerido" d="Unas series ligeras antes de las pesadas" on={a.calentamiento} c={v => guardar({ calentamiento: v })} />
              <Fila t="Avisos de seguridad" d="En banca y sentadilla con barra" on={a.avisosSeguridad} c={v => guardar({ avisosSeguridad: v })} />
            </div>

            {/* ---------- Comida ---------- */}
            <p className="grp-t" ref={refComida}>Comida</p>
            <div className="list">
              <Fila t="Mostrar calorías" d="La proteína se ve siempre" on={a.mostrarKcal} c={v => guardar({ mostrarKcal: v })} />
              <div className="it col">
                <span className="tx"><b>Objetivo del día</b><small>{manual ? 'Lo pones tú' : auto ? `Automático: ${auto.kcal} kcal · ${auto.proteina} g de proteína` : 'Lo calcula la app con tu peso y tu actividad'}</small></span>
                <Elegir eq className="w100" opciones={[{ v: 'auto' as const, t: 'Automático' }, { v: 'manual' as const, t: 'Lo pongo yo' }]} valor={manual ? 'manual' : 'auto'} onCambio={ponerManual} />
                {manual && (
                  <>
                    <div className="grid2">
                      <div><span className="lbl fl">Calorías</span><Stepper className="sm" valor={a.kcalManual} paso={50} min={1000} max={5000} etiqueta="Kcal al día" onCambio={v => guardar({ kcalManual: v })} /></div>
                      <div><span className="lbl fl">Proteína</span><Stepper className="sm" valor={a.proteinaManual} paso={5} min={40} max={300} sufijo="g" etiqueta="Proteína al día" onCambio={v => guardar({ proteinaManual: v })} /></div>
                    </div>
                    <button className="btn ln sm" onClick={() => ponerManual('auto')}><Ico n="arrow-counter-clockwise" b />Volver a automático</button>
                  </>
                )}
              </div>
              <div className="it col">
                <span className="tx"><b>Límite de cafeína</b><small>Cuánta al día y desde qué hora te avisamos</small></span>
                <div className="grid2">
                  <div><span className="lbl fl">Máximo al día</span><Stepper className="sm" valor={a.cafeinaLimite} paso={50} min={0} max={1000} sufijo="mg" etiqueta="Límite de cafeína" onCambio={v => guardar({ cafeinaLimite: v })} /></div>
                  <label><span className="lbl fl">Hora tope</span><input className="inp" type="time" value={a.cafeinaHoraTope} onChange={e => { if (e.target.value) guardar({ cafeinaHoraTope: e.target.value }) }} /></label>
                </div>
                <small className="small muted">Un café son unos 80 mg.</small>
              </div>
            </div>

            {/* ---------- Pasos ---------- */}
            <p className="grp-t">Pasos y báscula</p>
            <div className="list">
              {hayPasos ? (
                <div className="it col">
                  <span className="tx"><b>De dónde salen los pasos</b><small>{a.fuentePasos === 'auto' ? 'Se leen solos de Health Connect' : 'Los apuntas tú en Progreso → Pasos'}</small></span>
                  <Elegir eq className="w100" opciones={[{ v: 'auto' as const, t: 'Health Connect' }, { v: 'manual' as const, t: 'A mano' }]} valor={a.fuentePasos} onCambio={cambiarFuente} />
                </div>
              ) : (
                <div className="it">
                  <span className="ico"><Ico n="footprints" /></span>
                  <span className="tx"><b>De dónde salen los pasos</b><small>{apple ? 'Los apuntas tú en Progreso → Pasos (míralos en la app Salud).' : 'En este móvil no hay Health Connect: los pasos se apuntan a mano en Progreso → Pasos.'}</small></span>
                  <span className="end small">A mano</span>
                </div>
              )}
              {hayPasos && (
                <div className="it col">
                  <span className="tx"><b>Peso y grasa de la báscula</b><small>{a.fuenteBascula === 'auto' ? 'Se traen solos de Health Connect (la app de tu báscula los escribe allí)' : 'Los apuntas tú con «+ Peso» o en Progreso → Cuerpo'}</small></span>
                  <Elegir eq className="w100" opciones={[{ v: 'auto' as const, t: 'Health Connect' }, { v: 'manual' as const, t: 'A mano' }]} valor={a.fuenteBascula ?? 'manual'} onCambio={cambiarBascula} />
                </div>
              )}
              <button className="it" onClick={() => nav.ir('pro-pasos', undefined, 'pro')}>
                <span className="tx"><b>Objetivo de pasos</b><small>Se cambia en la pantalla Pasos</small></span>
                <span className="end small">{p.pasosObjetivo.toLocaleString('es-ES')}</span>
                <Ico n="caret-right" className="car" />
              </button>
            </div>

            {/* ---------- Gimnasios y permisos ---------- */}
            <p className="grp-t">Gimnasios y permisos</p>
            <div className="list">
              <button className="it" onClick={() => nav.ir('rut-gym', undefined, 'rut')}>
                <span className="ico"><Ico n="map-pin" /></span>
                <span className="tx"><b>Gimnasios</b><small>{gym ? `${gym.nombre} · activo` : 'Ninguno todavía'}</small></span>
                <Ico n="caret-right" className="car" />
              </button>
              {!apple && <Permiso ico="bell" t="Notificaciones" d={nativo ? undefined : 'Solo en la app de Android'}
                estado={nativo ? permNoti : null} onActivar={() => void activarNoti()} />}
              {!apple && <Permiso ico="footprints" t="Health Connect" d="Para contar los pasos" estado={hayPasos ? a.fuentePasos === 'auto' : null} onActivar={() => void activarPasos()} />}
              <div className="it">
                <span className="ico"><Ico n="camera" /></span>
                <span className="tx"><b>Cámara</b><small>{apple ? 'Safari la pide la primera vez que escaneas' : 'Se pide la primera vez que escaneas o haces una foto'}</small></span>
              </div>
            </div>
          </div>
        </details>

        {/* ---------- Créditos y acerca de ---------- */}
        <p className="grp-t">Créditos y aviso legal</p>
        <div className="list">
          <button className="it" onClick={() => nav.ir('creditos')}>
            <span className="ico"><Ico n="info" /></span>
            <span className="tx"><b>Créditos y aviso legal</b><small>De dónde salen los ejercicios y los alimentos · no es consejo médico</small></span>
            <Ico n="caret-right" className="car" />
          </button>
        </div>
        <p className="small muted mt8 center">JowyFit {paquete.version} · {catalogo ? catalogo.ejercicios.length.toLocaleString('es-ES') : '—'} ejercicios</p>

        {/* ---------- Borrar todo: al final y aparte ---------- */}
        <div className="list aju-borrar">
          <button className="it danger" onClick={borrarTodo}>
            <span className="ico"><Ico n="trash" /></span>
            <span className="tx"><b>Borrar todos los datos</b><small>Deja la app como recién instalada. Te lo pediremos confirmar</small></span>
          </button>
        </div>
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
