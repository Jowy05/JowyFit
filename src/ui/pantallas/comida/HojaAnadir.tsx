// COM-02 · Añadir: franja, escanear, nota rápida, foto, plantillas P/N/G, picoteo y bebida de un toque.
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import type { Comida, Franja, Plantilla, Producto } from '../../../datos/tipos'
import { FRANJAS, NOMBRE_FRANJA, conRacion, deAyer, franjaPorHora, ordenarPlantillas, porRacion, recientes, type Racion } from '../../../dominio/comida'
import { horaActual, hoyISO, sumarDias } from '../../../dominio/fechas'
import { normalizar } from '../../../catalogo/catalogo'
import { hacerFoto } from '../../../plataforma'
import { Chip, cx, Hoja, Ico, Stepper, useUnaVez } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { Mini, apuntar, apuntarPlantilla, kp, useUrlBlob } from './comun'

export function HojaAnadir({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const fecha = typeof ruta.d?.fecha === 'string' ? ruta.d.fecha : hoyISO()
  const esHoy = fecha === hoyISO()
  const [franja, setFranja] = useState<Franja>((ruta.d?.franja as Franja | undefined) ?? franjaPorHora(horaActual()))
  const [nota, setNota] = useState(!!ruta.d?.nota)
  const [texto, setTexto] = useState('')
  const [kcal, setKcal] = useState(500)
  const [prot, setProt] = useState(25)
  const [foto, setFoto] = useState<Blob | undefined>()
  const [busca, setBusca] = useState('')
  const fotoUrl = useUrlBlob(foto)
  const picoteoRef = useRef<HTMLDivElement>(null)
  const plantillas = useLiveQuery(() => db.plantillas.toArray(), []) ?? []
  const productos = useLiveQuery(() => db.productos.toArray(), []) ?? []
  const ultimas = useLiveQuery(() => db.comidas.where('fecha').between(sumarDias(fecha, -14), fecha, true, true).toArray(), [fecha]) ?? []
  const ayer = deAyer(ultimas, sumarDias(fecha, -1), franja)
  const recien = recientes(ultimas, fecha, plantillas)
  const comidas = ordenarPlantillas(plantillas.filter(p => p.tipo === 'comida'))
  const snacks = ordenarPlantillas(plantillas.filter(p => p.tipo !== 'comida'))

  useEffect(() => {
    if (ruta.d?.modo === 'picoteo') picoteoRef.current?.scrollIntoView({ block: 'start' })
  }, [ruta.d?.modo])

  const hora = esHoy ? horaActual() : franja === 'desayuno' ? '08:00' : franja === 'comida' ? '14:00' : franja === 'merienda' ? '17:30' : '21:00'
  const listo = (txt: string, deshacer: () => void) => { nav.hoja(null); aviso(`Añadido: ${txt}`, deshacer) }
  // Los botones de un toque (picoteo, bebida, plantillas) apuntaban dos veces con un doble toque.
  const unaVez = useUnaVez()

  const usar = unaVez(async (p: Plantilla, r: Racion) => {
    const des = await apuntarPlantilla(p, r, fecha, p.tipo === 'comida' ? franja : esHoy ? franjaPorHora(hora) : franja)
    const v = conRacion(p, r)
    listo(p.tipo === 'comida' ? `${p.nombre} (${r})` : `${p.nombre} (${kp(v.kcal, v.proteina, v.cafeina)})`, des)
  })
  const usarProducto = unaVez(async (p: Producto) => {
    const v = porRacion(p)
    const des = await apuntar({ fecha, hora, franja, nombre: p.nombre, kcal: v.kcal, proteina: v.proteina, cafeina: v.cafeina, racion: 'N', tipo: 'producto', codigo: p.codigo })
    listo(p.nombre, des)
  })
  // Copia de algo ya apuntado (sin la foto, que era de aquel día).
  const copia = (c: Comida) => apuntar({ fecha, hora, franja, nombre: c.nombre, kcal: c.kcal, proteina: c.proteina, cafeina: c.cafeina, racion: c.racion, tipo: c.tipo, plantillaId: c.plantillaId, codigo: c.codigo })
  const repetirAyer = unaVez(async () => {
    const deshacer = await Promise.all(ayer.map(copia))
    listo(ayer.length === 1 ? ayer[0]!.nombre : `${NOMBRE_FRANJA[franja].toLowerCase()} de ayer (${ayer.length})`, () => deshacer.forEach(d => d()))
  })
  const usarReciente = unaVez(async (c: Comida) => { listo(c.nombre, await copia(c)) })
  const guardarNota = unaVez(async () => {
    const nombre = texto.trim() || (foto ? 'Comida (foto)' : 'Comida')
    const des = await apuntar({ fecha, hora, franja, nombre, kcal, proteina: prot, racion: 'N', tipo: foto ? 'foto' : 'nota', foto })
    listo(`${nombre} (~${kcal} kcal)`, des)
  })
  const sacarFoto = async () => {
    const f = await hacerFoto(900)
    if (!f) return
    setFoto(f)
    setNota(true)
  }

  const q = normalizar(busca.trim())
  const encontrados = q.length >= 2
    ? [
        ...plantillas.filter(p => normalizar(p.nombre).includes(q)).map(p => ({ k: `p${p.id}`, nombre: p.nombre, sub: kp(p.kcal, p.proteina, p.cafeina), tipo: p.tipo as string, foto: p.foto, imagen: undefined as string | undefined, ir: () => void usar(p, 'N') })),
        ...productos.filter(p => !p.pendiente && (normalizar(p.nombre).includes(q) || normalizar(p.marca).includes(q))).map(p => { const v = porRacion(p); return { k: p.codigo, nombre: p.nombre, sub: `${p.marca ? `${p.marca} · ` : ''}${kp(v.kcal, v.proteina, v.cafeina)}`, tipo: 'producto', foto: undefined as Blob | undefined, imagen: p.imagen, ir: () => void usarProducto(p) } }),
      ].slice(0, 8)
    : []

  return (
    <Hoja titulo="Añadir" sub={esHoy ? 'Elegida por la hora · cámbiala si quieres' : `Para el ${fecha.split('-').reverse().slice(0, 2).join('/')}`} className="tall">
      <div className="chips eq">
        {FRANJAS.map(f => <Chip key={f.v} on={franja === f.v} onClick={() => setFranja(f.v)}>{NOMBRE_FRANJA[f.v]}</Chip>)}
      </div>
      <div className="grid3 mt12">
        <button className="qa" onClick={() => nav.ir('com-scan', { fecha, franja }, 'com')}><Ico n="barcode" /><span>Escanear</span></button>
        <button className={cx('qa', nota && 'on')} onClick={() => setNota(n => !n)}><Ico n="note-pencil" /><span>Nota rápida</span></button>
        <button className="qa" onClick={() => void sacarFoto()}><Ico n="camera" /><span>Foto</span></button>
      </div>

      <div className={cx('nota-r card pd mt8', nota && 'show')}>
        {fotoUrl && <img className="foto-prev mb8" src={fotoUrl} alt="Foto de la comida" />}
        <input className="inp" value={texto} onChange={e => setTexto(e.target.value)} placeholder={foto ? 'Qué es (opcional)' : 'Qué has comido · p. ej. Cena fuera'} aria-label="Qué has comido" />
        <div className="grid2 mt8">
          <Stepper className="sm" valor={kcal} onCambio={setKcal} paso={50} min={0} sufijo="kcal" etiqueta="kcal aproximadas" />
          <Stepper className="sm" valor={prot} onCambio={setProt} paso={5} min={0} sufijo="g prot." etiqueta="Proteína aproximada" />
        </div>
        <p className="small muted mt8">Aproximado vale: lo importante es apuntarlo.</p>
        <button className="btn sm mt8" onClick={() => void guardarNota()}>Añadir {foto ? 'foto' : 'nota'}</button>
      </div>

      <label className="search mt16">
        <Ico n="magnifying-glass" />
        <input className="inp" type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar en plantillas y productos" aria-label="Buscar en plantillas y productos" />
      </label>
      {q.length >= 2 && (
        <div className="list mt8">
          {encontrados.map(e => (
            <button key={e.k} className="it" onClick={e.ir}>
              <Mini nombre={e.nombre} tipo={e.tipo} foto={e.foto} imagen={e.imagen} />
              <span className="tx"><b>{e.nombre}</b><small className="mono">{e.sub}</small></span>
              <Ico n="plus" b className="car" />
            </button>
          ))}
          {!encontrados.length && <p className="small muted">Nada guardado con ese nombre. Usa la nota rápida o escanéalo.</p>}
        </div>
      )}

      {ayer.length > 0 && (
        <button className="card pd row w100 mt12" style={{ textAlign: 'left' }} onClick={() => void repetirAyer()}>
          <span className="ico okb"><Ico n="arrow-counter-clockwise" /></span>
          <span className="tx grow">
            <b>Lo de ayer: {NOMBRE_FRANJA[franja].toLowerCase()}</b>
            <small>{ayer.map(c => c.nombre).join(' + ')} · <span className="mono">{kp(ayer.reduce((t, c) => t + c.kcal, 0), ayer.reduce((t, c) => t + c.proteina, 0))}</span></small>
          </span>
          <Ico n="plus" b className="car" />
        </button>
      )}

      {recien.length > 0 && (
        <>
          <div className="sec-h mt16"><h2 className="h3">Recientes</h2><span className="lbl">Un toque</span></div>
          <div className="list">
            {recien.map(c => (
              <button key={`${c.fecha}-${c.hora}-${c.nombre}`} className="it" onClick={() => void usarReciente(c)}>
                <Mini nombre={c.nombre} tipo={c.tipo} />
                <span className="tx"><b>{c.nombre}</b><small className="mono">{kp(c.kcal, c.proteina, c.cafeina)}</small></span>
                <Ico n="plus" b className="car" />
              </button>
            ))}
          </div>
        </>
      )}

      {comidas.length > 0 && (
        <>
          <div className="sec-h mt16"><h2 className="h3">Plantillas</h2><span className="lbl">P pequeña · N normal · G grande</span></div>
          <div className="list">
            {comidas.map(p => (
              <div key={p.id} className="it tpl">
                <button className="tpl-m" onClick={() => void usar(p, 'N')}>
                  <Mini nombre={p.nombre} tipo={p.tipo} foto={p.foto} />
                  <span className="tx"><b>{p.nombre}</b><small className="mono">{kp(p.kcal, p.proteina)}</small></span>
                </button>
                <span className="png">
                  {(['P', 'N', 'G'] as const).map(r => <button key={r} className={cx(r === 'N' && 'on')} aria-label={`Ración ${r}`} onClick={() => void usar(p, r)}>{r}</button>)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div ref={picoteoRef} className="sec-h mt16"><h2 className="h3">Picoteo y bebida</h2><span className="lbl">Un toque</span></div>
      <div className="snk">
        {snacks.map(p => (
          <button key={p.id} onClick={() => void usar(p, 'N')}>
            <b>{p.nombre}</b>
            <small className="mono">{p.cafeina != null ? `${p.kcal < 20 ? '~' : ''}${p.kcal} kcal · ${p.cafeina} mg caf.` : `~${p.kcal} kcal`}</small>
          </button>
        ))}
      </div>
      <div className="row jb mt16">
        <button className="lnk" onClick={() => nav.hoja('sheet-plant', {})}><Ico n="plus" b /> Nueva plantilla</button>
        <button className="lnk" onClick={() => nav.ir('com-guard', undefined, 'com')}>Productos guardados <Ico n="caret-right" /></button>
      </div>
    </Hoja>
  )
}
