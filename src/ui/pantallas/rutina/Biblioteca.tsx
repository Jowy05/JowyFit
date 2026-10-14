// RUT-05 · Ejercicios (biblioteca RepDB)
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { buscar, catalogoCargado, nombreMaterial } from '../../../catalogo/catalogo'
import { mejorMarca } from '../../../dominio/progresion'
import { hoyISO } from '../../../dominio/fechas'
import { kg } from '../../../dominio/calculos'
import { Chip, Ico, Pantalla, Th } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useGimnasio, useMarcas, useRutina } from '../../datos'
import { abrevDia, CabRutina, musculoComun, musculosComunes, nombreVisible, zonaComun } from './comun'

/** Grupos sencillos para el filtro principal (los músculos exactos van en «Más filtros»). */
const GRUPOS_SIMPLES = ['Pecho', 'Espalda', 'Hombro', 'Brazo', 'Abdomen', 'Glúteo', 'Pierna']

export function Biblioteca({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const g = useGimnasio()
  const marcas = useMarcas()
  const r = useRutina()
  const [q, setQ] = useState('')
  const [grupo, setGrupo] = useState('')
  const [musculo, setMusculo] = useState('')
  const [mas, setMas] = useState(false)
  const [material, setMaterial] = useState('')
  const [enGym, setEnGym] = useState(true)
  const [favs, setFavs] = useState(false)
  const [hoy, setHoy] = useState(false)
  const [evitados, setEvitados] = useState(ruta.d?.filtro === 'evitados')
  const c = catalogoCargado()
  const datos = useLiveQuery(async () => {
    const sesiones = await db.sesiones.toArray()
    const series = new Map<string, import('../../../datos/tipos').Serie[]>()
    const hechosHoy = new Set<string>()
    for (const s of sesiones) for (const e of s.ejercicios) {
      const l = series.get(e.ejercicio) ?? []
      l.push(...e.series.filter(x => x.hecha))
      series.set(e.ejercicio, l)
      if (s.fecha === hoyISO() && e.series.some(x => x.hecha)) hechosHoy.add(e.ejercicio)
    }
    const records = new Map<string, number>()
    for (const [id, l] of series) { const m = mejorMarca(l); if (m) records.set(id, m.peso) }
    return { records, hechosHoy }
  }, [])
  const enPlan = useMemo(() => new Map((r?.dias ?? []).flatMap(d => d.bloques.map(b => [b.ejercicio, abrevDia(d)] as const))), [r])
  const sel = new Set(g?.material ?? [])
  const lista = useMemo(() => {
    let l = (c?.ejercicios ?? []).filter(e => e.categoria !== 'stretching' || q)
    if (enGym && g) l = l.filter(e => !e.material || sel.has(e.material))
    if (grupo) l = l.filter(e => e.principales.some(x => musculoComun(x) === grupo))
    if (musculo) l = l.filter(e => e.principales.includes(musculo) || e.secundarios.includes(musculo))
    if (material) l = l.filter(e => (material === 'corporal' ? !e.material : e.material === material))
    if (favs) l = l.filter(e => marcas.get(e.id)?.favorito)
    if (evitados) l = l.filter(e => marcas.get(e.id)?.odiado || marcas.get(e.id)?.duele)
    if (hoy) l = l.filter(e => datos?.hechosHoy.has(e.id))
    l = buscar(q, l)
    return l.sort((a, b) => Number(enPlan.has(b.id)) - Number(enPlan.has(a.id)) || Number(!!marcas.get(b.id)?.favorito) - Number(!!marcas.get(a.id)?.favorito) || a.nombre.localeCompare(b.nombre))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, q, grupo, musculo, material, enGym, favs, hoy, evitados, g?.material.length, marcas, datos, enPlan])
  const [n, setN] = useState(40)
  const nFavs = [...marcas.values()].filter(m => m.favorito).length
  // «En mi gimnasio» no cuenta: es lo normal.
  const hayFiltros = !!grupo || !!musculo || !!material || favs || hoy || evitados
  const quitarFiltros = () => { setGrupo(''); setMusculo(''); setMaterial(''); setFavs(false); setHoy(false); setEvitados(false) }
  const materiales = useMemo(() => [...new Set((c?.ejercicios ?? []).map(e => e.material).filter((m): m is string => !!m))].sort((a, b) => nombreMaterial(a).localeCompare(nombreMaterial(b))), [c])

  return (
    <Pantalla>
      <CabRutina actual="rut-ej" crumb="Biblioteca" />
      <div className="pg">
        <label className="search"><Ico n="magnifying-glass" /><input className="inp" type="search" placeholder="Buscar ejercicio o máquina" aria-label="Buscar ejercicio" value={q} onChange={e => { setQ(e.target.value); setN(40) }} /></label>
        <div className="chips scroll mt12">
          <select className="chip filt" value={grupo} onChange={e => setGrupo(e.target.value)} aria-label="Músculo" style={{ appearance: 'none', background: grupo ? 'var(--blue-t)' : 'var(--surface)', color: grupo ? 'var(--blue)' : 'var(--ink)' }}>
            <option value="">Músculo ▾</option>
            {GRUPOS_SIMPLES.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <Chip on={enGym} ck onClick={() => setEnGym(v => !v)}>En mi gimnasio</Chip>
          <Chip on={favs} onClick={() => setFavs(v => !v)}><Ico n="star" />Favoritos{nFavs > 0 && <span className="n">{nFavs}</span>}</Chip>
          {evitados && <Chip on onClick={() => setEvitados(false)}><Ico n="prohibit" />Evitados</Chip>}
          <Chip on={mas || !!musculo || !!material || hoy} onClick={() => setMas(v => !v)}><Ico n="sliders-horizontal" />Más filtros</Chip>
        </div>
        {(mas || musculo || material || hoy) && (
          <div className="chips scroll mt8">
            <select className="chip filt" value={musculo} onChange={e => setMusculo(e.target.value)} aria-label="Músculo exacto" style={{ appearance: 'none', background: musculo ? 'var(--blue-t)' : 'var(--surface)', color: musculo ? 'var(--blue)' : 'var(--ink)' }}>
              <option value="">Músculo exacto ▾</option>
              {Object.entries(c?.musculos ?? {}).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre)).map(([k, m]) => <option key={k} value={k}>{m.nombre}</option>)}
            </select>
            <select className="chip filt" value={material} onChange={e => setMaterial(e.target.value)} aria-label="Equipamiento" style={{ appearance: 'none', background: material ? 'var(--blue-t)' : 'var(--surface)', color: material ? 'var(--blue)' : 'var(--ink)' }}>
              <option value="">Máquina o material ▾</option>
              <option value="corporal">Peso corporal</option>
              {materiales.map(m => <option key={m} value={m}>{nombreMaterial(m)}</option>)}
            </select>
            <Chip on={hoy} onClick={() => setHoy(v => !v)}>Hechos hoy <span className="n">{datos?.hechosHoy.size ?? 0}</span></Chip>
          </div>
        )}
        <div className="count"><p><b className="mono">{lista.length}</b> ejercicio{lista.length === 1 ? '' : 's'}{enGym && g ? ' en tu gimnasio' : ''}</p>{hayFiltros && <button className="lnk" onClick={quitarFiltros}>Quitar filtros</button>}</div>
        {lista.length === 0 ? (
          <div className="card pd empty">
            <span className="empty-ic"><Ico n="magnifying-glass" /></span>
            <h3 className="h3">No sale ningún ejercicio</h3>
            <p className="muted">{q ? `Nada se llama «${q}»${hayFiltros ? ' con estos filtros' : ''}. Prueba con otra palabra, como «press» o «sentadilla».` : hayFiltros ? 'Hay demasiados filtros puestos.' : 'Tu gimnasio no tiene máquinas marcadas.'}</p>
            {hayFiltros ? <button className="btn mt12" onClick={quitarFiltros}>Quitar filtros</button>
              : enGym && !q ? <button className="btn mt12" onClick={() => (g?.id != null ? nav.ir('rut-gym-edit', { id: g.id }) : nav.reemplazar('rut-gym'))}>{g ? 'Marcar las máquinas de mi gimnasio' : 'Crear mi gimnasio'}</button>
              : q ? <button className="btn gry sm mt12" onClick={() => setQ('')}>Borrar la búsqueda</button> : null}
          </div>
        ) : (
          <div className="ads">
            {lista.slice(0, n).map(e => {
              const m = marcas.get(e.id)
              const rec = datos?.records.get(e.id)
              return (
                <button key={e.id} className="ad" onClick={() => nav.ir('rut-ficha', { id: e.id })}>
                  <Th ej={e} size="m" />
                  <span className="tx">
                    <b>{nombreVisible(e.nombre)}</b>
                    <small>{musculosComunes(e.principales, 2).join(' · ')} · {nombreMaterial(e.material)}</small>
                    <span className="ad-k">
                      <span className="tag">{zonaComun(e.zona)}</span>
                      {enPlan.has(e.id) && <span className="tag go">En tu plan · {enPlan.get(e.id)}</span>}
                      <span className="marks">{m?.favorito && <Ico n="star" b className="ph-star" />}{m?.odiado && <Ico n="prohibit" b className="ph-prohibit" />}{m?.duele && <Ico n="warning" b className="ph-warning" />}</span>
                    </span>
                  </span>
                  {rec != null && <span className="ad-v"><small>Récord</small><b>{kg(rec)} kg</b></span>}
                </button>
              )
            })}
            {lista.length > n && <button className="more" onClick={() => setN(x => x + 60)}>Ver más ({lista.length - n})</button>}
          </div>
        )}
        <p className="credit">Exercise data by RepDB (repdb.co)</p>
      </div>
    </Pantalla>
  )
}
