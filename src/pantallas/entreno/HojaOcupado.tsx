// SES-04 · Máquina ocupada: la del plan → alternativa → otra → reordenar (solo nombres, sin letras A/B/C)
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../datos/db'
import { guardarSesion } from '../../datos/acciones/entreno'
import { marcaDe } from '../../datos/repos'
import { sugerenciaPara } from '../../datos/consultas'
import { catalogoCargado, ejercicio, nombreMaterial } from '../../catalogo/catalogo'
import { tipoRegistro } from '../../catalogo/clasificacion'
import { alternativasDe } from '../../dominio/generador'
import { irA, sustituir } from '../../dominio/sesion'
import { kg } from '../../dominio/formato'
import { cx, Hoja, Ico, Th, useUnaVez } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useGimnasio, useMarcas, usePerfil, useSesionEnCurso } from '../../datos/hooks'
import { materialCorto } from '../rutina/comun'
import { t } from '../../i18n'


export function HojaOcupado({ ruta }: { ruta: Ruta<'sheet-ocup'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const s = useSesionEnCurso()
  const g = useGimnasio()
  const perfil = usePerfil()
  const marcas = useMarcas()
  const idx = ruta.d.idx
  const e = s?.ejercicios[idx]
  const plan = useLiveQuery(async () => {
    if (!s || !e) return [] as string[]
    const r = s.rutinaId != null ? await db.rutinas.get(s.rutinaId) : undefined
    const b = r?.dias.flatMap(d => d.bloques).find(x => x.uid === e.uid)
    const base = b?.alternativas.length ? b.alternativas : alternativasDe(e.planificado, { perfil, gimnasio: g ?? null, marcas, ejercicios: catalogoCargado()?.ejercicios ?? [] })
    return [e.planificado, ...base].filter((x, i, a) => a.indexOf(x) === i)
    // El perfil, el gimnasio y las marcas llegan un instante después: hay que recalcular cuando llegan.
  }, [s?.id, e?.uid, perfil, g?.id, marcas]) ?? []
  const actualEn = Math.max(0, plan.indexOf(e?.ejercicio ?? ''))
  const [paso, setPaso] = useState(actualEn + 1)
  useEffect(() => { setPaso(actualEn + 1) }, [plan.length, actualEn])
  const alt = plan[paso]
  const sug = useLiveQuery(() => (alt && e ? sugerenciaPara(alt, e, g, s?.id) : Promise.resolve(undefined)), [alt, e?.uid, g?.id])
  const ajuste = useLiveQuery(() => (alt ? marcaDe(alt) : Promise.resolve(undefined)), [alt])
  const unaVez = useUnaVez()
  if (s === undefined) return <Hoja titulo={t('Ocupado')}><p className="muted">{t('Cargando…')}</p></Hoja>
  if (!s || !e) return <Hoja titulo={t('Ocupado')}><p className="muted">{t('No hay entreno en curso.')}</p></Hoja>

  const hacer = unaVez(async () => {
    if (!alt) return
    const x = ejercicio(alt)!
    await guardarSesion(sustituir(s, idx, alt, 'ocupado', { peso: sug?.peso ?? null, reps: sug?.reps ?? null }, tipoRegistro(x)))
    nav.hoja(null)
    aviso(`${t('Cambiado a {ejercicio}', { ejercicio: x.nombre })}${sug?.peso != null ? ` · ${kg(sug.peso)} kg` : ''}`)
  })
  const siguiente = s.ejercicios.findIndex((x, i) => i !== idx && x.estado === 'pendiente')
  const abc = (
    <div className="abc">
      {plan.map((id, i) => (
        <span key={id} style={{ display: 'contents' }}>
          {i > 0 && <Ico n="arrow-right" />}
          <span className={cx(i < paso && 'x', i === paso && 'on')}>{materialCorto(id)}</span>
        </span>
      ))}
    </div>
  )
  if (!alt) return (
    <Hoja>
      {abc}
      <div className="empty pd">
        <span className="empty-ic"><Ico n="arrows-down-up" /></span>
        <h3 className="h3">{t('Está todo ocupado')}</h3>
        {siguiente >= 0 ? <p className="muted">{t('Haz antes {ejercicio} y vuelve luego.', { ejercicio: ejercicio(s.ejercicios[siguiente]!.ejercicio)?.nombre.toLowerCase() ?? '' })}</p> : <p className="muted">{t('Espera un poco o salta este ejercicio.')}</p>}
        {siguiente >= 0 && <button className="btn xl" onClick={async () => { await guardarSesion(irA(s, siguiente)); nav.hoja(null); aviso(t('Reordenado: ahora {ejercicio}', { ejercicio: ejercicio(s.ejercicios[siguiente]!.ejercicio)?.nombre ?? '' })) }}>{t('Hacerlo ahora')}</button>}
        <button className="btn gry sm mt8" onClick={() => { nav.hoja(null); aviso(t('Vale. Vuelve a probar en un par de minutos')) }}>{t('Esperar')}</button>
        <button className="btn ln sm mt8" onClick={() => setPaso(actualEn + 1)}>{t('Volver a la primera alternativa')}</button>
      </div>
    </Hoja>
  )
  const x = ejercicio(alt)!
  return (
    <Hoja>
      {abc}
      <div className="sh-h"><div><h2>{paso === actualEn + 1 ? t('{ejercicio} ocupado', { ejercicio: ejercicio(e.ejercicio)?.nombre ?? '' }) : t('También ocupada')}</h2><p className="sub">{paso >= plan.length - 1 ? t('Si está ocupada, haz esta (es la última):') : t('Si está ocupada, haz esta:')}</p></div></div>
      <div className="altc card">
        <Th ej={x} size="l" />
        <div className="grow">
          <b>{x.nombre}</b>
          <div className="spec flat mt4">
            <p><span>{t('Peso sugerido')}</span><b className="okc">{sug?.peso != null ? `${kg(sug.peso)} kg × ${e.repsMin}-${e.repsMax}` : sug?.accion === 'primera' ? t('Primera vez: cómodo') : t('{n} reps', { n: `${e.repsMin}-${e.repsMax}` })}</b></p>
            {ajuste?.ajustes && <p><span>{t('Tu ajuste')}</span><b>{ajuste.ajustes}</b></p>}
            <p><span>{t('Material')}</span><b>{nombreMaterial(x.material)}</b></p>
          </div>
        </div>
      </div>
      <button className="btn xl mt12" onClick={() => void hacer()}>{t('Hacer esta')}</button>
      <button className="btn gry sm mt8" onClick={() => setPaso(p => p + 1)}>{t('También ocupada')}</button>
      {paso > actualEn + 1 && <button className="btn ln sm mt8" onClick={() => setPaso(actualEn + 1)}>{t('Volver a {destino}', { destino: plan[actualEn + 1] ? ejercicio(plan[actualEn + 1]!)?.nombre ?? t('la primera alternativa') : t('la primera alternativa') })}</button>}
      <p className="small muted mt12 center">{t('Recordamos qué variante haces cada día.')}</p>
    </Hoja>
  )
}
