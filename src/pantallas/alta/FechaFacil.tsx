// ALT · Fecha de nacimiento del alta.
import { useState } from 'react'
import { MESES } from '../../dominio/fechas'
import { t } from '../../i18n'

/**
 * Fecha de nacimiento con tres desplegables (día, mes, año). El calendario del móvil empieza en el año
 * actual y llegar a 1960 cuesta muchos toques; así se elige el año de una lista.
 */
export function FechaFacil({ valor, onCambio }: { valor: string; onCambio: (v: string) => void }) {
  const [a0, m0, d0] = /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor.split('-').map(Number) : [0, 0, 0]
  const [dia, setDia] = useState(d0 || 0)
  const [mes, setMes] = useState(m0 || 0)
  const [anio, setAnio] = useState(a0 || 0)
  const ultimo = new Date().getFullYear() - 10
  const anios = Array.from({ length: ultimo - 1920 + 1 }, (_, i) => ultimo - i)
  const poner = (d: number, m: number, a: number) => {
    setDia(d); setMes(m); setAnio(a)
    if (d && m && a) {
      const dd = Math.min(d, new Date(a, m, 0).getDate())
      onCambio(`${a}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`)
    } else onCambio('')
  }
  return (
    <div className="fecha-facil" role="group" aria-label={t('Fecha de nacimiento')}>
      <select className="inp" aria-label={t('Día de nacimiento')} value={dia || ''} onChange={e => poner(Number(e.target.value), mes, anio)}>
        <option value="">{t('Día')}</option>
        {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
      </select>
      <select className="inp" aria-label={t('Mes de nacimiento')} value={mes || ''} onChange={e => poner(dia, Number(e.target.value), anio)}>
        <option value="">{t('Mes')}</option>
        {MESES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </select>
      <select className="inp" aria-label={t('Año de nacimiento')} value={anio || ''} onChange={e => poner(dia, mes, Number(e.target.value))}>
        <option value="">{t('Año')}</option>
        {anios.map(a => <option key={a} value={a}>{a}</option>)}
      </select>
    </div>
  )
}
