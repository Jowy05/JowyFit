// INI-02 · Apuntar peso: el número se escribe directamente (o con − y + de 0,1 en 0,1); el origen y los datos
// de la báscula, plegados; la tendencia solo cuando ya hay datos.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import type { Bascula, OrigenMedicion } from '../../../datos/tipos'
import { horaActual, hoyISO } from '../../../dominio/fechas'
import { num } from '../../../dominio/calculos'
import { lineaSpark, tendenciaPeso } from '../../../dominio/peso'
import { Chip, Hoja, Ico, useUnaVez } from '../../comp'
import { useNav } from '../../nav'
import { useAviso } from '../../aviso'

const CAMPOS: { k: keyof Bascula; t: string; u: string; paso: number }[] = [
  { k: 'grasaPct', t: '% grasa', u: '%', paso: 0.1 },
  { k: 'musculoKg', t: 'Músculo', u: 'kg', paso: 0.1 },
  { k: 'aguaPct', t: 'Agua', u: '%', paso: 0.1 },
  { k: 'visceral', t: 'G. visceral', u: '', paso: 1 },
  { k: 'oseaKg', t: 'Masa ósea', u: 'kg', paso: 0.1 },
  { k: 'basalKcal', t: 'Basal', u: 'kcal', paso: 1 },
]

const MIN = 25, MAX = 300

const textoTendencia = (k: number | null) =>
  k == null ? 'Aún pocos datos' : Math.abs(k) < 0.1 ? 'Estable' : `${k > 0 ? '+' : '−'}${num(Math.abs(k))} kg/semana`

const formato = (v: number) => v.toLocaleString('es-ES', { maximumFractionDigits: 1 })
const leer = (t: string): number | null => {
  const v = parseFloat(t.replace(',', '.'))
  return Number.isFinite(v) ? v : null
}

export function HojaPeso() {
  const nav = useNav()
  const aviso = useAviso()
  const hoy = hoyISO()
  const hora = horaActual()
  const mediciones = useLiveQuery(() => db.mediciones.toArray(), [])
  // El peso se guarda como texto: así se puede escribir «72,5» tecla a tecla sin que desaparezca la coma.
  const [texto, setTexto] = useState<string | null>(null)
  // Báscula de casa por defecto; se cambia dentro de «Más datos de la báscula».
  const [origen, setOrigen] = useState<OrigenMedicion>('casa')
  const [bascula, setBascula] = useState<Partial<Record<keyof Bascula, string>>>({})
  const unaVez = useUnaVez()
  useEffect(() => {
    if (texto != null || !mediciones) return
    const ultima = [...mediciones].filter(m => m.pesoKg != null).sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
    setTexto(formato(ultima?.pesoKg ?? 75))
  }, [mediciones, texto])
  const t = tendenciaPeso(mediciones ?? [], hoy)
  const peso = texto == null ? null : leer(texto)

  const mover = (dir: 1 | -1) => {
    const base = peso ?? 75
    setTexto(formato(Math.min(MAX, Math.max(MIN, Math.round((base + dir * 0.1) * 10) / 10))))
  }

  const guardar = unaVez(async () => {
    if (peso == null || peso < MIN || peso > MAX) { aviso('Revisa el peso'); return }
    const datos: Bascula = {}
    for (const c of CAMPOS) {
      const v = parseFloat((bascula[c.k] ?? '').replace(',', '.'))
      if (Number.isFinite(v)) datos[c.k] = v
    }
    const kg = Math.round(peso * 10) / 10
    const id = await db.mediciones.add({ fecha: `${hoy}T${hora}`, origen, pesoKg: kg, bascula: Object.keys(datos).length ? datos : undefined })
    const nueva = tendenciaPeso([...(mediciones ?? []), { fecha: `${hoy}T${hora}`, origen, pesoKg: kg }], hoy)
    nav.hoja(null)
    aviso(`Guardado: ${num(kg)} kg. ${nueva.kgSemana == null ? 'Sigue apuntándolo para ver la tendencia' : `Tendencia: ${textoTendencia(nueva.kgSemana).toLowerCase()}`}`, () => { void db.mediciones.delete(id) })
  })

  return (
    <Hoja titulo="Apuntar peso" sub="Mejor por la mañana, en ayunas">
      <div className="stp big ux-peso" role="group" aria-label="Peso">
        <button type="button" aria-label="Menos" onClick={() => mover(-1)}><Ico n="minus" b /></button>
        <label className="v">
          <input
            className="val inp-num" inputMode="decimal" enterKeyHint="done" aria-label="Peso en kg"
            value={texto ?? ''} placeholder="—"
            onChange={e => setTexto(e.target.value.replace(/[^\d.,]/g, ''))}
            onFocus={e => e.target.select()}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          />
          <small>kg</small>
        </label>
        <button type="button" aria-label="Más" onClick={() => mover(1)}><Ico n="plus" b /></button>
      </div>
      <p className="small muted mt8 center">Toca el número para escribirlo, o usa − y +</p>
      <details className="fold mt16">
        <summary><Ico n="scales" className="blue" />Más datos de la báscula<Ico n="caret-down" /></summary>
        <div className="in">
          <p className="lbl fl">¿Qué báscula?</p>
          <div className="chips">
            <Chip on={origen === 'casa'} onClick={() => setOrigen('casa')}><Ico n="house" />De casa</Chip>
            <Chip on={origen === 'gimnasio'} onClick={() => setOrigen('gimnasio')}><Ico n="barbell" />Del gimnasio</Chip>
            <Chip on={origen === 'otra'} onClick={() => setOrigen('otra')}>Otra</Chip>
          </div>
          <div className="grid2 mt12">
            {CAMPOS.map(c => (
              <label key={c.k} className="campo-mini">
                <span className="lbl">{c.t}{c.u ? ` (${c.u})` : ''}</span>
                <input
                  className="inp inp-num" inputMode="decimal" placeholder="—" aria-label={c.t}
                  value={bascula[c.k] ?? ''}
                  onChange={e => { const v = e.target.value; setBascula(b => ({ ...b, [c.k]: v })) }}
                />
              </label>
            ))}
          </div>
          <button className="lnk mt12" onClick={() => nav.ir('pro-reg', undefined, 'pro')}>Todos los campos y medidas <Ico n="caret-right" /></button>
        </div>
      </details>
      {/* La tendencia solo cuando ya dice algo (con un solo dato confundía). */}
      {t.kgSemana != null && (
        <div className="card pd mt12 row">
          {t.puntos.length >= 2
            ? <svg className="spark" viewBox="0 0 120 40" aria-hidden="true"><polyline points={lineaSpark(t.puntos.slice(-10))} className="sp-l" /></svg>
            : <Ico n="chart-line" className="blue" />}
          <div className="grow">
            <span className="lbl">Tendencia</span>
            <p className="mono"><b>{textoTendencia(t.kgSemana)}</b></p>
          </div>
        </div>
      )}
      <button className="btn mt16" onClick={() => void guardar()}>Guardar</button>
    </Hoja>
  )
}
