// INI-02 · Apuntar peso: de 0,1 en 0,1, origen, datos de la báscula opcionales y tendencia.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import type { Bascula, OrigenMedicion } from '../../../datos/tipos'
import { horaActual, hoyISO } from '../../../dominio/fechas'
import { num } from '../../../dominio/calculos'
import { lineaSpark, tendenciaPeso } from '../../../dominio/peso'
import { Chip, Hoja, Ico, Stepper, useUnaVez } from '../../comp'
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

const textoTendencia = (k: number | null) =>
  k == null ? 'Aún pocos datos' : Math.abs(k) < 0.1 ? 'Estable' : `${k > 0 ? '+' : '−'}${num(Math.abs(k))} kg/semana`

export function HojaPeso() {
  const nav = useNav()
  const aviso = useAviso()
  const hoy = hoyISO()
  const hora = horaActual()
  const mediciones = useLiveQuery(() => db.mediciones.toArray(), [])
  const [peso, setPeso] = useState<number | null>(null)
  const [origen, setOrigen] = useState<OrigenMedicion>('casa')
  // Se guarda el texto tal cual: si se convirtiera a número en cada tecla, no se podría escribir «72,5» (la coma desaparece).
  const [bascula, setBascula] = useState<Partial<Record<keyof Bascula, string>>>({})
  const unaVez = useUnaVez()
  useEffect(() => {
    if (peso != null || !mediciones) return
    const ultima = [...mediciones].filter(m => m.pesoKg != null).sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
    setPeso(ultima?.pesoKg ?? 75)
    if (ultima) setOrigen(ultima.origen === 'gimnasio' ? 'gimnasio' : ultima.origen === 'otra' ? 'otra' : 'casa')
  }, [mediciones, peso])
  const t = tendenciaPeso(mediciones ?? [], hoy)

  const guardar = unaVez(async () => {
    if (peso == null || peso < 25 || peso > 300) { aviso('Revisa el peso'); return }
    const datos: Bascula = {}
    for (const c of CAMPOS) {
      const v = parseFloat((bascula[c.k] ?? '').replace(',', '.'))
      if (Number.isFinite(v)) datos[c.k] = v
    }
    const id = await db.mediciones.add({ fecha: `${hoy}T${hora}`, origen, pesoKg: Math.round(peso * 10) / 10, bascula: Object.keys(datos).length ? datos : undefined })
    const nueva = tendenciaPeso([...(mediciones ?? []), { fecha: `${hoy}T${hora}`, origen, pesoKg: peso }], hoy)
    nav.hoja(null)
    aviso(`Guardado: ${num(peso)} kg. ${nueva.kgSemana == null ? 'Sigue apuntándolo para ver la tendencia' : `Tendencia: ${textoTendencia(nueva.kgSemana).toLowerCase()}`}`, () => { void db.mediciones.delete(id) })
  })

  return (
    <Hoja titulo="Apuntar peso" sub={`Hoy · ${hora.replace(/^0/, '')} · en ayunas y después del baño`}>
      <Stepper className="big" valor={peso} onCambio={setPeso} paso={0.1} min={25} max={300} sufijo="kg" decimales={1} etiqueta="Peso" />
      <p className="small muted mt8 center">Toca el número para escribirlo · de 0,1 en 0,1 kg</p>
      <p className="lbl fl mt16">Origen</p>
      <div className="chips">
        <Chip on={origen === 'casa'} onClick={() => setOrigen('casa')}><Ico n="house" />Báscula de casa</Chip>
        <Chip on={origen === 'gimnasio'} onClick={() => setOrigen('gimnasio')}><Ico n="barbell" />Del gimnasio</Chip>
        <Chip on={origen === 'otra'} onClick={() => setOrigen('otra')}>Otra</Chip>
      </div>
      <details className="fold mt16">
        <summary><Ico n="scales" className="blue" />Añadir datos de la báscula<Ico n="caret-down" /></summary>
        <div className="in">
          <div className="grid2">
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
      <div className="card pd mt12 row">
        {t.puntos.length >= 2
          ? <svg className="spark" viewBox="0 0 120 40" aria-hidden="true"><polyline points={lineaSpark(t.puntos.slice(-10))} className="sp-l" /></svg>
          : <Ico n="chart-line" className="blue" />}
        <div className="grow">
          <span className="lbl">Tendencia</span>
          <p className="mono"><b>{textoTendencia(t.kgSemana)}</b></p>
          <p className="small muted">Lo importante es la cintura</p>
        </div>
      </div>
      <button className="btn mt16" onClick={() => void guardar()}>Guardar</button>
    </Hoja>
  )
}
