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
import { num } from '../../../dominio/calculos'
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
import { IDIOMAS, idioma, ponerIdioma, regionNumeros, t, tn } from '../../../i18n'
import { tr } from '../../../i18n/jsx'

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
    const temporizador = window.setTimeout(() => destino.current?.scrollIntoView({ block: 'start' }), 80)
    return () => window.clearTimeout(temporizador)
  }, [ruta.d?.seccion])

  const guardar = (c: Partial<TAjustes>) => { void guardarAjustes(c) }

  // ---------- apariencia ----------
  const cambiarTema = (x: PreferenciaTema) => { guardarTema(x); setTema(x) }
  const cambiarLetra = (l: Letra) => {
    guardarLetra(l)
    setLetra(l)
    window.dispatchEvent(new Event('jf-letra'))
  }

  // ---------- comida ----------
  const manual = a.kcalManual != null || a.proteinaManual != null
  const ponerManual = (m: 'auto' | 'manual') => {
    if (m === 'auto') { guardar({ kcalManual: null, proteinaManual: null }); aviso(t('Objetivo automático')); return }
    guardar({ kcalManual: a.kcalManual ?? auto?.kcal ?? 2000, proteinaManual: a.proteinaManual ?? auto?.proteina ?? 140 })
  }

  // ---------- pasos ----------
  const activarPasos = async () => {
    const ok = await pedirPermisoPasos()
    if (!ok) { aviso(t('Sin permiso de Health Connect: los pasos se apuntan a mano')); return }
    await guardarAjustes({ fuentePasos: 'auto' })
    const sincronizado = await sincronizarPasos()
    aviso(sincronizado ? t('Pasos conectados con Health Connect') : t('Health Connect activado'))
  }
  const cambiarFuente = (f: 'auto' | 'manual') => {
    if (f === 'auto') void activarPasos()
    else guardar({ fuentePasos: 'manual' })
  }
  const cambiarBascula = (f: 'auto' | 'manual') => {
    if (f === 'auto') void activarBascula().then(texto => aviso(texto))
    else guardar({ fuenteBascula: 'manual' })
  }

  // ---------- notificaciones ----------
  const cambiarNoti = async (c: Partial<Noti>) => {
    const activa = Object.values(c).some(v => v === true)
    if (activa && !permNoti) {
      const ok = await permisoNotificaciones(true)
      setPermNoti(ok)
      if (!ok) aviso(t('Sin permiso: actívalo en los ajustes del móvil para recibir avisos'))
    }
    await guardarAjustes({ noti: { ...a.noti, ...c } })
    await reprogramarNotificaciones()
  }
  const activarNoti = async () => {
    const ok = await permisoNotificaciones(true)
    setPermNoti(ok)
    if (ok) { await reprogramarNotificaciones(); aviso(t('Notificaciones activadas')) }
    else aviso(t('Actívalas en los ajustes del móvil'))
  }

  // ---------- copias ----------
  const copiaAhora = async () => {
    setOcupado(true)
    try {
      if (apple) {
        // Menú Compartir: «Guardar en Archivos», AirDrop, WhatsApp… Si no se puede, se descarga.
        const r = await copiaCompartiendo(copiaLista ?? undefined)
        setCopiaLista(r.resultado === 'sin-gesto' ? r.copia : null)
        if (r.resultado === 'compartido') aviso(t('Copia hecha. Guárdala en Archivos o envíatela'))
        else if (r.resultado === 'descargado') aviso(t('Copia guardada en Archivos → Descargas: {nombre}', { nombre: r.copia.nombre }))
        else if (r.resultado === 'cancelado') aviso(t('No se ha guardado la copia'))
        return
      }
      const nombre = await hacerCopiaAhora()
      aviso(nativo ? t('Copia guardada en Documentos/JowyFit: {nombre}', { nombre }) : t('Copia descargada: {nombre}', { nombre }))
      refrescarCopias()
    } catch (e) {
      aviso(t('No se pudo hacer la copia: {error}', { error: String((e as Error).message ?? e) }))
    } finally { setOcupado(false) }
  }
  const restaurar = async (bytes: Uint8Array) => {
    setOcupado(true)
    try {
      const tipo = await importar(bytes)
      aviso(tipo === 'copia' ? t('Copia recuperada') : t('Datos del perfil recuperados'))
      window.setTimeout(() => location.reload(), 700)
    } catch (e) {
      aviso(t('No se pudo recuperar: {error}', { error: String((e as Error).message ?? e) }))
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
    catch (e) { aviso(t('No se pudo leer la copia: {error}', { error: String((e as Error).message ?? e) })) }
  }
  const borrarTodo = () => nav.hoja('sheet-confirmar', { titulo: t('¿Borrar todos los datos?'), texto: t('Se borra todo lo que hay en este móvil. Haz antes una copia.'), si: t('Borrar todo'), peligro: true, accion: 'borrar-todo' })

  const pesarseTxt = p.diasPesaje.length ? t('{dias} a las', { dias: diasTxt(p.diasPesaje) }) : t('A las')

  return (
    <Pantalla>
      <Cab atras crumb={t('Perfil')} titulo={t('Ajustes')} />
      <div className="pg">
        {/* ---------- Apariencia: lo primero, para leer bien todo lo demás ---------- */}
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

        {/* ---------- Recordatorios ---------- */}
        {!apple && <p className="grp-t">{t('Recordatorios')}</p>}
        {apple ? null : nativo ? (
          <div className="list">
            <Fila titulo={t('Una hora antes de dormir')} d={t('Te dice qué entrenas mañana · te acuestas a las {hora}', { hora: p.horaDormir.replace(/^0/, '') })} on={a.noti.dormir} c={v => void cambiarNoti({ dormir: v })} />
            <FilaHora titulo={t('Pesarse')} d={pesarseTxt} on={a.noti.pesarse} hora={a.noti.pesarseHora} c={v => void cambiarNoti({ pesarse: v })} h={v => void cambiarNoti({ pesarseHora: v })} />
            <FilaHora titulo={t('Batido de proteína')} d={t('Cada día a las')} on={a.noti.batido} hora={a.noti.batidoHora} c={v => void cambiarNoti({ batido: v })} h={v => void cambiarNoti({ batidoHora: v })} />
            <FilaHora titulo={t('Creatina')} d={t('Cada día a las')} on={a.noti.creatina} hora={a.noti.creatinaHora} c={v => void cambiarNoti({ creatina: v })} h={v => void cambiarNoti({ creatinaHora: v })} />
            <Fila titulo={t('Copia de seguridad')} d={t('Si hace una semana de la última')} on={a.noti.copia} c={v => void cambiarNoti({ copia: v })} />
            <Fila titulo={t('Foto de progreso')} d={p.fotosCadaSemanas > 0 ? tn(p.fotosCadaSemanas, 'Cada {n} semana', 'Cada {n} semanas') : t('Opcional')} on={a.noti.fotos} c={v => void cambiarNoti({ fotos: v })} />
            <Fila titulo={t('Resumen del domingo')} d={t('¿Voy bien? Tu semana en 10 segundos')} on={a.noti.domingo} c={v => void cambiarNoti({ domingo: v })} />
          </div>
        ) : (
          <p className="note plain"><Ico n="device-mobile" /><span>{tr('<b>Solo en la app de Android:</b> los recordatorios se ven dentro de la app.', { b: x => <b>{x}</b> })}</span></p>
        )}

        {/* ---------- Reloj y báscula: Health Connect, a la vista (antes estaba dentro de «Más ajustes» y no se encontraba) ---------- */}
        {!apple && <p className="grp-t">{t('Reloj y báscula')}</p>}
        {apple ? null : !esAndroid() ? (
          <p className="note plain"><Ico n="watch" /><span>{tr('<b>Solo en la app de Android:</b> los pasos y el peso se apuntan a mano.', { b: x => <b>{x}</b> })}</span></p>
        ) : hayPasos ? (
          <div className="list" data-tour="reloj">
            <div className="it col">
              <span className="row"><span className="ico"><Ico n="heartbeat" /></span><span className="tx"><b>Health Connect</b><small>{conectado
                ? t('Conectado: {que}. Se actualiza solo al abrir la app.', { que: conectadoTodo ? t('pasos, peso y grasa') : a.fuentePasos === 'auto' ? t('pasos') : t('peso y grasa') })
                : t('Trae solos los pasos de tu reloj y el peso y la grasa de tu báscula (Garmin, Samsung, Xiaomi, Fitdays…).')}</small></span></span>
              {!conectadoTodo && <button className="btn sm w100" onClick={() => void conectarSalud().then(texto => aviso(texto))}><Ico n="link" b />{conectado ? t('Conectar también lo que falta') : t('Conectar Health Connect')}</button>}
              <button className="btn ln sm w100" onClick={() => { setSalud([t('Comprobando…')]); void comprobarSalud().then(setSalud) }}><Ico n="heartbeat" />{t('Comprobar qué llega')}</button>
              {salud && <p className="small muted">{salud.join(' · ')}</p>}
              <button className="lnk" onClick={() => void abrirHealthConnect()}>{t('Abrir Health Connect (permisos)')} <Ico n="caret-right" /></button>
            </div>
          </div>
        ) : (
          <div className="list" data-tour="reloj">
            <div className="it col">
              <span className="row"><span className="ico"><Ico n="heartbeat" /></span><span className="tx"><b>{t('Health Connect no está listo en este móvil')}</b><small>{t('En Android 14 o más viene con el móvil: Ajustes → Seguridad y privacidad → Privacidad → Health Connect. En Android 13 o menos, se instala desde Google Play.')}</small></span></span>
              <button className="btn ln sm w100" onClick={() => void abrirHealthConnect().then(ok => { if (!ok) aviso(t('No se ha podido abrir: búscalo en los ajustes del móvil o en Google Play')) })}>{t('Abrir Health Connect')}</button>
            </div>
          </div>
        )}

        {/* ---------- Apple: cómo tenerla en la pantalla de inicio (las instrucciones del arranque, otra vez) ---------- */}
        {apple && (
          <>
            <p className="grp-t">{apple === 'mac' ? t('App en el Dock') : t('App en la pantalla de inicio')}</p>
            <div className="list" data-tour="instalar">
              <button className="it" onClick={abrirInstrucciones}>
                <span className="ico"><Ico n={apple === 'mac' ? 'desktop' : 'device-mobile'} /></span>
                <span className="tx"><b>{apple === 'mac' ? t('Cómo ponerla en el Dock') : t('Cómo ponerla en la pantalla de inicio')}</b><small>{estaInstalada() ? t('Ya la tienes instalada · ver los pasos') : t('Se abre como una app, a pantalla completa y sin internet')}</small></span>
                <Ico n="caret-right" className="car" />
              </button>
            </div>
          </>
        )}

        {/* ---------- Informe en PDF: arriba, junto a la copia (se busca aquí para enseñar o guardar los datos) ---------- */}
        <p className="grp-t">{t('Informe en PDF')}</p>
        <div className="list" data-tour="informe">
          <button className="it" onClick={() => nav.hoja('sheet-informe')}>
            <span className="ico"><Ico n="file-pdf" /></span>
            <span className="tx"><b>{t('Informe en PDF')}</b><small>{t('Tus entrenos, tu comida y tu cuerpo en un PDF para guardar o enseñar')}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
        </div>

        {/* ---------- Ayuda: el tutorial, siempre a mano ---------- */}
        <p className="grp-t">{t('Ayuda')}</p>
        <div className="list" data-tour="tutorial">
          <button className="it" onClick={lanzarTutorial}>
            <span className="ico"><Ico n="hand-pointing" /></span>
            <span className="tx"><b>{t('Ver el tutorial')}</b><small>{t('Un paseo rápido por la app: qué hace cada pantalla')}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
        </div>

        {/* ---------- Copia de seguridad ---------- */}
        <p className="grp-t" ref={refDatos} id="aju-datos">{t('Copia de seguridad')}</p>
        <p className="note ok"><Ico n="device-mobile-camera" /><span>{tr('<b>Todo se guarda en este móvil.</b> Una copia de vez en cuando te sirve si cambias de móvil o se borra algo.', { b: x => <b>{x}</b> })}</span></p>
        <div className="list mt8" data-tour="copia">
          <button className="it" disabled={ocupado} onClick={() => void copiaAhora()}>
            <span className="ico"><Ico n="floppy-disk" /></span>
            <span className="tx"><b>{copiaLista ? t('Guardar la copia') : t('Hacer copia ahora')}</b><small>{copiaLista
              ? t('Está lista: toca para elegir dónde guardarla')
              : <>{apple ? t('Guárdala en Archivos o envíatela') : t('Guarda una copia de todo')} · {a.ultimaCopia ? t('la última, {cuando}', { cuando: cuando(a.ultimaCopia) }) : t('aún no has hecho ninguna')}</>}</small></span>
          </button>
          <button className="it" disabled={ocupado} onClick={() => void elegir()}>
            <span className="ico"><Ico n="clock-counter-clockwise" /></span>
            <span className="tx"><b>{t('Recuperar una copia')}</b><small>{apple ? t('Elige en Archivos el .jowyfit que guardaste antes') : t('Elige un archivo .jowyfit que guardaste antes')}</small></span>
          </button>
          {archivo && (
            <div className="it col">
              <p className="note warn"><Ico n="warning" /><span>{tr('¿Recuperar {nombre}? Lo que hay ahora en el móvil se cambia por lo que tiene la copia.', { nombre: <b>{archivo.nombre}</b> })}</span></p>
              <div className="btns">
                <button className="btn gry sm" onClick={() => setArchivo(null)}>{t('Cancelar')}</button>
                <button className="btn sm" disabled={ocupado} onClick={() => void restaurar(archivo.bytes)}>{t('Recuperar')}</button>
              </div>
            </div>
          )}
          {nativo && (
            <div className="it">
              <span className="ico"><Ico n="calendar-check" /></span>
              <span className="tx"><b>{t('Copia sola cada semana')}</b><small>{t('Se guarda en Documentos/JowyFit')}</small></span>
              <Interruptor on={a.copiaAuto} onCambio={v => guardar({ copiaAuto: v })} etiqueta={t('Copia automática semanal')} />
            </div>
          )}
        </div>
        {nativo && copias.length > 0 && (
          <details className="fold mt8">
            <summary><Ico n="folder-open" className="blue" />{t('Copias guardadas en el móvil')} <span className="tag">{copias.length}</span><Ico n="caret-down" /></summary>
            <div className="in">
              <div className="list">
                {copias.slice(0, 8).map(c => (
                  <div key={c.nombre} className="it">
                    <span className="tx"><b className="small">{c.fecha ? cuando(new Date(c.fecha).toISOString()) : c.nombre}</b><small className="mono">{c.nombre}{c.tam ? ` · ${Math.max(1, Math.round(c.tam / 1024)).toLocaleString(regionNumeros())} KB` : ''}</small></span>
                    <button className={cx('btn sm auto', confirmar === c.nombre ? 'badf' : 'gry')} disabled={ocupado} onClick={() => void restaurarGuardada(c.nombre)}>
                      {confirmar === c.nombre ? t('¿Seguro?') : t('Recuperar')}
                    </button>
                  </div>
                ))}
              </div>
              {confirmar && <p className="small muted mt8">{t('Toca otra vez para recuperarla. Lo que hay ahora se cambia por lo de la copia.')}</p>}
            </div>
          </details>
        )}

        {/* ---------- Más ajustes: lo técnico, plegado (los valores por defecto ya sirven) ---------- */}
        <details className="fold mt24 aju-mas" open={masAbierto} onToggle={e => setMasAbierto(e.currentTarget.open)}>
          <summary><Ico n="sliders-horizontal" className="blue" /><span className="tx"><b>{t('Más ajustes')}</b><small>{t('Entreno, comida, pasos y permisos')}</small></span><Ico n="caret-down" /></summary>
          <div className="in">
            {/* ---------- Entreno ---------- */}
            <p className="grp-t">{t('Entreno')}</p>
            <div className="list">
              {/* Sin vibración (iPhone): no se ofrece; al acabar el descanso destella la pantalla. */}
              {puedeVibrar() && <Fila titulo={t('Vibrar al acabar el descanso')} on={a.vibrar} c={v => guardar({ vibrar: v })} />}
              <Fila titulo={t('Sonido al acabar el descanso')} on={a.sonido} c={v => guardar({ sonido: v })} />
              <Fila titulo={t('Pantalla siempre encendida')} d={t('Durante el entreno')} on={a.pantallaEncendida} c={v => guardar({ pantallaEncendida: v })} />
              <div className="it col">
                <span className="tx"><b>{t('Descanso entre series')}</b><small>{t('Ejercicios grandes {grandes} · pequeños {pequenos} · se usa al crear la rutina', { grandes: duracion(a.descansoCompuesto), pequenos: duracion(a.descansoAislamiento) })}</small></span>
                <div className="grid2">
                  <div><span className="lbl fl">{t('Grandes')}</span><Stepper className="sm" valor={a.descansoCompuesto} paso={15} min={30} max={600} sufijo="s" etiqueta={t('Descanso de compuestos')} onCambio={v => guardar({ descansoCompuesto: v })} /></div>
                  <div><span className="lbl fl">{t('Pequeños')}</span><Stepper className="sm" valor={a.descansoAislamiento} paso={15} min={15} max={600} sufijo="s" etiqueta={t('Descanso de aislamiento')} onCambio={v => guardar({ descansoAislamiento: v })} /></div>
                </div>
                <small className="small muted">{t('Grandes: sentadilla, press, remo… Pequeños: bíceps, gemelos…')}</small>
              </div>
              <Fila titulo={t('Calentamiento sugerido')} d={t('Unas series ligeras antes de las pesadas')} on={a.calentamiento} c={v => guardar({ calentamiento: v })} />
              <Fila titulo={t('Avisos de seguridad')} d={t('En banca y sentadilla con barra')} on={a.avisosSeguridad} c={v => guardar({ avisosSeguridad: v })} />
            </div>

            {/* ---------- Comida ---------- */}
            <p className="grp-t" ref={refComida}>{t('Comida')}</p>
            <div className="list">
              <Fila titulo={t('Mostrar calorías')} d={t('La proteína se ve siempre')} on={a.mostrarKcal} c={v => guardar({ mostrarKcal: v })} />
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

            {/* ---------- Pasos ---------- */}
            <p className="grp-t">{t('Pasos y báscula')}</p>
            <div className="list">
              {hayPasos ? (
                <div className="it col">
                  <span className="tx"><b>{t('De dónde salen los pasos')}</b><small>{a.fuentePasos === 'auto' ? t('Se leen solos de Health Connect') : t('Los apuntas tú en Progreso → Pasos')}</small></span>
                  <Elegir eq className="w100" opciones={[{ v: 'auto' as const, t: 'Health Connect' }, { v: 'manual' as const, t: t('A mano') }]} valor={a.fuentePasos} onCambio={cambiarFuente} />
                </div>
              ) : (
                <div className="it">
                  <span className="ico"><Ico n="footprints" /></span>
                  <span className="tx"><b>{t('De dónde salen los pasos')}</b><small>{apple ? t('Los apuntas tú en Progreso → Pasos (míralos en la app Salud).') : t('En este móvil no hay Health Connect: los pasos se apuntan a mano en Progreso → Pasos.')}</small></span>
                  <span className="end small">{t('A mano')}</span>
                </div>
              )}
              {hayPasos && (
                <div className="it col">
                  <span className="tx"><b>{t('Peso y grasa de la báscula')}</b><small>{a.fuenteBascula === 'auto' ? t('Se traen solos de Health Connect (la app de tu báscula los escribe allí)') : t('Los apuntas tú con «+ Peso» o en Progreso → Cuerpo')}</small></span>
                  <Elegir eq className="w100" opciones={[{ v: 'auto' as const, t: 'Health Connect' }, { v: 'manual' as const, t: t('A mano') }]} valor={a.fuenteBascula ?? 'manual'} onCambio={cambiarBascula} />
                </div>
              )}
              <button className="it" onClick={() => nav.ir('pro-pasos', undefined, 'pro')}>
                <span className="tx"><b>{t('Objetivo de pasos')}</b><small>{t('Se cambia en la pantalla Pasos')}</small></span>
                <span className="end small">{p.pasosObjetivo.toLocaleString(regionNumeros())}</span>
                <Ico n="caret-right" className="car" />
              </button>
            </div>

            {/* ---------- Gimnasios y permisos ---------- */}
            <p className="grp-t">{t('Gimnasios y permisos')}</p>
            <div className="list">
              <button className="it" onClick={() => nav.ir('rut-gym', undefined, 'rut')}>
                <span className="ico"><Ico n="map-pin" /></span>
                <span className="tx"><b>{t('Gimnasios')}</b><small>{gym ? t('{nombre} · activo', { nombre: gym.nombre }) : t('Ninguno todavía')}</small></span>
                <Ico n="caret-right" className="car" />
              </button>
              {!apple && <Permiso ico="bell" titulo={t('Notificaciones')} d={nativo ? undefined : t('Solo en la app de Android')}
                estado={nativo ? permNoti : null} onActivar={() => void activarNoti()} />}
              {!apple && <Permiso ico="footprints" titulo="Health Connect" d={t('Para contar los pasos')} estado={hayPasos ? a.fuentePasos === 'auto' : null} onActivar={() => void activarPasos()} />}
              <div className="it">
                <span className="ico"><Ico n="camera" /></span>
                <span className="tx"><b>{t('Cámara')}</b><small>{apple ? t('Safari la pide la primera vez que escaneas') : t('Se pide la primera vez que escaneas o haces una foto')}</small></span>
              </div>
            </div>
          </div>
        </details>

        {/* ---------- Créditos y acerca de ---------- */}
        <p className="grp-t">{t('Créditos y aviso legal')}</p>
        <div className="list">
          <button className="it" onClick={() => nav.ir('creditos')}>
            <span className="ico"><Ico n="info" /></span>
            <span className="tx"><b>{t('Créditos y aviso legal')}</b><small>{t('De dónde salen los ejercicios y los alimentos · no es consejo médico')}</small></span>
            <Ico n="caret-right" className="car" />
          </button>
        </div>
        <p className="small muted mt8 center">{t('JowyFit {version} · {n} ejercicios', { version: paquete.version, n: catalogo ? catalogo.ejercicios.length.toLocaleString(regionNumeros()) : '—' })}</p>

        {/* ---------- Borrar todo: al final y aparte ---------- */}
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

function Fila({ titulo, d, on, c }: { titulo: string; d?: ReactNode; on: boolean; c: (v: boolean) => void }) {
  return (
    <div className="it">
      <span className="tx"><b>{titulo}</b>{d && <small>{d}</small>}</span>
      <Interruptor on={on} onCambio={c} etiqueta={titulo} />
    </div>
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
