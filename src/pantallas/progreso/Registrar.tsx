// PRO-05 · Registrar medidas
import { useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { leerMediciones } from '../../datos/consultas'
import { apuntarMedicion } from '../../datos/acciones/cuerpo'
import type { Bascula, Medicion, OrigenMedicion } from '../../datos/tipos'
import { leerNumero, num } from '../../dominio/formato'
import { fechaCorta, horaActual, hoyISO, fechaDeCampo } from '../../dominio/fechas'
import { ultimoValor, type PuntoFecha } from '../../dominio/tendencias'
import { Cab, Chip, cx, Ico, Pantalla, Stepper, useUnaVez } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { ORIGENES } from './comun'
import { PERIMETROS, type Perimetro } from '../../dominio/medidas'
import { t, tk, tn } from '../../i18n'

type Campo = 'peso' | Perimetro

// Nombres sin traducir (tk): se traducen al pintarlos. Las unidades no se traducen, salvo «años».
const CAMPOS_BASCULA: { k: keyof Bascula; t: string; u: string }[] = [
  { k: 'grasaPct', t: tk('% grasa'), u: '%' },
  { k: 'masaGrasaKg', t: tk('Masa grasa'), u: 'kg' },
  { k: 'masaLibreKg', t: tk('Libre de grasa'), u: 'kg' },
  { k: 'musculoKg', t: tk('Masa muscular'), u: 'kg' },
  { k: 'musculoEsqKg', t: tk('Músc. esquelético'), u: 'kg' },
  { k: 'aguaPct', t: tk('Agua'), u: '%' },
  { k: 'proteinaPct', t: tk('Proteína'), u: '%' },
  { k: 'oseaKg', t: tk('Masa ósea'), u: 'kg' },
  { k: 'visceral', t: tk('G. visceral'), u: '' },
  { k: 'subcutaneaPct', t: tk('G. subcutánea'), u: '%' },
  { k: 'basalKcal', t: tk('Basal'), u: 'kcal' },
  { k: 'edadCorporal', t: tk('Edad corporal'), u: tk('años') },
]

/** Punto de partida del primer + o − si nunca se midió (se ve «—» hasta tocarlo). */
const POR_DEFECTO: Record<Campo, number> = { peso: 75, cintura: 90, cuello: 38, cadera: 100, pecho: 100, brazo: 32, brazoContraido: 34, muslo: 56 }

const signo = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n))}`

/** Dibujo de cómo medir una sola parte (cintura en la pantalla; cuello dentro de «Más medidas»). */
function DibujoMedir({ parte }: { parte: 'cintura' | 'cuello' }) {
  const cintura = parte === 'cintura'
  return (
    <div className="measure reg-medir mt8">
      <svg className="sil-fig" viewBox="0 0 120 150" aria-hidden="true">
        <circle className="sil" cx="60" cy="24" r="15" />
        <path className="sil" d="M53 38h14v10H53zM36 50Q60 44 84 50L100 58Q106 62 106 72L110 126Q110 134 104 134L98 80 92 82 92 150H28L28 82 22 80 16 134Q10 134 10 126L14 72Q14 62 20 58Z" />
        {cintura
          ? <><line className="msr go" x1="20" y1="108" x2="100" y2="108" /><circle className="msr-dot" cx="60" cy="108" r="3" /></>
          : <line className="msr" x1="34" y1="44" x2="86" y2="44" />}
      </svg>
      <div className="measure-key">
        {cintura
          ? <p><span className="kdot go" /><b>{t('Cintura')}</b><small>{t('A la altura del ombligo, sin apretar, después de soltar el aire')}</small></p>
          : <p><span className="kdot blue" /><b>{t('Cuello')}</b><small>{t('Justo bajo la nuez, con la cinta horizontal')}</small></p>}
      </div>
    </div>
  )
}

export function Registrar() {
  const nav = useNav()
  const aviso = useAviso()
  const hoy = hoyISO()
  const ultimos = useLiveQuery(async () => {
    const ms = await leerMediciones()
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
  // El peso viene puesto (el último apuntado) y se guarda tal cual si no se toca nada más, como en «Apuntar peso».
  const [sinPeso, setSinPeso] = useState(false)
  const unaVez = useUnaVez()

  const tocado = (c: Campo) => tocados.includes(c)
  const valor = (c: Campo): number | null => (tocado(c) ? valores[c] ?? null : ultimos?.v[c]?.valor ?? null)
  const cambia = (c: Campo, n: number) => {
    setValores(v => ({ ...v, [c]: n }))
    setTocados(ts => (ts.includes(c) ? ts : [...ts, c]))
  }
  const quitar = (c: Campo) => setTocados(ts => ts.filter(x => x !== c))
  const basculaRellena = CAMPOS_BASCULA.some(c => leerNumero(bas[c.k]) != null)
  const otrosTocados = tocados.some(c => c !== 'peso') || basculaRellena
  // Peso que se guarda: el tocado o, si no se ha tocado nada más, el propuesto. Si solo se mide la cintura,
  // el peso viejo no se vuelve a apuntar como de hoy.
  const pesoAGuardar = sinPeso ? null : tocado('peso') ? valores.peso ?? null : otrosTocados ? null : ultimos?.v.peso?.valor ?? null
  const origenFinal: OrigenMedicion = origen ?? (pesoAGuardar != null || basculaRellena ? 'casa' : 'cinta')

  // Un doble toque no guarda dos mediciones iguales ni hace dos «atrás».
  const guardar = unaVez(async () => {
    const perimetros: NonNullable<Medicion['perimetros']> = {}
    for (const p of PERIMETROS) if (tocado(p.k) && valores[p.k] != null) perimetros[p.k] = valores[p.k]
    const bascula: Bascula = {}
    for (const c of CAMPOS_BASCULA) { const n = leerNumero(bas[c.k]); if (n != null) bascula[c.k] = n }
    const peso = pesoAGuardar
    // Se comprueba al guardar, no al teclear: en el PC el año pasa por «0002…» mientras se escribe.
    if (!fechaDeCampo(fecha)) { aviso(t('Revisa la fecha')); return }
    if (peso == null && !Object.keys(perimetros).length && !Object.keys(bascula).length) {
      aviso(t('Pon al menos una medida para guardar'))
      return
    }
    const m: Medicion = { fecha: `${fecha}T${fecha === hoy ? horaActual() : '08:00'}`, origen: origenFinal }
    if (peso != null) m.pesoKg = peso
    if (Object.keys(perimetros).length) m.perimetros = perimetros
    if (Object.keys(bascula).length) m.bascula = bascula
    await apuntarMedicion(m)
    const antes = ultimos?.v.cintura?.valor
    const delta = perimetros.cintura != null && antes != null ? perimetros.cintura - antes : null
    aviso(delta != null && delta !== 0 ? t('Medidas guardadas · cintura {n} cm', { n: signo(delta) }) : t('Medidas guardadas'))
    nav.atras()
  })

  const etiqueta = (c: Campo, texto: ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
      <span className="lbl">{texto}{tocado(c) && <> <Ico n="check-circle" b className="okc" /></>}</span>
      {tocado(c)
        ? <button type="button" className="lnk small" onClick={() => quitar(c)}>{t('Quitar')}</button>
        : <small className="small muted">{ultimos?.v[c] ? t('la última vez, {fecha}', { fecha: fechaCorta(ultimos.v[c]!.fecha) }) : t('sin datos')}</small>}
    </div>
  )
  // Bajo el peso: cómo se escribe y qué pasa con él al pulsar «Guardar».
  const notaPeso = sinPeso
    ? <p className="small muted mt4 center">{t('El peso no se guarda')} · <button type="button" className="lnk small" onClick={() => setSinPeso(false)}>{t('Guardarlo')}</button></p>
    : (
      <p className="small muted mt4 center">
        {t('Toca el número para escribirlo')}
        {pesoAGuardar != null && <> · <button type="button" className="lnk small" onClick={() => { quitar('peso'); setSinPeso(true) }}>{t('No guardar el peso')}</button></>}
        {pesoAGuardar == null && ultimos?.v.peso && <><br />{t('Si no lo cambias, el peso no se guarda')}</>}
      </p>
    )
  // Sin dato previo se ve «—»; el primer + o − parte de un valor normal (75 kg, 90 cm…), no de 0.
  const paso = (c: Campo, sm: boolean, p: number) => (
    <div className={cx('reg-campo', (tocado(c) || (c === 'peso' && pesoAGuardar != null)) && 'tocado')}>
      <Stepper className={cx(sm && 'sm')} valor={valor(c)} onCambio={n => { if (c === 'peso') setSinPeso(false); cambia(c, valor(c) == null && n <= p ? POR_DEFECTO[c] : n) }} paso={p} min={0} decimales={1} sufijo={c === 'peso' ? 'kg' : 'cm'}
        etiqueta={c === 'peso' ? t('Peso') : t(PERIMETROS.find(x => x.k === c)?.t ?? c)} />
    </div>
  )
  const otros = PERIMETROS.filter(p => p.k !== 'cintura')
  const cambiadosMas = otros.filter(p => tocado(p.k)).length + (basculaRellena ? 1 : 0)
  const hayAlgo = pesoAGuardar != null || otrosTocados
  const hayBasculaAntes = Object.keys(ultimos?.bascula ?? {}).length > 0

  return (
    <Pantalla>
      <Cab atras crumb={t('Cuerpo')} titulo={t('Registrar medidas')} sub={fecha === hoy ? t('Hoy') : fechaDeCampo(fecha) ? t('Del {fecha}', { fecha: fechaCorta(fecha) }) : undefined} />
      <div className="pg">
        <p className="note plain"><Ico n="hand-pointing" /><span>{t('Apunta solo lo que te hayas medido hoy.')}</span></p>

        <div className="mt16">{etiqueta('peso', t('Peso'))}</div>
        {paso('peso', false, 0.1)}
        {notaPeso}

        <div className="mt16">{etiqueta('cintura', t('Cintura'))}</div>
        {paso('cintura', false, 0.5)}
        <p className="small muted mt4 center">{t('Toca el número para escribirlo')}</p>

        <DibujoMedir parte="cintura" />

        <details className="fold mt16" open={masAbierto} onToggle={e => setMasAbierto(e.currentTarget.open)}>
          <summary><Ico n="ruler" className="blue" />{t('Más medidas')} {cambiadosMas > 0 ? <span className="tag ok">{tn(cambiadosMas, '{n} cambiada', '{n} cambiadas')}</span> : <span className="tag">{t('opcional')}</span>}<Ico n="caret-down" /></summary>
          <div className="in">
            <p className="small muted">{t('Toca el número para escribirlo, o usa − y +.')}</p>
            <div className="grid2 mt8">
              {otros.map(p => (
                <div key={p.k}>
                  {etiqueta(p.k, t(p.t))}
                  {paso(p.k, true, 0.5)}
                </div>
              ))}
            </div>
            <DibujoMedir parte="cuello" />

            {/* La báscula, en su propio plegable cerrado: quien solo quiere el brazo no ve 12 casillas. */}
            <details className="fold mt16">
              <summary><Ico n="scales" className="blue" />{t('Datos de la báscula')} {basculaRellena ? <span className="tag ok">{t('rellenos')}</span> : <span className="tag">{t('opcional')}</span>}<Ico n="caret-down" /></summary>
              <div className="in">
                <p className="small muted">{t('Rellena solo lo que te dé tu báscula.')}{hayBasculaAntes ? ` ${t('Lo gris es lo de la última vez.')}` : ''}</p>
                <div className="grid2 mt8">
                  {CAMPOS_BASCULA.map(c => {
                    const ant = ultimos?.bascula[c.k]
                    return (
                      <label key={c.k} className="fl">
                        <span className="lbl fl">{t(c.t)}{c.u && <small className="muted"> · {t(c.u)}</small>}</span>
                        <input className="inp inp-num" inputMode="decimal" value={bas[c.k] ?? ''} placeholder={ant != null ? num(ant) : ''} aria-label={t(c.t)}
                          onChange={e => setBas(b => ({ ...b, [c.k]: e.target.value }))} />
                      </label>
                    )
                  })}
                </div>
              </div>
            </details>

            <p className="lbl fl mt16">{t('Con qué te has medido')}</p>
            <div className="chips">
              {ORIGENES.map(o => <Chip key={o.v} on={origenFinal === o.v} onClick={() => setOrigen(o.v)}><Ico n={o.icono} />{t(o.t)}</Chip>)}
            </div>

            <p className="lbl fl mt16">{t('Fecha')}</p>
            <label className="date-row">
              <input type="date" value={fecha} max={hoy} onChange={e => setFecha(e.target.value)} aria-label={t('Fecha')}
                style={{ border: 0, background: 'transparent', color: 'inherit', font: 'inherit', outline: 'none' }} />
              {fecha === hoy && <span>{t('Hoy')}</span>}
            </label>
          </div>
        </details>

        {!hayAlgo && <p className="small muted center mt12">{t('Pon al menos una medida para poder guardar.')}</p>}
        <div className="dock"><button className={cx('btn', !hayAlgo && 'off')} onClick={() => void guardar()}>{t('Guardar')}</button></div>
      </div>
    </Pantalla>
  )
}
