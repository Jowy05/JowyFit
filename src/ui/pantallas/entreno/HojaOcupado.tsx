// SES-04 · Máquina ocupada: A → B → C → reordenar
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { marcaDe } from '../../../datos/repos'
import { sugerenciaPara } from '../../../datos/consultas'
import { catalogoCargado, ejercicio, nombreMaterial } from '../../../catalogo/catalogo'
import { tipoRegistro } from '../../../catalogo/clasificacion'
import { alternativasDe } from '../../../dominio/generador'
import { irA, sustituir } from '../../../dominio/sesion'
import { kg } from '../../../dominio/calculos'
import { cx, Hoja, Ico, Th, useUnaVez } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { useGimnasio, useMarcas, usePerfil, useSesionEnCurso } from '../../datos'

const corto = (id: string) => { const e = ejercicio(id); return e?.material ? nombreMaterial(e.material).replace(/^Máquina (de )?/, '') : 'Corporal' }

export function HojaOcupado({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const s = useSesionEnCurso()
  const g = useGimnasio()
  const perfil = usePerfil()
  const marcas = useMarcas()
  const idx = Number(ruta.d?.idx ?? 0)
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
  if (s === undefined) return <Hoja titulo="Ocupado"><p className="muted">Cargando…</p></Hoja>
  if (!s || !e) return <Hoja titulo="Ocupado"><p className="muted">No hay entreno en curso.</p></Hoja>

  const hacer = unaVez(async () => {
    if (!alt) return
    const x = ejercicio(alt)!
    await db.sesiones.put(sustituir(s, idx, alt, 'ocupado', { peso: sug?.peso ?? null, reps: sug?.reps ?? null }, tipoRegistro(x)))
    nav.hoja(null)
    aviso(`Cambiado a ${x.nombre}${sug?.peso != null ? ` · ${kg(sug.peso)} kg` : ''}`)
  })
  const siguiente = s.ejercicios.findIndex((x, i) => i !== idx && x.estado === 'pendiente')
  const abc = (
    <div className="abc">
      {plan.map((id, i) => (
        <span key={id} style={{ display: 'contents' }}>
          {i > 0 && <Ico n="arrow-right" />}
          <span className={cx(i < paso && 'x', i === paso && 'on')}>{'ABC'[i] ?? '·'} · {corto(id)}</span>
        </span>
      ))}
    </div>
  )
  if (!alt) return (
    <Hoja>
      {abc}
      <div className="empty pd">
        <span className="empty-ic"><Ico n="arrows-down-up" /></span>
        <h3 className="h3">Está todo ocupado</h3>
        {siguiente >= 0 ? <p className="muted">Haz antes {ejercicio(s.ejercicios[siguiente]!.ejercicio)?.nombre.toLowerCase()} y vuelve luego.</p> : <p className="muted">Espera un poco o salta este ejercicio.</p>}
        {siguiente >= 0 && <button className="btn xl" onClick={async () => { await db.sesiones.put(irA(s, siguiente)); nav.hoja(null); aviso(`Reordenado: ahora ${ejercicio(s.ejercicios[siguiente]!.ejercicio)?.nombre}`) }}>Hacerlo ahora</button>}
        <button className="btn gry sm mt8" onClick={() => { nav.hoja(null); aviso('Vale. Vuelve a probar en un par de minutos') }}>Esperar</button>
        <button className="btn ln sm mt8" onClick={() => setPaso(actualEn + 1)}>Volver a {'ABC'[actualEn + 1] ?? 'B'}</button>
      </div>
    </Hoja>
  )
  const x = ejercicio(alt)!
  return (
    <Hoja>
      {abc}
      <div className="sh-h"><div><h2>{paso === actualEn + 1 ? `${ejercicio(e.ejercicio)?.nombre} ocupado` : 'También ocupada'}</h2><p className="sub">{paso >= plan.length - 1 ? 'Última alternativa:' : 'Alternativa:'}</p></div></div>
      <div className="altc card">
        <Th ej={x} size="l" />
        <div className="grow">
          <span className="tag blue">{'ABC'[paso]}</span>
          <b>{x.nombre}</b>
          <div className="spec flat mt4">
            <p><span>Peso sugerido</span><b className="okc">{sug?.peso != null ? `${kg(sug.peso)} kg × ${e.repsMin}-${e.repsMax}` : sug?.accion === 'primera' ? 'Primera vez: cómodo' : `${e.repsMin}-${e.repsMax} reps`}</b></p>
            {ajuste?.ajustes && <p><span>Tu ajuste</span><b>{ajuste.ajustes}</b></p>}
            <p><span>Material</span><b>{nombreMaterial(x.material)}</b></p>
          </div>
        </div>
      </div>
      <button className="btn xl mt12" onClick={() => void hacer()}>Hacer esta</button>
      <button className="btn gry sm mt8" onClick={() => setPaso(p => p + 1)}>También ocupada</button>
      {paso > actualEn + 1 && <button className="btn ln sm mt8" onClick={() => setPaso(actualEn + 1)}>Volver a {'ABC'[actualEn + 1]}</button>}
      <p className="small muted mt12 center">Recordamos qué variante haces cada día.</p>
    </Hoja>
  )
}
