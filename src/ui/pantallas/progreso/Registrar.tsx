// PRO-05 · Registrar medidas
import { useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import type { Bascula, Medicion, OrigenMedicion } from '../../../datos/tipos'
import { num } from '../../../dominio/calculos'
import { fechaCorta, horaActual, hoyISO } from '../../../dominio/fechas'
import { ultimoValor, type PuntoFecha } from '../../../dominio/tendencias'
import { Cab, Chip, cx, Ico, Pantalla, Stepper, useUnaVez } from '../../comp'
import { useNav } from '../../nav'
import { useAviso } from '../../aviso'
import { Medir } from '../alta/Alta'
import { ORIGENES, PERIMETROS, type Perimetro } from './comun'

type Campo = 'peso' | Perimetro

const CAMPOS_BASCULA: { k: keyof Bascula; t: string; u: string }[] = [
  { k: 'grasaPct', t: '% grasa', u: '%' },
  { k: 'masaGrasaKg', t: 'Masa grasa', u: 'kg' },
  { k: 'masaLibreKg', t: 'Libre de grasa', u: 'kg' },
  { k: 'musculoKg', t: 'Masa muscular', u: 'kg' },
  { k: 'musculoEsqKg', t: 'Músc. esquelético', u: 'kg' },
  { k: 'aguaPct', t: 'Agua', u: '%' },
  { k: 'proteinaPct', t: 'Proteína', u: '%' },
  { k: 'oseaKg', t: 'Masa ósea', u: 'kg' },
  { k: 'visceral', t: 'G. visceral', u: '' },
  { k: 'subcutaneaPct', t: 'G. subcutánea', u: '%' },
  { k: 'basalKcal', t: 'Basal', u: 'kcal' },
  { k: 'edadCorporal', t: 'Edad corporal', u: 'años' },
]

/** Punto de partida del primer + o − si nunca se midió (se ve «—» hasta tocarlo). */
const POR_DEFECTO: Record<Campo, number> = { peso: 75, cintura: 90, cuello: 38, cadera: 100, pecho: 100, brazo: 32, brazoContraido: 34, muslo: 56 }

const leerNumero = (s: string | undefined) => {
  const n = parseFloat((s ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
const signo = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n))}`

export function Registrar() {
  const nav = useNav()
  const aviso = useAviso()
  const hoy = hoyISO()
  const ultimos = useLiveQuery(async () => {
    const ms = await db.mediciones.toArray()
    const v: Partial<Record<Campo, PuntoFecha>> = {}
    const peso = ultimoValor(ms, m => m.pesoKg)
    if (peso) v.peso = peso
    for (const p of PERIMETROS) { const u = ultimoValor(ms, m => m.perimetros?.[p.k]); if (u) v[p.k] = u }
    const conBascula = ms.filter(m => m.bascula && Object.keys(m.bascula).length).sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
    return { v, bascula: conBascula?.bascula ?? {} }
  }, [])
  const [valores, setValores] = useState<Partial<Record<Campo, number>>>({})
  const [tocados, setTocados] = useState<Campo[]>([])
  const [bas, setBas] = useState<Partial<Record<keyof Bascula, string>>>({})
  const [origen, setOrigen] = useState<OrigenMedicion | null>(null)
  const [fecha, setFecha] = useState(hoy)
  const [masAbierto, setMasAbierto] = useState(false)
  const unaVez = useUnaVez()

  const tocado = (c: Campo) => tocados.includes(c)
  const valor = (c: Campo): number | null => (tocado(c) ? valores[c] ?? null : ultimos?.v[c]?.valor ?? null)
  const cambia = (c: Campo, n: number) => {
    setValores(v => ({ ...v, [c]: n }))
    setTocados(t => (t.includes(c) ? t : [...t, c]))
  }
  const quitar = (c: Campo) => setTocados(t => t.filter(x => x !== c))
  const basculaRellena = CAMPOS_BASCULA.some(c => leerNumero(bas[c.k]) != null)
  const origenFinal: OrigenMedicion = origen ?? (tocado('peso') || basculaRellena ? 'casa' : 'cinta')

  // Doble toque: dos mediciones iguales y dos «atrás».
  const guardar = unaVez(async () => {
    const perimetros: NonNullable<Medicion['perimetros']> = {}
    for (const p of PERIMETROS) if (tocado(p.k) && valores[p.k] != null) perimetros[p.k] = valores[p.k]
    const bascula: Bascula = {}
    for (const c of CAMPOS_BASCULA) { const n = leerNumero(bas[c.k]); if (n != null) bascula[c.k] = n }
    const peso = tocado('peso') ? valores.peso : undefined
    if (peso == null && !Object.keys(perimetros).length && !Object.keys(bascula).length) {
      aviso('Cambia al menos una medida para guardar')
      return
    }
    const m: Medicion = { fecha: `${fecha}T${fecha === hoy ? horaActual() : '08:00'}`, origen: origenFinal }
    if (peso != null) m.pesoKg = peso
    if (Object.keys(perimetros).length) m.perimetros = perimetros
    if (Object.keys(bascula).length) m.bascula = bascula
    await db.mediciones.add(m)
    const antes = ultimos?.v.cintura?.valor
    const delta = perimetros.cintura != null && antes != null ? perimetros.cintura - antes : null
    aviso(delta != null && delta !== 0 ? `Medidas guardadas · cintura ${signo(delta)} cm` : 'Medidas guardadas')
    nav.atras()
  })

  const etiqueta = (c: Campo, texto: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
      <span className="lbl">{texto}{tocado(c) && <> <Ico n="check-circle" b className="okc" /></>}</span>
      {tocado(c)
        ? <button type="button" className="lnk small" onClick={() => quitar(c)}>Quitar</button>
        : <small className="small muted">{ultimos?.v[c] ? `la última vez, ${fechaCorta(ultimos.v[c]!.fecha)}` : 'sin datos'}</small>}
    </div>
  )
  // Sin dato previo se ve «—»; el primer + o − parte de un valor normal (75 kg, 90 cm…), no de 0.
  const paso = (c: Campo, sm: boolean, p: number) => (
    <div className={cx('reg-campo', tocado(c) && 'tocado')}>
      <Stepper className={cx(sm && 'sm')} valor={valor(c)} onCambio={n => cambia(c, valor(c) == null && n <= p ? POR_DEFECTO[c] : n)} paso={p} min={0} decimales={1} sufijo={c === 'peso' ? 'kg' : 'cm'}
        etiqueta={c === 'peso' ? 'Peso' : PERIMETROS.find(x => x.k === c)?.t ?? c} />
    </div>
  )
  const otros = PERIMETROS.filter(p => p.k !== 'cintura')
  const cambiadosMas = otros.filter(p => tocado(p.k)).length + (basculaRellena ? 1 : 0)
  const hayAlgo = tocados.length > 0 || basculaRellena

  return (
    <Pantalla>
      <Cab atras crumb="Cuerpo" titulo="Registrar medidas" sub={fecha === hoy ? 'Hoy' : `Del ${fechaCorta(fecha)}`} />
      <div className="pg">
        <p className="note plain"><Ico n="hand-pointing" /><span>Cambia con <b>+</b> y <b>−</b> lo que te hayas medido. Lo que no toques no se guarda.</span></p>

        <div className="mt16">{etiqueta('peso', 'Peso')}</div>
        {paso('peso', false, 0.1)}

        <div className="mt16">{etiqueta('cintura', 'Cintura')}</div>
        {paso('cintura', false, 0.5)}

        <Medir />

        <details className="fold mt16" open={masAbierto} onToggle={e => setMasAbierto(e.currentTarget.open)}>
          <summary><Ico n="ruler" className="blue" />Más medidas {cambiadosMas > 0 ? <span className="tag ok">{cambiadosMas} cambiada{cambiadosMas === 1 ? '' : 's'}</span> : <span className="tag">opcional</span>}<Ico n="caret-down" /></summary>
          <div className="in">
            <div className="grid2 mt8">
              {otros.map(p => (
                <div key={p.k}>
                  {etiqueta(p.k, p.t)}
                  {paso(p.k, true, 0.5)}
                </div>
              ))}
            </div>

            <p className="lbl fl mt16"><Ico n="scales" className="blue" /> Datos de la báscula</p>
            <p className="small muted">Rellena solo lo que te dé tu báscula. Lo gris es lo de la última vez.</p>
            <div className="grid2 mt8">
              {CAMPOS_BASCULA.map(c => {
                const ant = ultimos?.bascula[c.k]
                return (
                  <label key={c.k} className="fl">
                    <span className="lbl fl">{c.t}{c.u && <small className="muted"> · {c.u}</small>}</span>
                    <input className="inp inp-num" inputMode="decimal" value={bas[c.k] ?? ''} placeholder={ant != null ? num(ant) : ''}
                      onChange={e => setBas(b => ({ ...b, [c.k]: e.target.value }))} />
                  </label>
                )
              })}
            </div>

            <p className="lbl fl mt16">Con qué te has medido</p>
            <div className="chips">
              {ORIGENES.map(o => <Chip key={o.v} on={origenFinal === o.v} onClick={() => setOrigen(o.v)}><Ico n={o.icono} />{o.t}</Chip>)}
            </div>

            <p className="lbl fl mt16">Fecha</p>
            <label className="date-row">
              <input type="date" value={fecha} max={hoy} onChange={e => e.target.value && setFecha(e.target.value)} aria-label="Fecha"
                style={{ border: 0, background: 'transparent', color: 'inherit', font: 'inherit', outline: 'none' }} />
              {fecha === hoy && <span>Hoy</span>}
            </label>
          </div>
        </details>

        {!hayAlgo && <p className="small muted center mt12">Toca + o − en alguna medida para poder guardar.</p>}
        <div className="dock"><button className={cx('btn', !hayAlgo && 'off')} onClick={() => void guardar()}>Guardar</button></div>
      </div>
    </Pantalla>
  )
}
