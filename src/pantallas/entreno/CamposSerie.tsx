// Los contadores de una serie por repeticiones o de cardio, iguales en el panel del entreno y al corregir: el peso
// (o el lastre), las reps (por lado, o cada lado aparte si uno salió distinto) y los minutos con sus km.
import type { EjercicioSesion, Serie } from '../../datos/tipos'
import type { Ejercicio } from '../../catalogo/tipos'
import { admiteLastre, claseDistancia, conDistancia, porLado } from '../../catalogo/clasificacion'
import { TOPE_SERIE, type CamposSerie as Campos, type ComoSeApunta } from '../../dominio/sesion'
import { ritmo } from '../../dominio/formato'
import { cx, Ico, Stepper } from '../../ui/componentes'
import { t } from '../../i18n'

const conPesoDe = (e: EjercicioSesion) => e.registro === 'peso' || e.registro === 'mancuerna' || e.registro === 'asistido'

export const etiquetaPeso = (e: EjercicioSesion) => (e.registro === 'asistido' ? t('Ayuda (kg)') : e.registro === 'mancuerna' ? t('Kg por mancuerna') : t('Peso (kg)'))
export const etiquetaReps = (e: EjercicioSesion, lado = false) => (e.registro === 'cardio' ? t('¿Cuántos minutos?') : lado ? t('¿Cuántas por lado?') : t('¿Cuántas has hecho?'))

/** Lastre de partida al tocar «Añadir lastre»: el disco pequeño de casi todos los gimnasios. */
const LASTRE_INICIAL = 2.5
/** Lastre de 0 a 100 kg de 2,5 en 2,5 (tocando el número se escribe cualquiera). */
const PESOS_LASTRE = Array.from({ length: 41 }, (_, i) => i * 2.5)

/** Cómo se apunta este ejercicio (el del catálogo, si está). */
export function comoSeApunta(e: EjercicioSesion, ej: Ejercicio | undefined): ComoSeApunta {
  return {
    registro: e.registro,
    conPeso: conPesoDe(e),
    lastre: !!ej && e.registro === 'corporal' && admiteLastre(ej),
    porLado: !!ej && porLado(ej),
    distancia: e.registro === 'cardio' && (ej ? conDistancia(ej) : claseDistancia(e.ejercicio) != null),
  }
}

/** Los valores con que arrancan los contadores: los de la serie (o el objetivo del ejercicio). */
export function camposDe(serie: Serie, e: EjercicioSesion): Campos {
  const reps = serie.reps ?? e.repsMin
  return {
    peso: serie.peso, reps, segundos: serie.segundos ?? serie.reps ?? e.repsMin,
    izq: serie.izq ?? reps, der: serie.der ?? reps,
    // Abiertos los dos lados solo si ya se apuntaron distintos.
    separar: serie.izq != null && serie.der != null && serie.izq !== serie.der,
    km: serie.km ?? null,
  }
}

export function CamposSerie({ e, como, lista, v, cambiar, falta }: {
  e: EjercicioSesion; como: ComoSeApunta; lista: number[]; v: Campos; cambiar: (c: Partial<Campos>) => void; falta?: 'peso' | 'reps' | null
}) {
  const cardio = e.registro === 'cardio'
  // Un lastre ya apuntado se ve siempre (aunque el ejercicio ya no esté en el catálogo); ponerlo, solo donde tiene sentido.
  const conLastre = e.registro === 'corporal' && v.peso != null && v.peso > 0
  const separar = como.porLado && v.separar
  const r = cardio && como.distancia ? ritmo(v.reps, v.km, claseDistancia(e.ejercicio)) : null
  const reps = (
    <div className={cx('pn-f', !como.conPeso && !conLastre && 'w', falta === 'reps' && 'ux-falta')}>
      <span className="lbl ux-pn-lbl">{falta === 'reps' ? (cardio ? t('Pon los minutos') : t('Pon las que has hecho')) : etiquetaReps(e, como.porLado)}</span>
      <Stepper className="tall" valor={v.reps} paso={1} min={1} max={TOPE_SERIE.reps} onCambio={x => cambiar({ reps: x, izq: x, der: x })} etiqueta={cardio ? t('Minutos') : t('Repeticiones')} />
    </div>
  )
  const lado = (cual: 'izq' | 'der') => (
    <div className={cx('pn-f', falta === 'reps' && 'ux-falta')}>
      <span className="lbl ux-pn-lbl">{cual === 'izq' ? t('Izquierda') : t('Derecha')}</span>
      <Stepper className="tall" valor={v[cual]} paso={1} min={1} max={TOPE_SERIE.reps} onCambio={x => cambiar(cual === 'izq' ? { izq: x } : { der: x })}
        etiqueta={cual === 'izq' ? t('Repeticiones con el lado izquierdo') : t('Repeticiones con el lado derecho')} />
    </div>
  )
  return <>
    {/* Con cada lado aparte, el peso va solo arriba y los dos lados juntos debajo (al lado del peso no caben). */}
    {(como.conPeso || conLastre || !separar) && (
      <div className="pn-row">
        {como.conPeso && (
          <div className={cx('pn-f w', falta === 'peso' && 'ux-falta')}>
            <span className="lbl ux-pn-lbl">{falta === 'peso' ? t('Pon aquí los kg') : etiquetaPeso(e)}</span>
            <Stepper className="tall" valor={v.peso} lista={lista} paso={2.5} min={-TOPE_SERIE.peso} max={TOPE_SERIE.peso} onCambio={peso => cambiar({ peso })} etiqueta={t('Peso')} />
          </div>
        )}
        {conLastre && (
          <div className="pn-f w">
            <span className="lbl ux-pn-lbl">{t('Lastre (kg)')}</span>
            {/* Bajar a 0 quita el lastre (y vuelve el enlace para ponerlo). */}
            <Stepper className="tall" valor={v.peso} lista={PESOS_LASTRE} paso={2.5} min={0} max={TOPE_SERIE.peso} onCambio={peso => cambiar({ peso: peso > 0 ? peso : null })} etiqueta={t('Lastre')} />
          </div>
        )}
        {!separar && reps}
        {cardio && como.distancia && (
          <div className="pn-f">
            <span className="lbl ux-pn-lbl">{t('Km · si los sabes')}</span>
            <Stepper className="tall" valor={v.km} paso={0.5} min={0} max={TOPE_SERIE.km} onCambio={km => cambiar({ km: km > 0 ? km : null })} etiqueta={t('Kilómetros')} />
          </div>
        )}
      </div>
    )}
    {separar && <div className="pn-row">{lado('izq')}{lado('der')}</div>}
    {r && <p className="ux-ritmo mono">{t('Ritmo: {ritmo}', { ritmo: r })}</p>}
    {(como.porLado || (como.lastre && !conLastre)) && (
      <div className="ux-pn-extra">
        {como.porLado && (separar
          ? <button type="button" className="lnk" onClick={() => cambiar({ separar: false, izq: v.reps, der: v.reps })}><Ico n="equals" />{t('Igual en los dos lados')}</button>
          : <button type="button" className="lnk" onClick={() => cambiar({ separar: true, izq: v.reps, der: v.reps })}><Ico n="arrows-left-right" />{t('Un lado ha salido distinto')}</button>)}
        {como.lastre && !conLastre && <button type="button" className="lnk" onClick={() => cambiar({ peso: LASTRE_INICIAL })}><Ico n="plus" />{t('Añadir lastre')}</button>}
      </div>
    )}
  </>
}
