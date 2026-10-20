// Piezas compartidas de la pestaña Comida.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { db } from '../../../datos/db'
import type { Comida, Plantilla } from '../../../datos/tipos'
import { CLAVES_MACROS, NOMBRE_MACRO, NOMBRE_RACION, PISTA_RACION, aspecto, buscarOFF, conRacion, escalarMacros, factorRacion, franjaPorHora, tipoRacion, type Macros, type Racion } from '../../../dominio/comida'
import { num } from '../../../dominio/calculos'
import { horaActual } from '../../../dominio/fechas'
import { Cab, cx, Ico, Seg } from '../../comp'
import { useNav } from '../../nav'

type Vista = 'com' | 'com-plant'

/** Solo dos pestañas: el día y «Mis comidas» (que ya incluye los productos escaneados). */
export function CabComida({ vista, crumb, fecha }: { vista: Vista; crumb: string; fecha?: string }) {
  const nav = useNav()
  // Si se está viendo otro día, lo escaneado se apunta en ese día (antes iba siempre a hoy).
  return (
    <Cab crumb={crumb} titulo="Comida" derecha={<button className="ib" aria-label="Escanear" onClick={() => nav.ir('com-scan', fecha ? { fecha } : undefined)}><Ico n="barcode" /></button>}>
      <Seg fill valor={vista} onCambio={v => nav.reemplazar(v)} opciones={[{ v: 'com', t: 'Día' }, { v: 'com-plant', t: 'Mis comidas' }]} />
    </Cab>
  )
}

/** Miniatura de color con icono (o la foto si la hay). */
export function Mini({ nombre, tipo, foto, imagen, className }: { nombre: string; tipo?: string; foto?: Blob; imagen?: string; className?: string }) {
  const url = useUrlBlob(foto)
  const a = aspecto(nombre, tipo)
  const src = url ?? imagen
  if (src) return <span className={cx('fp', className)} style={{ background: '#fff' }}><img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></span>
  return <span className={cx('fp', a.fp, className)}><Ico n={a.icono} b /></span>
}

/** URL temporal para mostrar un Blob (se libera al desmontar). */
export function useUrlBlob(b?: Blob): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!b) { setUrl(null); return }
    const u = URL.createObjectURL(b)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [b])
  return url
}

/** Apunta una comida y devuelve cómo deshacerlo. */
export async function apuntar(c: Omit<Comida, 'id' | 'hora' | 'franja'> & { hora?: string; franja?: Comida['franja'] }): Promise<() => void> {
  const hora = c.hora ?? horaActual()
  const id = await db.comidas.add({ ...c, hora, franja: c.franja ?? franjaPorHora(hora) } as Comida)
  return () => { void db.comidas.delete(id) }
}

/** Apunta una plantilla en la ración elegida (un picoteo guarda la bolsa entera; una comida, el plato) y cuenta un uso más. */
export async function apuntarPlantilla(p: Plantilla, r: Racion, fecha: string, franja?: Comida['franja']): Promise<() => void> {
  const v = conRacion(p, r, p.tipo)
  const tipo: Comida['tipo'] = p.tipo === 'comida' ? 'plantilla' : p.tipo
  const deshacer = await apuntar({ fecha, franja, nombre: p.nombre, ...v, racion: r, tipo, plantillaId: p.id, codigo: p.codigo, foto: p.foto })
  if (p.id != null) await db.plantillas.update(p.id, { usos: p.usos + 1 })
  return () => { deshacer(); if (p.id != null) void db.plantillas.update(p.id, { usos: p.usos }) }
}

/** Fila deslizable: hacia la izquierda enseña «Borrar». */
export function Deslizable({ children, onBorrar, onAbrir }: { children: ReactNode; onBorrar: () => void; onAbrir: () => void }) {
  const [abierta, setAbierta] = useState(false)
  const x0 = useRef<number | null>(null)
  const movida = useRef(false)
  return (
    <div
      className="swipe"
      onPointerDown={e => { x0.current = e.clientX; movida.current = false }}
      onPointerMove={e => { if (x0.current != null && Math.abs(e.clientX - x0.current) > 12) movida.current = true }}
      onPointerUp={e => {
        if (x0.current == null) return
        const dx = e.clientX - x0.current
        if (dx < -40) setAbierta(true)
        else if (dx > 40) setAbierta(false)
        x0.current = null
      }}
    >
      <div
        className={cx('fe', abierta && 'moved')} role="button" tabIndex={0}
        onClick={() => { if (movida.current) { movida.current = false; return } if (abierta) setAbierta(false); else onAbrir() }}
        onKeyDown={e => { if (e.key === 'Enter') onAbrir() }}
      >
        {children}
      </div>
      <button className="swipe-del" aria-label="Borrar" onClick={() => { setAbierta(false); onBorrar() }}><Ico n="trash" b />Borrar</button>
    </div>
  )
}

