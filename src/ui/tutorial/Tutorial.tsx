// Tutorial de la app («recorrido guiado»): oscurece la pantalla menos lo que se explica y una tarjeta lo cuenta.
// Reglas (docs de recorridos guiados): cada paso FIJA la pantalla que necesita (así da igual ir adelante o atrás),
// el foco se apaga mientras algo se mueve, las anclas son atributos `data-tour` y al cerrar la app vuelve a como
// estaba. Se ofrece una vez al entrar (hoja «¿Te enseño cómo funciona?») y se puede lanzar desde Ajustes.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { esAndroid, esWebApple, estaInstalada } from '../../plataforma'
import { cx, Hoja, Ico } from '../componentes'
import { RAIZ, useNav } from '../../app/nav'
import { pasosTutorial } from './pasos'
import { t } from '../../i18n'

const CLAVE_OFRECIDO = 'jf-tutorial-ofrecido'
const EVENTO = 'jf-tutorial'

/** ¿Ya se ha ofrecido el tutorial al entrar? (Se ofrece una sola vez; luego está en Ajustes.) */
export function tutorialOfrecido(): boolean {
  try { return localStorage.getItem(CLAVE_OFRECIDO) === '1' } catch { return true }
}
export function marcarTutorialOfrecido() {
  try { localStorage.setItem(CLAVE_OFRECIDO, '1') } catch { /* sin almacenamiento: no pasa nada */ }
}
/** Arranca el tutorial (desde la hoja de bienvenida o desde Ajustes). */
export function lanzarTutorial() { window.dispatchEvent(new Event(EVENTO)) }
export function alLanzarTutorial(f: () => void): () => void {
  window.addEventListener(EVENTO, f)
  return () => window.removeEventListener(EVENTO, f)
}

const esperar = (ms: number) => new Promise<void>(r => setTimeout(r, ms))
const fotograma = () => new Promise<void>(r => requestAnimationFrame(() => r()))

/** La primera ancla que se ve (con área), o null. */
function ancla(sel: string | string[]): HTMLElement | null {
  for (const s of Array.isArray(sel) ? sel : [sel]) {
    const el = document.querySelector<HTMLElement>(s)
    if (el) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return el }
  }
  return null
}

/** El ancla, cuando ya está pintada y se ve. Espera a que carguen las pantallas perezosas. */
async function buscar(sel: string | string[], ms: number): Promise<HTMLElement | null> {
  const fin = Date.now() + ms
  for (;;) {
    const el = ancla(sel)
    if (el || Date.now() > fin) return el
    await esperar(100)
  }
}

type Caja = { x: number; y: number; w: number; h: number }
type Donde = 'arriba' | 'abajo' | 'centro'
const MARGEN = 6
/** Hueco entre la tarjeta y el borde de la pantalla (y el recuadro). */
const AIRE = 16

