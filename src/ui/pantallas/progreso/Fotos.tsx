// PRO-06 · Fotos
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import type { Foto, Medicion } from '../../../datos/tipos'
import { num } from '../../../dominio/calculos'
import { fechaCorta, horaActual, hoyISO, numeroSemana } from '../../../dominio/fechas'
import { ultimoValor } from '../../../dominio/tendencias'
import { hacerFoto } from '../../../plataforma'
import { Chip, cx, Ico, Pantalla, Vacio } from '../../comp'
import { useNav } from '../../nav'
import { useAviso } from '../../aviso'
import { useAjustes, usePerfil } from '../../datos'
import { CabProgreso, useUrlsFotos } from './comun'

type Pose = Foto['pose']
const POSES: { v: Pose; t: string }[] = [{ v: 'frente', t: 'Frente' }, { v: 'perfil', t: 'Perfil' }, { v: 'espalda', t: 'Espalda' }]
const NOMBRE_POSE: Record<Pose, string> = { frente: 'Frente', perfil: 'Perfil', espalda: 'Espalda' }
const IMG = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } as const

export function Fotos() {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const ajustes = useAjustes()
  const fotos = useLiveQuery(() => db.fotos.orderBy('fecha').toArray(), [])
  const ms = useLiveQuery(() => db.mediciones.toArray(), []) ?? []
  const urls = useUrlsFotos(fotos ?? [])
  const [pose, setPose] = useState<Pose>('frente')
  const [poseNueva, setPoseNueva] = useState<Pose>('frente')
  const [idA, setIdA] = useState<number | null>(null)
  const [idB, setIdB] = useState<number | null>(null)
  const [corte, setCorte] = useState(50)
  const [lado, setLado] = useState(false)
  const [abierta, setAbierta] = useState<number | null>(null)
  const hoy = hoyISO()
  const inicio = ajustes.inicio ?? perfil.creado.slice(0, 10)
  const cab = <CabProgreso actual="pro-fotos" crumb="Lo que no dice la báscula" />

  const nueva = async () => {
    const imagen = await hacerFoto()
    if (!imagen) return
    await db.fotos.add({ fecha: `${hoy}T${horaActual()}`, pose: poseNueva, imagen })
    aviso(`Foto guardada · ${NOMBRE_POSE[poseNueva].toLowerCase()}`)
    // Siguiente pose que falte hoy.
    const hechasHoy = new Set([...(fotos ?? []).filter(f => f.fecha.startsWith(hoy)).map(f => f.pose), poseNueva])
    const sig = POSES.find(p => !hechasHoy.has(p.v))
    if (sig) setPoseNueva(sig.v)
  }

  const dock = (
    <div className="dock" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="chips mini" style={{ flex: 'none' }}>
        {POSES.map(p => <Chip key={p.v} on={poseNueva === p.v} onClick={() => setPoseNueva(p.v)}>{p.t}</Chip>)}
      </div>
      <button className="btn" style={{ flex: 1, minWidth: 0 }} onClick={() => void nueva()} aria-label={`Foto de ${NOMBRE_POSE[poseNueva].toLowerCase()}`}><Ico n="camera" b />Foto</button>
    </div>
  )

  if (!fotos) return <Pantalla>{cab}</Pantalla>
  if (!fotos.length) return (
    <Pantalla>
      {cab}
      <div className="pg">
        <p className="note plain"><Ico n="lock-simple" /><span>Las fotos están <b>solo en este móvil</b>. No se suben a ningún sitio.</span></p>
        <div className="sec">
          <Vacio icono="camera" titulo="Aún no hay fotos" texto="Una cada 2-4 semanas, con la misma luz, la misma ropa y la misma pose. Es lo que mejor enseña el cambio."
            accion={<><Ico n="camera" b />Hacer la primera foto</>} onAccion={() => void nueva()} />
        </div>
      </div>
    </Pantalla>
  )

  const dePose = fotos.filter(f => f.pose === pose)
  const a = dePose.find(f => f.id === idA) ?? dePose[0]
  const b = dePose.find(f => f.id === idB) ?? dePose[dePose.length - 1]
  const puedeComparar = !!a && !!b && a.id !== b.id

  // Galería agrupada por día, del más reciente al más antiguo.
  const dias = new Map<string, Foto[]>()
  for (const f of [...fotos].reverse()) {
    const d = f.fecha.slice(0, 10)
    dias.set(d, [...(dias.get(d) ?? []), f])
  }
  const orden = (f: Foto) => POSES.findIndex(p => p.v === f.pose)
  for (const lista of dias.values()) lista.sort((x, y) => orden(x) - orden(y))
  const primerDia = fotos[0]!.fecha.slice(0, 10)
  const vista = fotos.find(f => f.id === abierta)

  const elegirPose = (p: Pose) => { setPose(p); setIdA(null); setIdB(null) }

  return (
    <Pantalla>
      {cab}
      <div className="pg">
        <p className="note plain"><Ico n="lock-simple" /><span>Las fotos están <b>solo en este móvil</b>. No se suben a ningún sitio: inclúyelas en tus copias de seguridad.</span></p>

        <div className="sec">
          <div className="sec-h">
            <h2>Comparador</h2>
            <div className="chips mini">{POSES.map(p => <Chip key={p.v} on={pose === p.v} onClick={() => elegirPose(p.v)}>{p.t}</Chip>)}</div>
          </div>
          {!puedeComparar ? (
            <p className="note plain"><Ico n="images" /><span>Necesitas al menos dos fotos de {NOMBRE_POSE[pose].toLowerCase()} para compararlas.</span></p>
          ) : (
            <>
              <div className="cmp card">
                {lado ? (
                  <div className="grid2" style={{ padding: 8 }}>
                    {[a, b].map(f => (
                      <div key={f.id} className="pthumb">
                        <img src={urls.get(f.id!)} alt={`${NOMBRE_POSE[f.pose]} · ${fechaCorta(f.fecha)}`} style={IMG} />
                        <span>{fechaCorta(f.fecha)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="cmp-v">
                    <div className="cmp-a"><img src={urls.get(a.id!)} alt={`Antes · ${fechaCorta(a.fecha)}`} style={IMG} /></div>
                    <div className="cmp-b" style={{ clipPath: `inset(0 0 0 ${corte}%)` }}><img src={urls.get(b.id!)} alt={`Después · ${fechaCorta(b.fecha)}`} style={IMG} /></div>
                    <span className="cmp-h" aria-hidden="true" style={{ left: `${corte}%` }}><Ico n="arrows-left-right" b /></span>
                    <span className="cmp-l">{a.fecha.slice(0, 10) === primerDia ? 'Día 1' : fechaCorta(a.fecha)}</span>
                    <span className="cmp-r">{b.fecha.startsWith(hoy) ? 'Hoy' : fechaCorta(b.fecha)}</span>
                    <input type="range" min={0} max={100} value={corte} onChange={e => setCorte(Number(e.target.value))} aria-label="Deslizar para comparar"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'ew-resize', margin: 0 }} />
                  </div>
                )}
                <div className="cmp-d">
                  <DatosDia f={a} ms={ms} />
                  <DatosDia f={b} ms={ms} comparar={a} />
                </div>
              </div>
              <div className="grid2 mt8">
                <label className="fl"><span className="lbl fl">Antes</span>
                  <select className="inp" value={a.id} onChange={e => setIdA(Number(e.target.value))}>
                    {dePose.map(f => <option key={f.id} value={f.id}>{fechaCorta(f.fecha)} {f.fecha.slice(0, 4)}</option>)}
                  </select>
                </label>
                <label className="fl"><span className="lbl fl">Después</span>
                  <select className="inp" value={b.id} onChange={e => setIdB(Number(e.target.value))}>
                    {dePose.map(f => <option key={f.id} value={f.id}>{fechaCorta(f.fecha)} {f.fecha.slice(0, 4)}</option>)}
                  </select>
                </label>
              </div>
              <div className="chips eq mt8">
                <Chip on={!lado} onClick={() => setLado(false)}><Ico n="arrows-left-right" />Deslizador</Chip>
                <Chip on={lado} onClick={() => setLado(true)}><Ico n="columns" />Lado a lado</Chip>
              </div>
            </>
          )}
        </div>

        <div className="sec">
          <div className="sec-h"><h2>Galería</h2><span className="lbl">cada {perfil.fotosCadaSemanas || 2}-4 semanas</span></div>
          {vista && (
            <div className="card pd" style={{ marginBottom: 12 }}>
              <img src={urls.get(vista.id!)} alt={`${NOMBRE_POSE[vista.pose]} · ${fechaCorta(vista.fecha)}`} className="foto-prev" style={{ maxHeight: 420, objectFit: 'contain' }} />
              <div className="row jb mt8">
                <b>{NOMBRE_POSE[vista.pose]} · {fechaCorta(vista.fecha)}</b>
                <div className="row" style={{ gap: 8 }}>
                  <button className="ib" aria-label="Borrar foto" onClick={() => { setAbierta(null); nav.hoja('sheet-confirmar', { titulo: '¿Borrar esta foto?', texto: `${NOMBRE_POSE[vista.pose]} del ${fechaCorta(vista.fecha)}.`, si: 'Borrar', peligro: true, accion: 'borrar-foto', id: vista.id }) }}><Ico n="trash" /></button>
                  <button className="ib" aria-label="Cerrar" onClick={() => setAbierta(null)}><Ico n="x" /></button>
                </div>
              </div>
            </div>
          )}
          {[...dias.entries()].map(([d, lista], i) => (
            <div key={d}>
              <p className="gal-d"><b>{fechaCorta(d)}</b> · {d === primerDia ? 'día 1' : `semana ${Math.max(1, numeroSemana(inicio, d))}`}</p>
              <div className="grid3">
                {lista.map(f => (
                  <button key={f.id} className={cx('pthumb', i % 3 === 1 && 'b', i % 3 === 2 && 'c')} onClick={() => setAbierta(f.id ?? null)}>
                    <img src={urls.get(f.id!)} alt="" style={IMG} loading="lazy" />
                    <span>{NOMBRE_POSE[f.pose]}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {dock}
      </div>
    </Pantalla>
  )
}

function DatosDia({ f, ms, comparar }: { f: Foto; ms: Medicion[]; comparar?: Foto }) {
  const d = f.fecha.slice(0, 10)
  const cin = ultimoValor(ms, m => m.perimetros?.cintura, d)
  const peso = ultimoValor(ms, m => m.pesoKg, d)
  const cinAntes = comparar ? ultimoValor(ms, m => m.perimetros?.cintura, comparar.fecha.slice(0, 10)) : null
  const mejor = cin && cinAntes && cin.valor < cinAntes.valor
  return (
    <div className="spec flat">
      <p><span>{fechaCorta(d)}</span><b className={cx(mejor && 'okc')}>{cin ? `${num(cin.valor)} cm` : '—'}</b></p>
      <p><span>Peso</span><b>{peso ? `${num(peso.valor)} kg` : '—'}</b></p>
    </div>
  )
}
