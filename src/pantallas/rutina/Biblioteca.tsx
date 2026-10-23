// RUT-05 · Ejercicios (biblioteca RepDB)
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { leerSesiones } from '../../datos/consultas'
import { buscar, catalogoCargado, nombreMaterial } from '../../catalogo/catalogo'
import { mejorMarca } from '../../dominio/progresion'
import { hoyISO } from '../../dominio/fechas'
import { kg } from '../../dominio/formato'
import { Chip, Ico, Pantalla, Th, LARGO } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useGimnasio, useMarcas, useRutina } from '../../datos/hooks'
import { abrevDia, musculoComun, musculosComunes, zonaComun } from './comun'
import { CabRutina } from './CabRutina'
import { t, tk } from '../../i18n'
import { tr } from '../../i18n/jsx'

/** Grupos sencillos para el filtro principal (los músculos exactos van en «Más filtros»). En castellano: se traducen al pintarlos. */
const GRUPOS_SIMPLES = [tk('Pecho'), tk('Espalda'), tk('Hombro'), tk('Brazo'), tk('Abdomen'), tk('Glúteo'), tk('Pierna')]

export function Biblioteca({ ruta }: { ruta: Ruta<'biblioteca'> }) {
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
    const sesiones = await leerSesiones()
    const series = new Map<string, import('../../datos/tipos').Serie[]>()
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
    if (grupo) l = l.filter(e => e.principales.some(x => musculoComun(x) === t(grupo)))
    if (musculo) l = l.filter(e => e.principales.includes(musculo) || e.secundarios.includes(musculo))
    if (material) l = l.filter(e => (material === 'corporal' ? !e.material : e.material === material))
    if (favs) l = l.filter(e => marcas.get(e.id)?.favorito)
    if (evitados) l = l.filter(e => marcas.get(e.id)?.odiado || marcas.get(e.id)?.duele)
    if (hoy) l = l.filter(e => datos?.hechosHoy.has(e.id))
    l = buscar(q, l)
    return l.sort((a, b) => Number(enPlan.has(b.id)) - Number(enPlan.has(a.id)) || Number(!!marcas.get(b.id)?.favorito) - Number(!!marcas.get(a.id)?.favorito) || a.nombre.localeCompare(b.nombre))
  }, [c, q, grupo, musculo, material, enGym, favs, hoy, evitados, g?.material.length, marcas, datos, enPlan])
  const [n, setN] = useState(40)
  const nFavs = [...marcas.values()].filter(m => m.favorito).length
  // «En mi gimnasio» no cuenta: es lo normal.
  const hayFiltros = !!grupo || !!musculo || !!material || favs || hoy || evitados
  const quitarFiltros = () => { setGrupo(''); setMusculo(''); setMaterial(''); setFavs(false); setHoy(false); setEvitados(false) }
  const cuenta = <b className="mono">{lista.length}</b>
  const materiales = useMemo(() => [...new Set((c?.ejercicios ?? []).map(e => e.material).filter((m): m is string => !!m))].sort((a, b) => nombreMaterial(a).localeCompare(nombreMaterial(b))), [c])

  return (
    <Pantalla>
      <CabRutina actual="biblioteca" crumb={t('Biblioteca')} />
      <div className="pg">
        <label className="search"><Ico n="magnifying-glass" /><input className="inp" type="search" maxLength={LARGO.buscar} placeholder={t('Buscar ejercicio o máquina')} aria-label={t('Buscar ejercicio')} value={q} onChange={e => { setQ(e.target.value); setN(40) }} /></label>
        <div className="chips scroll mt12">
          <select className="chip filt" value={grupo} onChange={e => setGrupo(e.target.value)} aria-label={t('Músculo')} style={{ appearance: 'none', background: grupo ? 'var(--blue-t)' : 'var(--surface)', color: grupo ? 'var(--blue)' : 'var(--ink)' }}>
            <option value="">{t('Músculo ▾')}</option>
            {GRUPOS_SIMPLES.map(x => <option key={x} value={x}>{t(x)}</option>)}
          </select>
          <Chip on={enGym} ck onClick={() => setEnGym(v => !v)}>{t('En mi gimnasio')}</Chip>
          <Chip on={favs} onClick={() => setFavs(v => !v)}><Ico n="star" />{t('Favoritos')}{nFavs > 0 && <span className="n">{nFavs}</span>}</Chip>
          {evitados && <Chip on onClick={() => setEvitados(false)}><Ico n="prohibit" />{t('Evitados')}</Chip>}
          <Chip on={mas || !!musculo || !!material || hoy} onClick={() => setMas(v => !v)}><Ico n="sliders-horizontal" />{t('Más filtros')}</Chip>
        </div>
        {(mas || musculo || material || hoy) && (
          <div className="chips scroll mt8">
            <select className="chip filt" value={musculo} onChange={e => setMusculo(e.target.value)} aria-label={t('Músculo exacto')} style={{ appearance: 'none', background: musculo ? 'var(--blue-t)' : 'var(--surface)', color: musculo ? 'var(--blue)' : 'var(--ink)' }}>
              <option value="">{t('Músculo exacto ▾')}</option>
              {Object.entries(c?.musculos ?? {}).sort((a, b) => a[1].nombre.localeCompare(b[1].nombre)).map(([k, m]) => <option key={k} value={k}>{m.nombre}</option>)}
            </select>
            <select className="chip filt" value={material} onChange={e => setMaterial(e.target.value)} aria-label={t('Equipamiento')} style={{ appearance: 'none', background: material ? 'var(--blue-t)' : 'var(--surface)', color: material ? 'var(--blue)' : 'var(--ink)' }}>
              <option value="">{t('Máquina o material ▾')}</option>
              <option value="corporal">{t('Peso corporal')}</option>
              {materiales.map(m => <option key={m} value={m}>{nombreMaterial(m)}</option>)}
            </select>
            <Chip on={hoy} onClick={() => setHoy(v => !v)}>{t('Hechos hoy')} <span className="n">{datos?.hechosHoy.size ?? 0}</span></Chip>
          </div>
        )}
        <div className="count"><p>{enGym && g
          ? (lista.length === 1 ? tr('{n} ejercicio en tu gimnasio', { n: cuenta }) : tr('{n} ejercicios en tu gimnasio', { n: cuenta }))
          : (lista.length === 1 ? tr('{n} ejercicio', { n: cuenta }) : tr('{n} ejercicios', { n: cuenta }))}</p>{hayFiltros && <button className="lnk" onClick={quitarFiltros}>{t('Quitar filtros')}</button>}</div>
        {lista.length === 0 ? (
          <div className="card pd empty">
            <span className="empty-ic"><Ico n="magnifying-glass" /></span>
            <h3 className="h3">{t('No sale ningún ejercicio')}</h3>
            <p className="muted">{q ? (hayFiltros ? t('Nada se llama «{q}» con estos filtros. Prueba con otra palabra, como «press» o «sentadilla».', { q }) : t('Nada se llama «{q}». Prueba con otra palabra, como «press» o «sentadilla».', { q })) : hayFiltros ? t('Hay demasiados filtros puestos.') : t('Tu gimnasio no tiene máquinas marcadas.')}</p>
            {hayFiltros ? <button className="btn mt12" onClick={quitarFiltros}>{t('Quitar filtros')}</button>
              : enGym && !q ? <button className="btn mt12" onClick={() => (g ? nav.ir('editor-gimnasio', { id: g.id }) : nav.reemplazar('gimnasios'))}>{g ? t('Marcar las máquinas de mi gimnasio') : t('Crear mi gimnasio')}</button>
              : q ? <button className="btn gry sm mt12" onClick={() => setQ('')}>{t('Borrar la búsqueda')}</button> : null}
          </div>
        ) : (
          <div className="ads">
            {lista.slice(0, n).map(e => {
              const m = marcas.get(e.id)
              const rec = datos?.records.get(e.id)
              return (
                <button key={e.id} className="ad" onClick={() => nav.ir('ficha', { id: e.id })}>
                  <Th ej={e} size="m" />
                  <span className="tx">
                    <b>{e.nombre}</b>
                    <small>{musculosComunes(e.principales, 2).join(' · ')} · {nombreMaterial(e.material)}</small>
                    <span className="ad-k">
                      <span className="tag">{zonaComun(e.zona)}</span>
                      {enPlan.has(e.id) && <span className="tag go">{t('En tu plan · {dia}', { dia: enPlan.get(e.id)! })}</span>}
                      <span className="marks">{m?.favorito && <Ico n="star" b className="ph-star" />}{m?.odiado && <Ico n="prohibit" b className="ph-prohibit" />}{m?.duele && <Ico n="warning" b className="ph-warning" />}</span>
                    </span>
                  </span>
                  {rec != null && <span className="ad-v"><small>{t('Récord')}</small><b>{kg(rec)} kg</b></span>}
                </button>
              )
            })}
            {lista.length > n && <button className="more" onClick={() => setN(x => x + 60)}>{t('Ver más ({n})', { n: lista.length - n })}</button>}
          </div>
        )}
        <p className="credit">Exercise data by RepDB (repdb.co)</p>
      </div>
    </Pantalla>
  )
}