/** El recorrido en sí. Se pinta encima de todo (portal en el body). */
export function Tutorial({ alCerrar }: { alCerrar: () => void }) {
  const nav = useNav()
  const navRef = useRef(nav)
  navRef.current = nav
  const pasos = useMemo(() => pasosTutorial({ apple: esWebApple(), android: esAndroid(), instalada: estaInstalada() }), [])
  // Al cerrar, la app vuelve a como estaba al empezar.
  const foto = useRef(nav.estado)
  const [i, setI] = useState(0)
  const [caja, setCaja] = useState<Caja | null>(null)
  const [listo, setListo] = useState(false)
  const [donde, setDonde] = useState<Donde>('centro')
  const sentido = useRef(1)
  const siguienteRef = useRef<HTMLButtonElement>(null)
  const tarjetaRef = useRef<HTMLDivElement>(null)
  const paso = pasos[i]!
  const ultimo = i === pasos.length - 1
  const iRef = useRef(i)
  iRef.current = i

  const cerrar = useCallback(() => { navRef.current.poner(foto.current); alCerrar() }, [alCerrar])
  const ir = useCallback((d: number) => {
    sentido.current = d
    const n = iRef.current + d
    if (n >= pasos.length) { cerrar(); return }
    setI(Math.max(0, n))
  }, [pasos.length, cerrar])

  // Cada paso: se apaga el foco, se pone su pantalla, se busca lo que se señala y se enciende el foco.
  useEffect(() => {
    let vivo = true
    setCaja(null)
    setListo(false)
    void (async () => {
      const n = navRef.current
      if (paso.pestana) {
        const quiere = paso.ruta ?? RAIZ[paso.pestana].p
        const pila = n.estado.pilas[paso.pestana]
        const arriba = pila[pila.length - 1]!
        const bien = n.estado.pestana === paso.pestana && arriba.p === quiere && pila.length === (paso.ruta ? 2 : 1)
        if (n.estado.hoja) n.hoja(null)
        if (!bien) { n.raiz(paso.pestana); if (paso.ruta) n.ir(paso.ruta) }
      }
      await fotograma()
      if (!paso.sel) { await esperar(150); if (vivo) { setDonde('centro'); setListo(true) } return }
      const el = await buscar(paso.sel, 3000)
      if (!vivo) return
      if (!el && paso.siempre) { setDonde('centro'); setListo(true); return }
      if (!el) {
        // Nada que enseñar en esta pantalla (por ejemplo, no hay pendientes hoy): se salta.
        console.warn(`[tutorial] «${paso.id}» sin ancla visible: se salta`)
        if (i === 0 && sentido.current < 0) sentido.current = 1
        ir(sentido.current)
        return
      }
      el.scrollIntoView({ block: 'center', inline: 'nearest' })
      await esperar(320)
      if (!vivo) return
      // La tarjeta va donde no tape: debajo si cabe, si no encima; si no cabe en ninguno (lo señalado es muy
      // alto), lo señalado sube arriba del todo y el recuadro se queda con lo que cabe sobre la tarjeta.
      const alto = window.innerHeight
      const hT = (tarjetaRef.current?.offsetHeight ?? 230) + AIRE * 2
      let r = el.getBoundingClientRect()
      let d: Donde
      let h = r.height
      if (alto - r.bottom - MARGEN >= hT) d = 'abajo'
      else if (r.top - MARGEN >= hT) d = 'arriba'
      else {
        el.scrollIntoView({ block: 'start', inline: 'nearest' })
        await esperar(320)
        if (!vivo) return
        r = el.getBoundingClientRect()
        d = 'abajo'
        h = Math.max(48, Math.min(r.height, alto - hT - r.top - MARGEN))
      }
      setCaja({ x: r.left, y: r.top, w: r.width, h })
      setDonde(d)
      setListo(true)
    })()
    return () => { vivo = false }
  }, [i, paso, ir])

  // El foco sigue al ancla si algo se recoloca (letra grande, una imagen que acaba de cargar…).
  useEffect(() => {
    if (!listo || !paso.sel) return
    const reloj = window.setInterval(() => {
      const el = ancla(paso.sel!)
      if (!el) return
      const r = el.getBoundingClientRect()
      // Solo se recoloca (el alto, si se recortó, se mantiene).
      setCaja(c => (!c || (Math.abs(c.x - r.left) < 2 && Math.abs(c.y - r.top) < 2 && Math.abs(c.w - r.width) < 2) ? c : { ...c, x: r.left, y: r.top, w: r.width }))
    }, 300)
    return () => window.clearInterval(reloj)
  }, [listo, paso.sel])

  useEffect(() => { if (listo) siguienteRef.current?.focus({ preventScroll: true }) }, [listo, i])

  // Teclado: flechas para avanzar o volver, Escape para salir.
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); ir(1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); if (i > 0) ir(-1) }
      else if (e.key === 'Escape') { e.preventDefault(); cerrar() }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [i, ir, cerrar])

  return createPortal(
    <div className="tut" data-tut="" aria-live="polite">
      {/* El velo no deja tocar la app debajo: el paseo se maneja con la tarjeta. */}
      <div className={cx('tut-velo', !caja && 'lleno')} onClick={() => siguienteRef.current?.focus()} />
      {caja && <div className="tut-foco" data-tut-foco="" style={{ left: caja.x - MARGEN, top: caja.y - MARGEN, width: caja.w + MARGEN * 2, height: caja.h + MARGEN * 2 }} />}
      <div ref={tarjetaRef} className={cx('tut-tarjeta', caja ? donde : 'centro', listo && 'visible')} role="dialog" aria-modal="true" aria-labelledby="tut-t" data-tut-tarjeta="">
        <div className="tut-cab">
          <span className="tut-n">{t('{n} de {total}', { n: i + 1, total: pasos.length })}</span>
          <button className="tut-x" aria-label={t('Salir del tutorial')} onClick={cerrar}><Ico n="x" b /></button>
        </div>
        <h2 id="tut-t">{paso.titulo}</h2>
        <p>{paso.texto}</p>
        <div className="tut-barra" aria-hidden="true"><i style={{ width: `${((i + 1) / pasos.length) * 100}%` }} /></div>
        <div className="tut-btns">
          {i > 0 ? <button className="btn gry sm" onClick={() => ir(-1)}><Ico n="caret-left" b />{t('Atrás')}</button> : <button className="btn gry sm" onClick={cerrar}>{t('Ahora no')}</button>}
          <button ref={siguienteRef} className="btn sm" onClick={() => ir(1)}>{ultimo ? <><Ico n="check" b />{t('Terminar')}</> : <>{t('Siguiente')}<Ico n="caret-right" b /></>}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Hoja que lo ofrece la primera vez: «¿Te enseño cómo funciona JowyFit?». */
export function HojaOfertaTutorial() {
  const nav = useNav()
  return (
    <Hoja className="tut-oferta">
      <img src={`${import.meta.env.BASE_URL}iconos/icono-192.png`} alt="" width={84} height={84} />
      <h2>{t('¿Te enseño cómo funciona JowyFit?')}</h2>
      <p>{t('Un paseo rápido por lo importante: tu rutina, el entreno, la comida y cómo vas. Menos de un minuto.')}</p>
      <button className="btn mt16" onClick={() => { nav.hoja(null); lanzarTutorial() }}><Ico n="play" b />{t('Sí, enséñamelo')}</button>
      <button className="btn ln mt8" onClick={() => nav.hoja(null)}>{t('Ahora no')}</button>
      <p className="small muted mt12 center">{t('Lo tienes siempre en Perfil → Ajustes → «Ver el tutorial».')}</p>
    </Hoja>
  )
}