/** Hidratos, azúcares, grasas y sal en una línea pequeña («Hidratos 23 g · de ellos, azúcares 4 g · …»); nada si no se saben. */
export function LineaMacros({ m, className }: { m: Macros; className?: string }) {
  const hay = CLAVES_MACROS.filter(k => m[k] != null)
  if (!hay.length) return null
  return <p className={cx('small muted', className)}>{hay.map(k => `${NOMBRE_MACRO[k]} ${num(m[k]!)} g`).join(' · ')}</p>
}

/** kcal y proteína en una línea («600 kcal · 22 g proteína»), siempre con la unidad. */
export const kp = (kcal: number, prot: number, cafeina?: number) =>
  cafeina ? `${Math.round(kcal)} kcal · ${Math.round(cafeina)} mg cafeína` : `${Math.round(kcal)} kcal · ${Math.round(prot)} g proteína`

/** Busca en Open Food Facts los códigos escaneados sin conexión. Devuelve cuántos encontró. */
export async function buscarPendientes(): Promise<number> {
  const pend = await db.productos.filter(p => !!p.pendiente).toArray()
  let n = 0
  for (const [i, p] of pend.entries()) {
    // Open Food Facts permite unas 15 consultas por minuto: una cada 4,5 s.
    if (i) await new Promise(r => setTimeout(r, 4500))
    const r = await buscarOFF(p.codigo)
    if (r.estado === 'offline') break
    if (r.estado === 'encontrado') { await db.productos.put(r.producto); n++ }
  }
  return n
}

/** Algo que se va a apuntar: lo guardado (el plato, o la bolsa entera si es picoteo) y qué hacer con la ración elegida. */
export type ParaElegir = { nombre: string; base: { kcal: number; proteina: number; cafeina?: number } & Macros; tipo?: string; elegir: (r: Racion) => void }

/** Lo guardado de algo ya apuntado: deshace su ración (un «Mucho» de 900 kcal era un plato de 600). */
export function baseDeApuntada(c: Comida): ParaElegir['base'] {
  const f = 1 / factorRacion(c.racion, c.tipo)
  return { kcal: c.kcal * f, proteina: c.proteina * f, cafeina: c.cafeina ? c.cafeina * f : undefined, ...escalarMacros(c, f) }
}

/**
 * Ventana «¿Cuánto?» al tocar cualquier cosa para apuntarla: tres botones grandes (Poco · Normal · Mucho) con lo que
 * suma cada uno. Se pinta encima de todo (también de la hoja de Añadir). Tocar fuera o «Cancelar» la cierra.
 */
export function ElegirCuanto({ x, onCerrar }: { x: ParaElegir | null; onCerrar: () => void }) {
  if (!x) return null
  const tr = tipoRacion(x.tipo)
  const destino = document.querySelector('.app') ?? document.body
  return createPortal(
    <div className="popup-fondo" onClick={onCerrar}>
      <div className="popup" role="dialog" aria-modal="true" aria-label={`Cuánto de ${x.nombre}`} onClick={e => e.stopPropagation()}>
        <p className="lbl">¿Cuánto has tomado?</p>
        <h3 className="h3 mt4">{x.nombre}</h3>
        <div className="popup-op">
          {(['P', 'N', 'G'] as const).map(r => {
            const v = conRacion(x.base, r, x.tipo)
            return (
              <button key={r} className={cx('chip big ux-com-tam', r === 'N' && 'on')} onClick={() => x.elegir(r)}>
                <span>{NOMBRE_RACION[r]}<small className="mono">{v.kcal} kcal</small><small>{PISTA_RACION[tr][r]}</small></span>
              </button>
            )
          })}
        </div>
        <button className="btn gry sm mt12" onClick={onCerrar}>Cancelar</button>
      </div>
    </div>,
    destino,
  )
}
