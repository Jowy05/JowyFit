// Componentes comunes con el aspecto del mockup «4 · Ficha».
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Ejercicio } from '../catalogo/tipos'
import { imagen, miniatura } from '../catalogo/catalogo'
import { siguiente } from '../dominio/pesos'
import { useNav } from './nav'

export const cx = (...c: (string | number | false | null | undefined)[]) => c.filter(x => typeof x === 'string' && x).join(' ')
export const estilo = (o: Record<string, string | number>) => o as CSSProperties
export const pct = (v: number, total: number) => `${Math.max(0, Math.min(100, total > 0 ? (v / total) * 100 : 0)).toFixed(0)}%`

/**
 * Evita que un doble toque lance dos veces la misma acción (dos comidas, dos entrenos, dos «atrás»…).
 * Mientras la acción está en marcha (y un momento después, hasta que la pantalla cambia), los toques siguientes se ignoran.
 */
export function useUnaVez() {
  const ocupado = useRef(false)
  return useCallback(<A extends unknown[]>(f: (...a: A) => unknown) => async (...a: A) => {
    if (ocupado.current) return
    ocupado.current = true
    try { await f(...a) } finally { window.setTimeout(() => { ocupado.current = false }, 400) }
  }, [])
}

export function Pantalla({ children, full, className, id }: { children: ReactNode; full?: boolean; className?: string; id?: string }) {
  return <section className={cx('screen', className)} data-full={full ? '' : undefined} id={id}>{children}</section>
}

export function Ico({ n, b, className }: { n: string; b?: boolean; className?: string }) {
  return <i className={cx(b ? 'ph-bold' : 'ph', `ph-${n}`, className)} aria-hidden="true" />
}

/** Cabecera con degradado: migas, título, subtítulo y acciones. */
export function Cab({ crumb, titulo, sub, atras, derecha, children, className }: {
  crumb?: ReactNode; titulo?: ReactNode; sub?: ReactNode; atras?: boolean | (() => void); derecha?: ReactNode; children?: ReactNode; className?: string
}) {
  const nav = useNav()
  return (
    <header className={cx('hd', className)}>
      <div className="hd-bar">
        {atras && (
          <button className="ib" aria-label="Volver" onClick={typeof atras === 'function' ? atras : nav.atras}>
            <Ico n="caret-left" />
          </button>
        )}
        <div className="grow">{crumb && <span className="crumb">{crumb}</span>}</div>
        {derecha}
      </div>
      {titulo && <h1>{titulo}</h1>}
      {sub && <p className="sub">{sub}</p>}
      {children}
    </header>
  )
}

export function Seg<T extends string>({ opciones, valor, onCambio, fill }: { opciones: { v: T; t: string }[]; valor: T; onCambio: (v: T) => void; fill?: boolean }) {
  return (
    <div className={cx('seg', fill && 'fill')} role="tablist">
      {opciones.map(o => (
        <button key={o.v} role="tab" aria-selected={o.v === valor} className={cx(o.v === valor && 'on')} onClick={() => onCambio(o.v)}>{o.t}</button>
      ))}
    </div>
  )
}

/** Miniatura cuadrada de un ejercicio con su imagen real (RepDB). */
export function Th({ ej, size, grande, className, icono = 'barbell' }: { ej?: Ejercicio | null; size?: 'xs' | 's' | 'm' | 'l'; grande?: boolean; className?: string; icono?: string }) {
  const [error, setError] = useState(false)
  if (!ej || error) return <span className={cx('th', size, className)}><Ico n={icono} b /></span>
  return (
    <span className={cx('th img has-img', size, className)}>
      <img className="rep" src={grande ? imagen(ej, ej.poses.includes('peak') ? 'peak' : undefined) : miniatura(ej)} alt="" loading="lazy" onError={() => setError(true)} />
    </span>
  )
}

