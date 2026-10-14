// RUT-04 · Editar plan
import { useState } from 'react'
import { db } from '../../../datos/db'
import type { Bloque, Rutina } from '../../../datos/tipos'
import { ejercicio, nombreMaterial } from '../../../catalogo/catalogo'
import { duracion } from '../../../dominio/fechas'
import { Cab, Chip, cx, Ico, Pantalla, Stepper, Th, Vacio } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { useRutina } from '../../datos'
import { filas, minutos } from './comun'

const RANGOS: [number, number][] = [[5, 8], [6, 10], [8, 12], [10, 15], [12, 20]]

export async function guardarRutina(r: Rutina) {
  await db.rutinas.put(r)
}

export function EditarPlan({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const r = useRutina()
  const [letra, setLetra] = useState<string>(String(ruta.d?.letra ?? 'A'))
  // undefined = aún cargando: no enseñar «Aún no tienes rutina» durante un instante.
  if (r === undefined) return <Pantalla><Cab atras crumb="Mi plan" titulo="Editar plan" /><div className="cargando">Cargando…</div></Pantalla>
  if (!r) return <Pantalla><Cab atras crumb="Mi plan" titulo="Editar plan" /><div className="pg"><Vacio icono="clipboard-text" titulo="Aún no tienes rutina" accion="Crear mi rutina" onAccion={() => nav.ir('rut-gen')} /></div></Pantalla>
  const dia = r.dias.find(d => d.letra === letra) ?? r.dias[0]!

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
    aviso('Ejercicio quitado', () => void guardarRutina(antes))
  }
  const deshacerSS = async (a: Bloque) => {
    const antes = structuredClone(r)
    await cambiar(bs => bs.map(x => (x.uid === a.uid || x.uid === a.superserie ? { ...x, superserie: undefined } : x)))
    aviso('Superserie deshecha', () => void guardarRutina(antes))
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
    return (
      <div key={b.uid} className="edr card">
        <div className="row">
          <span className="grip" style={{ flexDirection: 'column', display: 'flex', gap: 2 }}>
            <button aria-label="Subir" onClick={() => mover(b.uid, -1)}><Ico n="caret-up" b /></button>
            <button aria-label="Bajar" onClick={() => mover(b.uid, 1)}><Ico n="caret-down" b /></button>
          </span>
          <Th ej={e} size="s" />
          <span className="tx">
            <b>{e?.nombre}</b>
            <small className="mono" onClick={() => { if (b.registro === 'tiempo') return; const [a, z] = RANGOS[(rango + 1) % RANGOS.length]!; void editar(b.uid, { repsMin: a, repsMax: z }) }}>{b.repsMin}-{b.repsMax} {b.registro === 'tiempo' ? 's' : 'reps'} · esf. {b.rpe} · {duracion(b.descanso)}</small>
          </span>
          <Stepper className="sm mini" valor={b.series} paso={1} min={1} max={8} onCambio={v => editar(b.uid, { series: v })} etiqueta="Series" />
        </div>
        <div className="edr-act">
          <button className="lnk" onClick={() => nav.hoja('sheet-elegir', { modo: 'cambiar', letra: dia.letra, uid: b.uid, id: b.ejercicio })}><Ico n="swap" />Cambiar</button>
          <button className="lnk" onClick={() => nav.hoja('sheet-elegir', { modo: 'alternativa', letra: dia.letra, uid: b.uid, id: b.ejercicio })}>B / C</button>
          <button className="lnk" onClick={() => quitar(b)}><Ico n="trash" />Quitar</button>
          <button className={cx('cutchip', b.fueraEnCorta && 'on')} onClick={() => editar(b.uid, { fueraEnCorta: !b.fueraEnCorta })}><Ico n="scissors" />Corta</button>
        </div>
        {b.alternativas.length > 0 && <p className="small muted" style={{ padding: '0 0 8px 32px' }}>Alternativas: {b.alternativas.map(a => `${ejercicio(a)?.nombre} (${nombreMaterial(ejercicio(a)?.material ?? null).toLowerCase()})`).join(' → ')}</p>}
      </div>
    )
  }

  return (
    <Pantalla>
      <Cab atras crumb="Mi plan" titulo="Editar plan">
        <div className="chips eq mt12">
          {r.dias.map(d => <Chip key={d.letra} on={d.letra === dia.letra} onClick={() => setLetra(d.letra)}>{d.opcional ? 'Opcional' : `Día ${d.letra}`}</Chip>)}
        </div>
      </Cab>
      <div className="pg">
        <p className="small muted">~{minutos(dia)} min · corta ~{minutos(dia, true)} min · toca las reps para cambiar el rango.</p>
        <div className="edl mt8">
          {filas(dia.bloques).map(f => Array.isArray(f) ? (
            <div key={f[0].uid} className="ssg">
              <p className="ss-head"><Ico n="link" b />Superserie {dia.letra}1 + {dia.letra}2<button className="lnk" onClick={() => deshacerSS(f[0])}>Deshacer</button></p>
              <div className="edl">{fila(f[0])}{fila(f[1])}</div>
            </div>
          ) : (
            <div key={f.uid}>
              {fila(f)}
              {dia.bloques.indexOf(f) < dia.bloques.length - 1 && !dia.bloques[dia.bloques.indexOf(f) + 1]?.superserie && (
                <button className="lnk" style={{ margin: '2px 0 0 32px', fontSize: 13 }} onClick={() => unirSiguiente(f)}><Ico n="link" />Superserie con el siguiente</button>
              )}
            </div>
          ))}
        </div>
        <button className="more" onClick={() => nav.hoja('sheet-elegir', { modo: 'anadir', letra: dia.letra })}><Ico n="plus" b />Añadir ejercicio</button>
        <p className="note mt16"><Ico n="info" /><span>Los cambios se guardan solos. Tu historial no se toca.</span></p>
      </div>
    </Pantalla>
  )
}
