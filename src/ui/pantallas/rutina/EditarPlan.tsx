// RUT-04 · Editar plan
import { useState } from 'react'
import { db } from '../../../datos/db'
import type { Bloque, Rutina } from '../../../datos/tipos'
import { ejercicio } from '../../../catalogo/catalogo'
import { duracion } from '../../../dominio/fechas'
import { Cab, Chip, estilo, Ico, Pantalla, Stepper, Th, Vacio } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { useRutina } from '../../datos'
import { abrevDia, filas, materialCorto, minutos, nombreEj, nombreEntreno, seriesPorGrupo, SS, SS_EXPLICA, tituloDia } from './comun'
import { t } from '../../../i18n'

const RANGOS: [number, number][] = [[5, 8], [6, 10], [8, 12], [10, 15], [12, 20]]

export async function guardarRutina(r: Rutina) {
  await db.rutinas.put(r)
}

export function EditarPlan({ ruta }: { ruta: Ruta<'rut-edit'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const r = useRutina()
  const [letra, setLetra] = useState(ruta.d?.letra ?? 'A')
  // Ejercicios con «Más opciones» abierto (lo raro va plegado: a la vista solo nombre, series y cambiar).
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const alternar = (uid: string) => setAbiertos(s => { const n = new Set(s); if (n.has(uid)) n.delete(uid); else n.add(uid); return n })
  // undefined = aún cargando: no enseñar «Aún no tienes rutina» durante un instante.
  if (r === undefined) return <Pantalla><Cab atras crumb={t('Mi plan')} titulo={t('Editar plan')} /><div className="cargando">{t('Cargando…')}</div></Pantalla>
  if (!r) return <Pantalla><Cab atras crumb={t('Mi plan')} titulo={t('Editar plan')} /><div className="pg"><Vacio icono="clipboard-text" titulo={t('Aún no tienes rutina')} accion={t('Crear mi rutina')} onAccion={() => nav.ir('rut-gen')} /></div></Pantalla>
  const dia = r.dias.find(d => d.letra === letra) ?? r.dias[0]!
  const grupos = seriesPorGrupo(r)

  const cambiar = async (f: (bs: Bloque[]) => Bloque[]) => {
    const nueva = structuredClone(r)
    const d = nueva.dias.find(x => x.letra === dia.letra)!
    d.bloques = f(d.bloques)
    await guardarRutina(nueva)
  }
  const mover = (uid: string, dir: -1 | 1) => cambiar(bs => {
    const i = bs.findIndex(b => b.uid === uid)
    const j = i + dir
    if (j < 0 || j >= bs.length) return bs
    const out = [...bs]; [out[i], out[j]] = [out[j]!, out[i]!]
    return out
  })
  const editar = (uid: string, c: Partial<Bloque>) => cambiar(bs => bs.map(b => {
    if (b.uid === uid) return { ...b, ...c }
    // La pareja de superserie comparte series y corta.
    if (b.superserie === uid && (c.series != null || c.fueraEnCorta != null)) return { ...b, ...(c.series != null ? { series: c.series } : {}), ...(c.fueraEnCorta != null ? { fueraEnCorta: c.fueraEnCorta } : {}) }
    return b
  }))
  const quitar = async (b: Bloque) => {
    const antes = structuredClone(r)
    await cambiar(bs => bs.filter(x => x.uid !== b.uid).map(x => (x.superserie === b.uid ? { ...x, superserie: undefined } : x)))
    aviso(t('Ejercicio quitado'), () => void guardarRutina(antes))
  }
  const deshacerSS = async (a: Bloque) => {
    const antes = structuredClone(r)
    await cambiar(bs => bs.map(x => (x.uid === a.uid || x.uid === a.superserie ? { ...x, superserie: undefined } : x)))
    aviso(t('Ya no van seguidos'), () => void guardarRutina(antes))
  }
  const unirSiguiente = (b: Bloque) => cambiar(bs => {
    const i = bs.findIndex(x => x.uid === b.uid)
    const sig = bs[i + 1]
    if (!sig || sig.superserie || b.superserie) return bs
    return bs.map(x => (x.uid === b.uid ? { ...x, superserie: sig.uid } : x.uid === sig.uid ? { ...x, superserie: b.uid, series: b.series } : x))
  })

  const fila = (b: Bloque) => {
    const e = ejercicio(b.ejercicio)
    const rango = RANGOS.findIndex(([a, z]) => a === b.repsMin && z === b.repsMax)
    const i = dia.bloques.findIndex(x => x.uid === b.uid)
    const sig = dia.bloques[i + 1]
    // Se puede juntar con el siguiente si ninguno de los dos va ya en pareja.
    const puedeUnir = !!sig && !b.superserie && !sig.superserie
    const abierta = abiertos.has(b.uid)
    const tiempo = b.registro === 'tiempo'
    return (
      <div key={b.uid} className="edr card">
        <div className="row">
          <Th ej={e} size="s" />
          <span className="tx">
            <b>{nombreEj(e)}</b>
            {/* Las repeticiones, como chip con borde: se ve que se pueden tocar (cada toque pasa al siguiente rango). */}
            {tiempo
              ? <small className="mono">{b.repsMin}-{b.repsMax} s</small>
              : <button type="button" className="chip ux-rut-reps" aria-label={t('Repeticiones: {min} a {max}. Toca para cambiar', { min: b.repsMin, max: b.repsMax })} onClick={() => { const [a, z] = RANGOS[(rango + 1) % RANGOS.length]!; void editar(b.uid, { repsMin: a, repsMax: z }) }}>{b.repsMin}-{b.repsMax} {t('reps')}<Ico n="pencil-simple" /></button>}
            {b.fueraEnCorta && <small className="ux-rut-prisa"><Ico n="scissors" /> {t('Se quita si vas con prisa')}</small>}
          </span>
          <Stepper className="sm mini ux-rut-ser" valor={b.series} paso={1} min={1} max={8} onCambio={v => editar(b.uid, { series: v })} etiqueta={t('Series')} sufijo={t('series')} />
        </div>
        <div className="edr-act">
          <button className="lnk" onClick={() => nav.hoja('sheet-elegir', { modo: 'cambiar', letra: dia.letra, uid: b.uid, id: b.ejercicio })}><Ico n="swap" />{t('Cambiar ejercicio')}</button>
          <button className="lnk ux-rut-masbtn" aria-expanded={abierta} onClick={() => alternar(b.uid)}>{t('Más opciones')}<Ico n={abierta ? 'caret-up' : 'caret-down'} /></button>
        </div>
        {abierta && (
          <div className="ux-rut-mas">
            <p className="small muted">{t('Esfuerzo {rpe}/10 · descanso {tiempo}', { rpe: b.rpe, tiempo: duracion(b.descanso) })}</p>
            <div className="ux-rut-mas-acc">
              <button className="chip" onClick={() => nav.hoja('sheet-elegir', { modo: 'alternativa', letra: dia.letra, uid: b.uid, id: b.ejercicio })}><Ico n="arrows-left-right" />{t('Si está ocupado')}</button>
              <Chip on={!!b.fueraEnCorta} ck onClick={() => void editar(b.uid, { fueraEnCorta: !b.fueraEnCorta })}><Ico n="scissors" />{t('Fuera si hay prisa')}</Chip>
              {puedeUnir && <button className="chip" onClick={() => void unirSiguiente(b)}><Ico n="link" />{t('Dos seguidos (superserie)')}</button>}
              {i > 0 && <button className="chip" onClick={() => void mover(b.uid, -1)}><Ico n="caret-up" />{t('Subir')}</button>}
              {i < dia.bloques.length - 1 && <button className="chip" onClick={() => void mover(b.uid, 1)}><Ico n="caret-down" />{t('Bajar')}</button>}
              <button className="chip" onClick={() => void quitar(b)}><Ico n="trash" />{t('Quitar')}</button>
            </div>
            {b.alternativas.length > 0 && <p className="small muted mt8">{t('Si está ocupado: {lista}', { lista: b.alternativas.map(a => `${nombreEj(a)} (${materialCorto(a).toLowerCase()})`).join(' → ') })}</p>}
          </div>
        )}
      </div>
    )
  }

  return (
    <Pantalla>
      <Cab atras crumb={t('Mi plan')} titulo={t('Editar plan')}>
        <div className="chips eq mt12">
          {r.dias.map(d => <Chip key={d.letra} on={d.letra === dia.letra} onClick={() => setLetra(d.letra)}>{d.dia != null ? abrevDia(d) : d.opcional ? t('Extra') : t('Día {letra}', { letra: d.letra })}</Chip>)}
        </div>
      </Cab>
      <div className="pg">
        <h2 className="h3">{dia.opcional ? t('{dia} · opcional', { dia: tituloDia(dia) }) : tituloDia(dia)}{dia.dia != null && <span className="muted ux-rut-sub">{nombreEntreno(dia)}</span>}</h2>
        <p className="small muted mt4">{t('~{min} min · con prisa ~{corta} min', { min: minutos(dia), corta: minutos(dia, true) })}</p>
        <div className="edl mt8">
          {filas(dia.bloques).map(f => Array.isArray(f) ? (
            <div key={f[0].uid} className="ssg">
              <p className="ss-head"><Ico n="link" b />{t('{nombre} (superserie) · {explica}', { nombre: SS(), explica: SS_EXPLICA() })}<button className="lnk" onClick={() => deshacerSS(f[0])}>{t('Separar')}</button></p>
              <div className="edl">{fila(f[0])}{fila(f[1])}</div>
            </div>
          ) : fila(f))}
        </div>
        <button className="more" onClick={() => nav.hoja('sheet-elegir', { modo: 'anadir', letra: dia.letra })}><Ico n="plus" b />{t('Añadir ejercicio')}</button>
        <p className="note mt16"><Ico n="info" /><span>{t('Los cambios se guardan solos. Tu historial no se toca.')}</span></p>

        {/* Lo raro, plegado. El reparto por músculo no se enseña en la semana de prueba: asusta sin motivo. */}
        {!r.calibracion && (
          <details className="fold mt16">
            <summary><Ico n="chart-bar" className="blue" />{t('Ver detalle: series por músculo')}<Ico n="caret-down" /></summary>
            <div className="in">
              <div className="hbars">
                {grupos.map(gr => (
                  <div key={gr.n}>
                    <span>{t(gr.n)}</span>
                    <span className="bar zone" style={estilo({ '--z1': '50%', '--z2': '80%' })}><i style={estilo({ '--w': `${Math.min(100, (gr.v / 20) * 100)}%` })} /></span>
                    <b>{gr.v}</b>
                  </div>
                ))}
              </div>
              <p className="small muted mt12"><span className="zkey" /> {t('Series a la semana. Lo habitual: 10-16 por músculo.')}</p>
            </div>
          </details>
        )}

        <div className="sec">
          <div className="sec-h"><h2>{t('Rehacer la rutina')}</h2></div>
          <p className="small muted">{t('Te propongo una rutina nueva con tus días, tu tiempo y tu gimnasio. Antes de cambiar nada, te la enseño.')}</p>
          <button className="btn ln sm mt8" onClick={() => nav.hoja('sheet-confirmar', { titulo: t('¿Rehacer la rutina desde cero?'), texto: t('Verás una rutina nueva. Si la aceptas con «Usar esta rutina», sustituye a la que tienes ahora, también los cambios que hayas hecho a mano. Tu historial y tus récords se conservan.'), si: t('Ver la rutina nueva'), accion: 'regenerar' })}><Ico n="magic-wand" />{t('Rehacer la rutina desde cero')}</button>
        </div>
      </div>
    </Pantalla>
  )
}
