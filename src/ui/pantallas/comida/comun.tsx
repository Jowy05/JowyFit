// Piezas compartidas de la pestaña Comida.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { db } from '../../../datos/db'
import type { Comida, Plantilla } from '../../../datos/tipos'
import { aspecto, conRacion, franjaPorHora, type Racion } from '../../../dominio/comida'
import { horaActual } from '../../../dominio/fechas'
import { Cab, cx, Ico, Seg } from '../../comp'
import { useNav } from '../../nav'

type Vista = 'com' | 'com-plant' | 'com-guard'

export function CabComida({ vista, crumb }: { vista: Vista; crumb: string }) {
  const nav = useNav()
  return (
    <Cab crumb={crumb} titulo="Comida" derecha={<button className="ib" aria-label="Escanear" onClick={() => nav.ir('com-scan')}><Ico n="barcode" /></button>}>
      <Seg fill valor={vista} onCambio={v => nav.reemplazar(v)} opciones={[{ v: 'com', t: 'Día' }, { v: 'com-plant', t: 'Plantillas' }, { v: 'com-guard', t: 'Productos' }]} />
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

/** Apunta una plantilla en la ración elegida y cuenta un uso más. */
export async function apuntarPlantilla(p: Plantilla, r: Racion, fecha: string, franja?: Comida['franja']): Promise<() => void> {
  const v = conRacion(p, r)
  const tipo: Comida['tipo'] = p.tipo === 'comida' ? 'plantilla' : p.tipo
  const deshacer = await apuntar({ fecha, franja, nombre: p.nombre, kcal: v.kcal, proteina: v.proteina, cafeina: v.cafeina, racion: r, tipo, plantillaId: p.id, codigo: p.codigo, foto: p.foto })
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

/** kcal y proteína en una línea («600 kcal · 22 g»). */
export const kp = (kcal: number, prot: number, cafeina?: number) =>
  cafeina ? `${Math.round(kcal)} kcal · ${Math.round(cafeina)} mg cafeína` : `${Math.round(kcal)} kcal · ${Math.round(prot)} g`