/** − valor + que salta a pesos reales si hay lista. */
export function Stepper({ valor, onCambio, lista, paso = 1, min, max, className, sufijo, decimales = 2, etiqueta }: {
  valor: number | null; onCambio: (v: number) => void; lista?: number[]; paso?: number; min?: number; max?: number; className?: string; sufijo?: string; decimales?: number; etiqueta?: string
}) {
  const [editando, setEditando] = useState(false)
  const v = valor ?? 0
  const mover = (dir: 1 | -1) => {
    let n = lista && lista.length ? siguiente(lista, v, dir) : Math.round((v + dir * paso) * 100) / 100
    if (min != null) n = Math.max(min, n)
    if (max != null) n = Math.min(max, n)
    onCambio(n)
  }
  const texto = valor == null ? '—' : v.toLocaleString('es-ES', { maximumFractionDigits: decimales })
  return (
    <div className={cx('stp', className)} role="group" aria-label={etiqueta}>
      <button type="button" aria-label="Menos" onClick={() => mover(-1)}><Ico n="minus" b /></button>
      <span className="v" onClick={() => setEditando(true)}>
        {editando ? (
          <input
            className="val inp-num" autoFocus inputMode="decimal" defaultValue={valor ?? ''}
            style={{ width: '5ch', background: 'transparent', border: 0, textAlign: 'center', outline: 'none', padding: 0 }}
            onBlur={e => {
              // Lo que se escribe a mano se respeta (p. ej. 46 kg con discos de 1 kg), dentro de los límites.
              let n = parseFloat(e.target.value.replace(',', '.'))
              if (!Number.isNaN(n)) { if (min != null) n = Math.max(min, n); if (max != null) n = Math.min(max, n); onCambio(Math.round(n * 100) / 100) }
              setEditando(false)
            }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          />
        ) : <span className="val" key={texto}>{texto}</span>}
        {sufijo && <small>{sufijo}</small>}
      </span>
      <button type="button" aria-label="Más" onClick={() => mover(1)}><Ico n="plus" b /></button>
    </div>
  )
}

export function Chip({ on, onClick, children, className, ck }: { on?: boolean; onClick?: () => void; children: ReactNode; className?: string; ck?: boolean }) {
  return (
    <button type="button" className={cx('chip', on && 'on', className)} aria-pressed={!!on} onClick={onClick}>
      {ck && <Ico n="check" b className="ck" />}{children}
    </button>
  )
}

/** Chips de selección única o múltiple. */
export function Elegir<T extends string | number>({ opciones, valor, onCambio, className, eq }: {
  opciones: { v: T; t: ReactNode }[]; valor: T | T[]; onCambio: (v: T) => void; className?: string; eq?: boolean
}) {
  const sel = (v: T) => (Array.isArray(valor) ? valor.includes(v) : valor === v)
  return (
    <div className={cx('chips', eq && 'eq', className)}>
      {opciones.map(o => <Chip key={String(o.v)} on={sel(o.v)} ck={Array.isArray(valor)} onClick={() => onCambio(o.v)}>{o.t}</Chip>)}
    </div>
  )
}

export function Interruptor({ on, onCambio, etiqueta }: { on: boolean; onCambio: (v: boolean) => void; etiqueta?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={etiqueta} className={cx('sw', on && 'on')} onClick={() => onCambio(!on)} />
}

export function Barra({ v, total, tono, gruesa }: { v: number; total: number; tono?: 'go' | 'ok' | 'warn' | 'gold'; gruesa?: boolean }) {
  return <span className={cx('bar', tono, gruesa && 'thick')}><i style={estilo({ '--w': pct(v, total) })} /></span>
}

export function Anillo({ v, total, texto, grande }: { v: number; total: number; texto?: ReactNode; grande?: boolean }) {
  const r = 27, c = 2 * Math.PI * r
  const f = Math.max(0, Math.min(1, total > 0 ? v / total : 0))
  return (
    <div className={cx('mring', grande && 'big')}>
      <svg viewBox="0 0 64 64"><circle className="tr" cx="32" cy="32" r={r} /><circle className="pr" cx="32" cy="32" r={r} strokeDasharray={`${(f * c).toFixed(1)} ${c.toFixed(1)}`} /></svg>
      <span>{texto ?? `${Math.round(f * 100)}%`}</span>
    </div>
  )
}

export function Vacio({ icono, titulo, texto, accion, onAccion, mal }: { icono: string; titulo: string; texto?: ReactNode; accion?: ReactNode; onAccion?: () => void; mal?: boolean }) {
  return (
    <div className="card pd empty">
      <span className={cx('empty-ic', mal && 'bad')}><Ico n={icono} /></span>
      <h3 className="h3">{titulo}</h3>
      {texto && <p className="muted">{texto}</p>}
      {accion && <button className="btn mt12" onClick={onAccion}>{accion}</button>}
    </div>
  )
}

/** Hoja inferior: se monta en la capa de hojas de App. */
export function Hoja({ titulo, sub, children, className, cerrar = true }: { titulo?: ReactNode; sub?: ReactNode; children: ReactNode; className?: string; cerrar?: boolean }) {
  const nav = useNav()
  return (
    <div className={cx('sheet', className)} role="dialog" aria-modal="true">
      <div className="grab" />
      {titulo && (
        <div className="sh-h">
          <div className="grow"><h2>{titulo}</h2>{sub && <p className="sub">{sub}</p>}</div>
          {cerrar && <button className="ib" aria-label="Cerrar" onClick={() => nav.hoja(null)}><Ico n="x" /></button>}
        </div>
      )}
      {children}
    </div>
  )
}

export function Campo({ etiqueta, children, ayuda }: { etiqueta: ReactNode; children: ReactNode; ayuda?: ReactNode }) {
  return (
    <label className="fl">
      <span className="lbl fl">{etiqueta}</span>
      {children}
      {ayuda && <small className="small muted mt4" style={{ display: 'block' }}>{ayuda}</small>}
    </label>
  )
}

/** Fila de ficha técnica: etiqueta a la izquierda, valor a la derecha. */
export function Dato({ k, v, onClick }: { k: ReactNode; v: ReactNode; onClick?: () => void }) {
  return <p onClick={onClick}><span>{k}</span><b>{v}</b></p>
}

export function Seccion({ titulo, accion, onAccion, extra, children, className }: { titulo: ReactNode; accion?: ReactNode; onAccion?: () => void; extra?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx('sec', className)}>
      <div className="sec-h">
        <h2>{titulo}</h2>
        {accion && <button className="lnk" onClick={onAccion}>{accion} <Ico n="caret-right" /></button>}
        {extra}
      </div>
      {children}
    </div>
  )
}

/**
 * Campo de texto que se guarda solo: un momento después de dejar de escribir, al salir del campo y al cerrar la
 * pantalla (antes solo al salir del campo: con «atrás» o cambiando de pestaña se perdía lo escrito).
 */
/** Largo máximo de lo que se escribe: nombres cortos y notas de un párrafo (un texto enorme congelaba las pantallas). */
export const LARGO = { nombre: 80, corto: 40, frase: 200, nota: 1000, buscar: 100 } as const

/** Recorta un texto para pintarlo: uno enorme (de una copia vieja) congelaba la pantalla al dibujarlo. */
export function recortar(t: unknown, n: number = LARGO.frase): string {
  const s = typeof t === 'string' ? t : t == null ? '' : String(t)
  return s.length > n ? `${s.slice(0, n)}…` : s
}

export function TextoGuardado({ valor, onGuardar, area, className = 'inp', placeholder, etiqueta, max }: {
  valor: string; onGuardar: (v: string) => void; area?: boolean; className?: string; placeholder?: string; etiqueta?: string; max?: number
}) {
  const [local, setLocal] = useState(valor)
  const enfocado = useRef(false)
  const pendiente = useRef<string | null>(null)
  const temporizador = useRef<number | undefined>(undefined)
  const guardarRef = useRef(onGuardar)
  guardarRef.current = onGuardar
  useEffect(() => { if (!enfocado.current) setLocal(valor) }, [valor])
  const volcar = () => {
    window.clearTimeout(temporizador.current)
    if (pendiente.current != null) { const v = pendiente.current; pendiente.current = null; guardarRef.current(v) }
  }
  // Al desmontarse (atrás, otra pestaña), lo que quedara por guardar se guarda.
  useEffect(() => () => volcar(), [])
  const cambiar = (v: string) => {
    setLocal(v)
    pendiente.current = v
    window.clearTimeout(temporizador.current)
    temporizador.current = window.setTimeout(volcar, 700)
  }
  const comun = {
    className, value: local, placeholder, 'aria-label': etiqueta, maxLength: max ?? (area ? LARGO.nota : LARGO.frase),
    onFocus: () => { enfocado.current = true },
    onBlur: () => { enfocado.current = false; volcar() },
  }
  return area
    ? <textarea {...comun} onChange={e => cambiar(e.target.value)} />
    : <input {...comun} onChange={e => cambiar(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
}
