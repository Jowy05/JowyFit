// PRO-06 · Fotos
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { fotosPorFecha } from '../../datos/consultas'
import { guardarFoto } from '../../datos/acciones/cuerpo'
import type { Foto, Guardado, Medicion } from '../../datos/tipos'
import { num } from '../../dominio/formato'
import { fechaCorta, horaActual, hoyISO, numeroSemana } from '../../dominio/fechas'
import { ultimoValor } from '../../dominio/tendencias'
import { hacerFoto } from '../../plataforma'
import { Chip, cx, Ico, Pantalla, Vacio } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useAjustes, useMediciones, usePerfil } from '../../datos/hooks'
import { CabProgreso, useUrlsFotos } from './comun'
import { t, tc, tn } from '../../i18n'
import { tr } from '../../i18n/jsx'

type Pose = Foto['pose']
const POSES: { v: Pose }[] = [{ v: 'frente' }, { v: 'perfil' }, { v: 'espalda' }]
/** Nombre de la pose en el idioma de la app («Perfil» de la foto no es la pestaña Perfil: va con contexto). */
const nombrePose = (p: Pose) => (p === 'frente' ? t('Frente') : p === 'perfil' ? tc('pose', 'Perfil') : t('Espalda'))
const IMG = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' } as const

export function Fotos() {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const ajustes = useAjustes()
  const fotos = useLiveQuery(fotosPorFecha, [])
  const ms = useMediciones() ?? []
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
  const cab = <CabProgreso actual="fotos" crumb={t('Lo que no dice la báscula')} />

  const nueva = async () => {
    const imagen = await hacerFoto()
    if (!imagen) return
    await guardarFoto({ fecha: `${hoy}T${horaActual()}`, pose: poseNueva, imagen })
    aviso(t('Foto guardada · {pose}', { pose: nombrePose(poseNueva).toLowerCase() }))
    // Siguiente pose que falte hoy.
    const hechasHoy = new Set([...(fotos ?? []).filter(f => f.fecha.startsWith(hoy)).map(f => f.pose), poseNueva])
    const sig = POSES.find(p => !hechasHoy.has(p.v))
    if (sig) setPoseNueva(sig.v)
  }

  const dock = (
    <div className="dock" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="chips mini" style={{ flex: 'none' }}>
        {POSES.map(p => <Chip key={p.v} on={poseNueva === p.v} onClick={() => setPoseNueva(p.v)}>{nombrePose(p.v)}</Chip>)}
      </div>
      <button className="btn" style={{ flex: 1, minWidth: 0 }} onClick={() => void nueva()} aria-label={t('Foto de {pose}', { pose: nombrePose(poseNueva).toLowerCase() })}><Ico n="camera" b />{t('Foto')}</button>
    </div>
  )

  if (!fotos) return <Pantalla>{cab}</Pantalla>
  if (!fotos.length) return (
    <Pantalla>
      {cab}
      <div className="pg">
        <p className="note plain"><Ico n="lock-simple" /><span>{tr('Las fotos están <b>solo en este móvil</b>. No se suben a ningún sitio.', { b: s => <b>{s}</b> })}</span></p>
        <div className="sec">
          <Vacio icono="camera" titulo={t('Aún no hay fotos')} texto={t('Una cada 2-4 semanas, con la misma luz, la misma ropa y la misma pose. Es lo que mejor enseña el cambio.')}
            accion={<><Ico n="camera" b />{t('Hacer la primera foto')}</>} onAccion={() => void nueva()} />
        </div>
      </div>
    </Pantalla>
  )

  const dePose = fotos.filter(f => f.pose === pose)
  const a = dePose.find(f => f.id === idA) ?? dePose[0]
  const b = dePose.find(f => f.id === idB) ?? dePose[dePose.length - 1]
  const puedeComparar = !!a && !!b && a.id !== b.id

  // Galería agrupada por día, del más reciente al más antiguo.
  const dias = new Map<string, Guardado<Foto>[]>()
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
        <p className="note plain"><Ico n="lock-simple" /><span>{tr('Las fotos están <b>solo en este móvil</b>. No se suben a ningún sitio: inclúyelas en tus copias de seguridad.', { b: s => <b>{s}</b> })}</span></p>

        <div className="sec">
          <div className="sec-h">
            <h2>{t('Comparador')}</h2>
            <div className="chips mini">{POSES.map(p => <Chip key={p.v} on={pose === p.v} onClick={() => elegirPose(p.v)}>{nombrePose(p.v)}</Chip>)}</div>
          </div>
          {!puedeComparar ? (
            <p className="note plain"><Ico n="images" /><span>{t('Necesitas al menos dos fotos de {pose} para compararlas.', { pose: nombrePose(pose).toLowerCase() })}</span></p>
          ) : (
            <>
              <div className="cmp card">
                {lado ? (
                  <div className="grid2" style={{ padding: 8 }}>
                    {[a, b].map(f => (
                      <div key={f.id} className="pthumb">
                        <img src={urls.get(f.id)} alt={`${nombrePose(f.pose)} · ${fechaCorta(f.fecha)}`} style={IMG} />
                        <span>{fechaCorta(f.fecha)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="cmp-v">
                    <div className="cmp-a"><img src={urls.get(a.id)} alt={t('Antes · {fecha}', { fecha: fechaCorta(a.fecha) })} style={IMG} /></div>
                    <div className="cmp-b" style={{ clipPath: `inset(0 0 0 ${corte}%)` }}><img src={urls.get(b.id)} alt={t('Después · {fecha}', { fecha: fechaCorta(b.fecha) })} style={IMG} /></div>
                    <span className="cmp-h" aria-hidden="true" style={{ left: `${corte}%` }}><Ico n="arrows-left-right" b /></span>
                    <span className="cmp-l">{a.fecha.slice(0, 10) === primerDia ? t('Día 1') : fechaCorta(a.fecha)}</span>
                    <span className="cmp-r">{b.fecha.startsWith(hoy) ? t('Hoy') : fechaCorta(b.fecha)}</span>
                    <input type="range" min={0} max={100} value={corte} onChange={e => setCorte(Number(e.target.value))} aria-label={t('Deslizar para comparar')}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'ew-resize', margin: 0 }} />
                  </div>
                )}
                <div className="cmp-d">
                  <DatosDia f={a} ms={ms} />
                  <DatosDia f={b} ms={ms} comparar={a} />
                </div>
              </div>
              <div className="grid2 mt8">
                <label className="fl"><span className="lbl fl">{t('Antes')}</span>
                  <select className="inp" value={a.id} onChange={e => setIdA(Number(e.target.value))}>
                    {dePose.map(f => <option key={f.id} value={f.id}>{t('{fecha} {ano}', { fecha: fechaCorta(f.fecha), ano: f.fecha.slice(0, 4) })}</option>)}
                  </select>
                </label>
                <label className="fl"><span className="lbl fl">{t('Después')}</span>
                  <select className="inp" value={b.id} onChange={e => setIdB(Number(e.target.value))}>
                    {dePose.map(f => <option key={f.id} value={f.id}>{t('{fecha} {ano}', { fecha: fechaCorta(f.fecha), ano: f.fecha.slice(0, 4) })}</option>)}
                  </select>
                </label>
              </div>
              <div className="chips eq mt8">
                <Chip on={!lado} onClick={() => setLado(false)}><Ico n="arrows-left-right" />{t('Deslizador')}</Chip>
                <Chip on={lado} onClick={() => setLado(true)}><Ico n="columns" />{t('Lado a lado')}</Chip>
              </div>
            </>
          )}
        </div>

        <div className="sec">
          <div className="sec-h"><h2>{t('Galería')}</h2><span className="lbl">{perfil.fotosCadaSemanas > 0 && perfil.fotosCadaSemanas !== 2 ? tn(perfil.fotosCadaSemanas, 'cada {n} semana', 'cada {n} semanas') : t('cada 2-4 semanas')}</span></div>
          {vista && (
            <div className="card pd" style={{ marginBottom: 12 }}>
              <img src={urls.get(vista.id)} alt={`${nombrePose(vista.pose)} · ${fechaCorta(vista.fecha)}`} className="foto-prev" style={{ maxHeight: 420, objectFit: 'contain' }} />
              <div className="row jb mt8">
                <b>{nombrePose(vista.pose)} · {fechaCorta(vista.fecha)}</b>
                <div className="row" style={{ gap: 8 }}>
                  <button className="ib" aria-label={t('Borrar foto')} onClick={() => { setAbierta(null); nav.hoja('hoja-confirmar', { titulo: t('¿Borrar esta foto?'), texto: t('{pose} del {fecha}.', { pose: nombrePose(vista.pose), fecha: fechaCorta(vista.fecha) }), si: t('Borrar'), peligro: true, accion: 'borrar-foto', id: vista.id }) }}><Ico n="trash" /></button>
                  <button className="ib" aria-label={t('Cerrar')} onClick={() => setAbierta(null)}><Ico n="x" /></button>
                </div>
              </div>
            </div>
          )}
          {[...dias.entries()].map(([d, lista], i) => (
            <div key={d}>
              <p className="gal-d"><b>{fechaCorta(d)}</b> · {d === primerDia ? t('día 1') : t('semana {n}', { n: Math.max(1, numeroSemana(inicio, d)) })}</p>
              <div className="grid3">
                {lista.map(f => (
                  <button key={f.id} className={cx('pthumb', i % 3 === 1 && 'b', i % 3 === 2 && 'c')} onClick={() => setAbierta(f.id)}>
                    <img src={urls.get(f.id)} alt="" style={IMG} loading="lazy" />
                    <span>{nombrePose(f.pose)}</span>
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
      <p><span>{t('Peso')}</span><b>{peso ? `${num(peso.valor)} kg` : '—'}</b></p>
    </div>
  )
}
