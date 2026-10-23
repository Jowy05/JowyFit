// INI-02 · Apuntar peso: el número se escribe directamente (cualquier decimal) o con − y + de 0,5 en 0,5; el origen y los datos
// de la báscula, plegados; la tendencia solo cuando ya hay datos.
import { useEffect, useState } from 'react'
import { apuntarMedicion } from '../../datos/acciones/cuerpo'
import type { Bascula, OrigenMedicion } from '../../datos/tipos'
import { horaActual, hoyISO } from '../../dominio/fechas'
import { leerNumero, num } from '../../dominio/formato'
import { lineaSpark } from '../../ui/graficas'
import { tendenciaPeso } from '../../dominio/tendencias'
import { Chip, Hoja, Ico, useUnaVez } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useMediciones } from '../../datos/hooks'
import { t, tc, tk } from '../../i18n'

// Nombres marcados con tk(): se traducen al pintarlos (con nombreCampo).
const CAMPOS: { k: keyof Bascula; t: string; u: string; paso: number }[] = [
  { k: 'grasaPct', t: '% grasa', u: '%', paso: 0.1 },
  { k: 'musculoKg', t: tk('Músculo'), u: 'kg', paso: 0.1 },
  { k: 'aguaPct', t: tk('Agua'), u: '%', paso: 0.1 },
  { k: 'visceral', t: tk('G. visceral'), u: '', paso: 1 },
  { k: 'oseaKg', t: tk('Masa ósea'), u: 'kg', paso: 0.1 },
  { k: 'basalKcal', t: tk('Basal'), u: 'kcal', paso: 1 },
]

const MIN = 25, MAX = 300
// La grasa con contexto: en catalán y en inglés el «%» ya va detrás, entre paréntesis.
const nombreCampo = (c: typeof CAMPOS[number]) => (c.k === 'grasaPct' ? tc('báscula', '% grasa') : t(c.t))

const textoTendencia = (k: number | null) =>
  k == null ? t('Aún pocos datos') : Math.abs(k) < 0.1 ? t('Estable') : t('{n} kg/semana', { n: `${k > 0 ? '+' : '−'}${num(Math.abs(k))}` })

