// COM-08 · Historial de los ajustes de cada 2 semanas: qué objetivo había antes, cuál hay ahora y por qué.
// Va dentro de «Tu objetivo de energía» y, en hoja, desde el consejo de la quincena de Progreso.
import type { AjusteEnergia } from '../../datos/tipos'
import { cambioAjuste, cambioPeso, porqueAjuste } from '../../dominio/ajusteEnergia'
import { fechaCorta } from '../../dominio/fechas'
import { Hoja, Ico } from '../../ui/componentes'
import { useAjustes } from '../../datos/hooks'
import { t } from '../../i18n'

/** Los ajustes, del más nuevo al más viejo. */
export function ListaAjustesEnergia({ historial }: { historial: AjusteEnergia[] }) {
  if (!historial.length) return <p className="small muted">{t('Cada 2 semanas miramos tu cintura y tu peso, y aquí verás el objetivo que te toca.')}</p>
  return (
    <div className="list">
      {[...historial].reverse().map(a => {
        const peso = cambioPeso(a)
        return (
          <div key={a.fecha} className="it col">
            <span className="tx">
              <b>{fechaCorta(a.fecha)}</b>
              <small>{cambioAjuste(a)}{peso ? ` · ${peso}` : ''}</small>
            </span>
            <p className="small"><Ico n="lightbulb" className="blue" /> {porqueAjuste(a)}</p>
          </div>
        )
      })}
    </div>
  )
}

export function HojaAjustesEnergia() {
  const historial = useAjustes().historialEnergia ?? []
  return (
    <Hoja titulo={t('Ajustes de cada 2 semanas')} sub={t('Tu objetivo de comida y por qué cambió')}>
      <ListaAjustesEnergia historial={historial} />
    </Hoja>
  )
}
