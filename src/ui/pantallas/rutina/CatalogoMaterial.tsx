// Catálogo de máquinas y material del gimnasio: tarjetas con imagen y casilla, por grupos.
import { useMemo, useState } from 'react'
import { catalogoCargado, imagenMaterial, nombreMaterial, normalizar } from '../../../catalogo/catalogo'
import { GRUPOS_MATERIAL } from '../../../catalogo/clasificacion'
import type { Gimnasio, Tramo } from '../../../datos/tipos'
import { mancuernasDisponibles } from '../../../dominio/pesos'
import { cx, Ico, Stepper, LARGO } from '../../comp'
import { num } from '../../../dominio/calculos'
import { t, tn } from '../../../i18n'

/** Claves de material que usa algún ejercicio (las demás no aportan nada). */
function clavesUtiles(): Set<string> {
  const c = catalogoCargado()
  return new Set((c?.ejercicios ?? []).map(e => e.material).filter((m): m is string => !!m))
}

export function ejerciciosDisponibles(material: string[]): number {
  const s = new Set(material)
  return (catalogoCargado()?.ejercicios ?? []).filter(e => !e.material || s.has(e.material)).length
}

export function CatalogoMaterial({ material, onCambio }: { material: string[]; onCambio: (m: string[]) => void }) {
  const [q, setQ] = useState('')
  const utiles = useMemo(clavesUtiles, [])
  const sel = new Set(material)
  const conmutar = (k: string) => onCambio(sel.has(k) ? material.filter(x => x !== k) : [...material, k])
  const filtro = normalizar(q)
  return (
    <>
      <label className="search">
        <Ico n="magnifying-glass" />
        <input className="inp" type="search" maxLength={LARGO.buscar} placeholder={t('Buscar en el catálogo')} aria-label={t('Buscar en el catálogo')} value={q} onChange={e => setQ(e.target.value)} />
      </label>
      <p className="small muted mt8">{t('Lo de peso corporal ya está siempre disponible.')}</p>
      {GRUPOS_MATERIAL.map((g, gi) => {
        const claves = g.claves.filter(k => utiles.has(k) && (!filtro || normalizar(nombreMaterial(k)).includes(filtro)))
        if (!claves.length) return null
        const marcadas = claves.filter(k => sel.has(k)).length
        const todo = () => onCambio(marcadas === claves.length ? material.filter(x => !claves.includes(x)) : [...new Set([...material, ...claves])])
        const rejilla = (
          <div className="mqg">
            {claves.map(k => <Tarjeta key={k} clave={k} on={sel.has(k)} onClick={() => conmutar(k)} />)}
          </div>
        )
        if (gi < 2 || filtro) return (
          <div key={g.id}>
            <div className="grp-h"><b>{t(g.nombre)}</b><span className="mono small muted">{marcadas}/{claves.length}</span><button className="lnk" onClick={todo}>{marcadas === claves.length ? t('Quitar todo') : t('Marcar todo')}</button></div>
            {rejilla}
          </div>
        )
        return (
          <details key={g.id} className="fold mt8">
            <summary>{t(g.nombre)} <span className="mono small muted">{marcadas}/{claves.length}</span><Ico n="caret-down" /></summary>
            <div className="in">
              <div className="row jb" style={{ marginBottom: 8 }}><span /><button className="lnk" onClick={todo}>{marcadas === claves.length ? t('Quitar todo') : t('Marcar todo')}</button></div>
              {rejilla}
            </div>
          </details>
        )
      })}
    </>
  )
}

function Tarjeta({ clave, on, onClick }: { clave: string; on: boolean; onClick: () => void }) {
  const [err, setErr] = useState(false)
  const img = imagenMaterial(clave)
  return (
    <button type="button" className={cx('mq', on && 'on')} aria-pressed={on} onClick={onClick}>
      <span className="th c-gr">{img && !err ? <img src={img} alt="" loading="lazy" onError={() => setErr(true)} /> : <Ico n="barbell" b />}</span>
      <b>{nombreMaterial(clave)}</b>
      <Ico n="check" b className="ck" />
    </button>
  )
}

const DISCOS = [0.5, 1, 1.25, 2.5, 5, 10, 15, 20, 25]

/** Mancuernas por tramos y discos disponibles. */
export function PesosGimnasio({ g, onCambio }: { g: Pick<Gimnasio, 'mancuernas' | 'discos' | 'barraKg'>; onCambio: (c: Partial<Gimnasio>) => void }) {
  const lista = mancuernasDisponibles(g)
  const tramo = (i: number, c: Partial<Tramo>) => onCambio({ mancuernas: g.mancuernas.map((t, j) => (j === i ? { ...t, ...c } : t)) })
  return (
    <>
      <div className="sec">
        <div className="sec-h"><h2>{t('Mancuernas')}</h2><span className="lbl">{tn(lista.length, '{n} par', '{n} pares')}</span></div>
        {g.mancuernas.map((x, i) => (
          <div key={i} className="card pd mt8">
            <div className="row jb"><span className="lbl">{t('Tramo {n}', { n: i + 1 })}</span>{g.mancuernas.length > 1 && <button className="lnk" onClick={() => onCambio({ mancuernas: g.mancuernas.filter((_, j) => j !== i) })}>{t('Quitar')}</button>}</div>
            <div className="grid3 mt8">
              <div><span className="lbl fl">{t('De')}</span><Stepper className="sm" valor={x.desde} paso={1} min={0.5} etiqueta={t('Tramo {n}: desde', { n: i + 1 })} onCambio={v => tramo(i, { desde: v })} /></div>
              <div><span className="lbl fl">{t('A')}</span><Stepper className="sm" valor={x.hasta} paso={2} min={x.desde} etiqueta={t('Tramo {n}: hasta', { n: i + 1 })} onCambio={v => tramo(i, { hasta: v })} /></div>
              <div><span className="lbl fl">{t('Salto')}</span><Stepper className="sm" valor={x.paso} lista={[0.5, 1, 1.25, 2, 2.5, 5]} etiqueta={t('Tramo {n}: salto', { n: i + 1 })} onCambio={v => tramo(i, { paso: v })} /></div>
            </div>
          </div>
        ))}
        <p className="wlist mono">{lista.length > 16 ? `${lista.slice(0, 14).map(v => num(v)).join(' ')} … ${num(lista[lista.length - 1])}` : lista.map(v => num(v)).join(' ')}</p>
        <button className="lnk mt8" onClick={() => { const u = g.mancuernas[g.mancuernas.length - 1]; onCambio({ mancuernas: [...g.mancuernas, { desde: (u?.hasta ?? 10) + 2, hasta: (u?.hasta ?? 10) + 20, paso: 2 }] }) }}>{t('+ Añadir tramo')}</button>
      </div>
      <div className="sec">
        <div className="sec-h"><h2>{t('Discos')}</h2><span className="lbl">kg</span></div>
        <div className="chips">
          {DISCOS.map(d => (
            <button key={d} className={cx('chip', g.discos.includes(d) && 'on')} onClick={() => onCambio({ discos: g.discos.includes(d) ? g.discos.filter(x => x !== d) : [...g.discos, d].sort((a, b) => a - b) })}>{num(d, 2)}</button>
          ))}
        </div>
        <p className="lbl fl mt16">{t('Barra olímpica')}</p>
        <div className="chips">
          {[20, 15, 10].map(b => <button key={b} className={cx('chip', g.barraKg === b && 'on')} onClick={() => onCambio({ barraKg: b })}>{b} kg</button>)}
        </div>
      </div>
    </>
  )
}