export function HojaPeso() {
  const nav = useNav()
  const aviso = useAviso()
  const hoy = hoyISO()
  const hora = horaActual()
  const mediciones = useMediciones()
  // El peso se guarda como texto: así se puede escribir «72,5» tecla a tecla sin que desaparezca la coma.
  const [texto, setTexto] = useState<string | null>(null)
  // Báscula de casa por defecto; se cambia dentro de «Más datos de la báscula».
  const [origen, setOrigen] = useState<OrigenMedicion>('casa')
  const [bascula, setBascula] = useState<Partial<Record<keyof Bascula, string>>>({})
  const unaVez = useUnaVez()
  useEffect(() => {
    if (texto != null || !mediciones) return
    const ultima = [...mediciones].filter(m => m.pesoKg != null).sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
    setTexto(num(ultima?.pesoKg ?? 75))
  }, [mediciones, texto])
  const tend = tendenciaPeso(mediciones ?? [], hoy)
  const peso = texto == null ? null : leerNumero(texto)

  // − y + van de medio en medio kilo y caen en múltiplos de 0,5: 82,3 → + → 82,5.
  const mover = (dir: 1 | -1) => {
    const base = peso ?? 75
    const medios = dir > 0 ? Math.floor(base * 2 + 1e-9) + 1 : Math.ceil(base * 2 - 1e-9) - 1
    setTexto(num(Math.min(MAX, Math.max(MIN, medios / 2))))
  }

  const guardar = unaVez(async () => {
    if (peso == null || peso < MIN || peso > MAX) { aviso(t('Revisa el peso')); return }
    const datos: Bascula = {}
    for (const c of CAMPOS) {
      const v = leerNumero(bascula[c.k])
      if (v != null) datos[c.k] = v

    }
    const kg = Math.round(peso * 10) / 10
    const deshacer = await apuntarMedicion({ fecha: `${hoy}T${hora}`, origen, pesoKg: kg, bascula: Object.keys(datos).length ? datos : undefined })
    const nueva = tendenciaPeso([...(mediciones ?? []), { fecha: `${hoy}T${hora}`, origen, pesoKg: kg }], hoy)
    nav.hoja(null)
    const resto = nueva.kgSemana == null ? t('Sigue apuntándolo para ver la tendencia') : t('Tendencia: {tendencia}', { tendencia: textoTendencia(nueva.kgSemana).toLowerCase() })
    aviso(t('Guardado: {n} kg. {resto}', { n: num(kg), resto }), deshacer)
  })

  return (
    <Hoja titulo={t('Apuntar peso')} sub={t('Mejor por la mañana, en ayunas')}>
      <div className="stp big ux-peso" role="group" aria-label={t('Peso')}>
        <button type="button" aria-label={t('Menos')} onClick={() => mover(-1)}><Ico n="minus" b /></button>
        <label className="v">
          <input
            className="val inp-num" inputMode="decimal" enterKeyHint="done" aria-label={t('Peso en kg')}
            value={texto ?? ''} placeholder="—"
            onChange={e => setTexto(e.target.value.replace(/[^\d.,]/g, ''))}
            onFocus={e => e.target.select()}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          />
          <small>kg</small>
        </label>
        <button type="button" aria-label={t('Más')} onClick={() => mover(1)}><Ico n="plus" b /></button>
      </div>
      <p className="small muted mt8 center">{t('Toca el número para escribirlo, o usa − y +')}</p>
      <details className="fold mt16">
        <summary><Ico n="scales" className="blue" />{t('Más datos de la báscula')}<Ico n="caret-down" /></summary>
        <div className="in">
          <p className="lbl fl">{t('¿Qué báscula?')}</p>
          <div className="chips">
            <Chip on={origen === 'casa'} onClick={() => setOrigen('casa')}><Ico n="house" />{t('De casa')}</Chip>
            <Chip on={origen === 'gimnasio'} onClick={() => setOrigen('gimnasio')}><Ico n="barbell" />{t('Del gimnasio')}</Chip>
            <Chip on={origen === 'otra'} onClick={() => setOrigen('otra')}>{t('Otra')}</Chip>
          </div>
          <div className="grid2 mt12">
            {CAMPOS.map(c => (
              <label key={c.k} className="campo-mini">
                <span className="lbl">{nombreCampo(c)}{c.u ? ` (${c.u})` : ''}</span>
                <input
                  className="inp inp-num" inputMode="decimal" placeholder="—" aria-label={nombreCampo(c)}
                  value={bascula[c.k] ?? ''}
                  onChange={e => { const v = e.target.value; setBascula(b => ({ ...b, [c.k]: v })) }}
                />
              </label>
            ))}
          </div>
          <button className="lnk mt12" onClick={() => nav.ir('pro-reg', undefined, 'pro')}>{t('Todos los campos y medidas')} <Ico n="caret-right" /></button>
        </div>
      </details>
      {/* La tendencia solo cuando ya dice algo (con un solo dato confunde). */}
      {tend.kgSemana != null && (
        <div className="card pd mt12 row">
          {tend.puntos.length >= 2
            ? <svg className="spark" viewBox="0 0 120 40" aria-hidden="true"><polyline points={lineaSpark(tend.puntos.slice(-10))} className="sp-l" /></svg>
            : <Ico n="chart-line" className="blue" />}
          <div className="grow">
            <span className="lbl">{t('Tendencia')}</span>
            <p className="mono"><b>{textoTendencia(tend.kgSemana)}</b></p>
          </div>
        </div>
      )}
      <button className="btn mt16" onClick={() => void guardar()}>{t('Guardar')}</button>
    </Hoja>
  )
}
