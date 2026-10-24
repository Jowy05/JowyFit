// COM-02 · Añadir. Ordenado para quien no lee: arriba del todo, «Escribir lo que he comido» (con Escanear y Foto al lado),
// que sirve para cualquier plato; luego lo de ayer, recientes, Comidas, picoteo y bebida de un toque y, al final, buscar.
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { comidasEntre, leerPlantillas, leerProductos } from '../../datos/consultas'
import type { Comida, Franja, Plantilla, Producto } from '../../datos/tipos'
import { FRANJAS, TAMANOS_NOTA, conRacion, deAyer, franjaPorHora, nombreFranja, notaPorTamano, ordenarPlantillas, porRacion, recientes, soloMacros, textoRacion, type Racion, type TamanoNota } from '../../dominio/comida'
import { idioma, t, tc } from '../../i18n'
import { horaActual, hoyISO, sumarDias } from '../../dominio/fechas'
import { normalizar } from '../../catalogo/catalogo'
import { hacerFoto } from '../../plataforma'
import { Chip, cx, Hoja, Ico, Stepper, useUnaVez, recortar, LARGO, useUrlBlob } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { ElegirCuanto, Mini, baseDeApuntada, kp, type ParaElegir } from './comun'
import { apuntar, apuntarPlantilla } from '../../datos/acciones/comida'

/** Comidas guardadas a la vista antes de «Ver todas». */
const MAX_COMIDAS = 5
const MAX_RECIENTES = 4

/** Texto del botón de picoteo/bebida, siempre con unidades. */
const textoSnack = (p: Plantilla) => p.cafeina != null
  ? `${p.kcal < 20 ? '~' : ''}${t('{kcal} kcal · {mg} mg cafeína', { kcal: p.kcal, mg: p.cafeina })}`
  : `~${p.kcal} kcal`

export function HojaAnadir({ ruta }: { ruta: Ruta<'hoja-anadir'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const fecha = ruta.d?.fecha ?? hoyISO()
  const esHoy = fecha === hoyISO()
  const [franja, setFranja] = useState<Franja>(ruta.d?.franja ?? franjaPorHora(horaActual()))
  const [nota, setNota] = useState(!!ruta.d?.nota)
  const [texto, setTexto] = useState('')
  // «Escribir lo que he comido»: por defecto «Normal» (según el momento del día); los números, solo para quien quiera afinar.
  const [tam, setTam] = useState<TamanoNota | null>('normal')
  const [manual, setManual] = useState({ kcal: 600, prot: 25 })
  const [foto, setFoto] = useState<Blob | undefined>()
  const [busca, setBusca] = useState('')
  const [todas, setTodas] = useState(false)
  const fotoUrl = useUrlBlob(foto)
  const notaRef = useRef<HTMLDivElement>(null)
  const notaInput = useRef<HTMLInputElement>(null)
  const plantillas = useLiveQuery(leerPlantillas, []) ?? []
  const productos = useLiveQuery(leerProductos, []) ?? []
  const ultimas = useLiveQuery(() => comidasEntre(sumarDias(fecha, -14), fecha), [fecha]) ?? []
  const ayer = deAyer(ultimas, sumarDias(fecha, -1), franja)
  const recien = recientes(ultimas, fecha, plantillas, MAX_RECIENTES)
  const comidas = ordenarPlantillas(plantillas.filter(p => p.tipo === 'comida'))
  const picoteos = ordenarPlantillas(plantillas.filter(p => p.tipo === 'picoteo'))
  const bebidas = ordenarPlantillas(plantillas.filter(p => p.tipo === 'bebida'))
  const tipico = tam ? notaPorTamano(tam, franja) : null
  const kcal = tipico ? tipico.kcal : manual.kcal
  const prot = tipico ? tipico.proteina : manual.prot

  // Al abrir «Escribir lo que he comido», que se vea entera.
  useEffect(() => {
    if (nota) notaRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [nota])
  /** Abre la nota (con el nombre ya escrito si viene de la búsqueda) y la enseña. */
  const abrirNota = (nombre?: string) => {
    if (nombre) setTexto(nombre)
    setNota(true)
    window.setTimeout(() => {
      notaRef.current?.scrollIntoView?.({ block: 'center' })
      if (!nombre) notaInput.current?.focus()
    }, 30)
  }

  const hora = esHoy ? horaActual() : franja === 'desayuno' ? '08:00' : franja === 'comida' ? '14:00' : franja === 'merienda' ? '17:30' : '21:00'
  const listo = (txt: string, deshacer: () => void) => { setElegir(null); nav.hoja(null); aviso(t('Añadido: {nombre}', { nombre: txt }), deshacer) }
  // Tocar cualquier cosa abre «¿Cuánto?» (Poco · Normal · Mucho); se apunta lo que se elija.
  const [elegir, setElegir] = useState<ParaElegir | null>(null)
  // Los botones de un toque (picoteo, bebida, Mis comidas) no apuntan dos veces con un doble toque.
  const unaVez = useUnaVez()

  const usar = unaVez(async (p: Plantilla, r: Racion) => {
    const des = await apuntarPlantilla(p, r, fecha, p.tipo === 'comida' ? franja : esHoy ? franjaPorHora(hora) : franja)
    const v = conRacion(p, r, p.tipo)
    listo(p.tipo === 'comida' ? `${t(p.nombre)}${r !== 'N' ? ` (${textoRacion(r)})` : ''}` : `${t(p.nombre)} (${kp(v.kcal, v.proteina, v.cafeina)})`, des)
  })
  const usarProducto = unaVez(async (p: Producto, r: Racion) => {
    const { base: _, ...v } = porRacion(p)
    const des = await apuntar({ fecha, hora, franja, nombre: p.nombre, ...conRacion(v, r), racion: r, tipo: 'producto', codigo: p.codigo })
    listo(`${p.nombre}${r !== 'N' ? ` (${textoRacion(r)})` : ''}`, des)
  })
  // Copia de algo ya apuntado (sin la foto, que era de aquel día).
  const copia = (c: Comida) => apuntar({ fecha, hora, franja, nombre: c.nombre, kcal: c.kcal, proteina: c.proteina, cafeina: c.cafeina, ...soloMacros(c), racion: c.racion, tipo: c.tipo, plantillaId: c.plantillaId, codigo: c.codigo })
  const repetirAyer = unaVez(async () => {
    const deshacer = await Promise.all(ayer.map(copia))
    listo(ayer.length === 1 ? t(ayer[0]!.nombre) : t('{franja} de ayer ({n})', { franja: nombreFranja(franja).toLowerCase(), n: ayer.length }), () => deshacer.forEach(d => d()))
  })
  // Lo reciente se repite en la ración que se elija, contando desde lo que era su «Normal».
  const usarReciente = unaVez(async (c: Comida, r: Racion) => {
    const v = conRacion(baseDeApuntada(c), r, c.tipo)
    const des = await apuntar({ fecha, hora, franja, nombre: c.nombre, ...v, racion: r, tipo: c.tipo, plantillaId: c.plantillaId, codigo: c.codigo })
    listo(`${t(c.nombre)}${r !== 'N' ? ` (${textoRacion(r)})` : ''}`, des)
  })
  const pedirPlantilla = (p: Plantilla) => setElegir({ nombre: t(p.nombre), base: p, tipo: p.tipo, elegir: r => void usar(p, r) })
  const pedirProducto = (p: Producto) => { const { base: _, ...v } = porRacion(p); setElegir({ nombre: p.nombre, base: v, tipo: 'producto', elegir: r => void usarProducto(p, r) }) }
  const pedirReciente = (c: Comida) => setElegir({ nombre: t(c.nombre), base: baseDeApuntada(c), tipo: c.tipo, elegir: r => void usarReciente(c, r) })
  const guardarNota = unaVez(async () => {
    // El nombre que se pone solo, en el idioma de la app («Comida» aquí es un plato: en inglés «Meal», no «Food»).
    const nombre = texto.trim() || (foto ? t('Comida (foto)') : tc('plato', 'Comida'))
    const des = await apuntar({ fecha, hora, franja, nombre, kcal, proteina: prot, racion: 'N', tipo: foto ? 'foto' : 'nota', foto })
    listo(`${nombre} (~${kcal} kcal)`, des)
  })
  const afinar = (c: Partial<{ kcal: number; prot: number }>) => { setManual({ kcal, prot, ...c }); setTam(null) }
  const sacarFoto = async () => {
    const f = await hacerFoto(900)
    if (!f) return
    setFoto(f)
    setNota(true)
  }

  const q = normalizar(busca.trim())
  const encontrados = q.length >= 2
    ? [
        ...plantillas.filter(p => normalizar(t(p.nombre)).includes(q)).map(p => ({ k: `p${p.id}`, nombre: t(p.nombre), sub: kp(p.kcal, p.proteina, p.cafeina), tipo: p.tipo as string, foto: p.foto, imagen: undefined as string | undefined, ir: () => pedirPlantilla(p) })),
        ...productos.filter(p => !p.pendiente && (normalizar(p.nombre).includes(q) || normalizar(p.marca).includes(q))).map(p => { const v = porRacion(p); return { k: p.codigo, nombre: p.nombre, sub: `${p.marca ? `${p.marca} · ` : ''}${kp(v.kcal, v.proteina, v.cafeina)}`, tipo: 'producto', foto: undefined as Blob | undefined, imagen: p.imagen, ir: () => pedirProducto(p) } }),
      ].slice(0, 8)
    : []
  const comidasVista = todas ? comidas : comidas.slice(0, MAX_COMIDAS)
  // «13/10»; en inglés, mes delante («10/13»).
  const [, mes, dia] = fecha.split('-')
  const diaYMes = idioma() === 'en' ? `${mes}/${dia}` : `${dia}/${mes}`

  return (
    <Hoja titulo={t('Añadir')} sub={esHoy ? t('Toca lo que has tomado y elige cuánto') : t('Para el {fecha}', { fecha: diaYMes })} className="tall">
      <p className="lbl fl">{esHoy ? t('Cuándo · elegido por la hora') : t('Cuándo')}</p>
      <div className="chips eq">
        {FRANJAS.map(f => <Chip key={f.v} on={franja === f.v} onClick={() => setFranja(f.v)}>{nombreFranja(f.v)}</Chip>)}
      </div>

      {/* Lo que sirve para cualquier plato, arriba del todo: escribirlo (en el centro, más ancho), escanearlo o hacerle una foto. */}
      <div className="grid3 ux-com-qa3 mt12">
        <button className="qa" onClick={() => nav.ir('escaner', { fecha, franja }, 'com')}><Ico n="barcode" /><span>{t('Escanear')}</span></button>
        <button className={cx('qa ux-com-escribir', nota && 'on')} aria-expanded={nota} onClick={() => (nota ? setNota(false) : abrirNota())}><Ico n="note-pencil" /><span>{t('Escribir lo que he comido')}</span></button>
        <button className="qa" onClick={() => void sacarFoto()}><Ico n="camera" /><span>{t('Foto')}</span></button>
      </div>

      <div ref={notaRef} className={cx('nota-r card pd mt8', nota && 'show')}>
        {fotoUrl && <img className="foto-prev mb8" src={fotoUrl} alt={t('Foto de la comida')} />}
        <input ref={notaInput} className="inp" maxLength={LARGO.nombre} value={texto} onChange={e => setTexto(e.target.value)} placeholder={foto ? t('Qué es (opcional)') : t('Qué has comido · p. ej. Lentejas')} aria-label={t('Qué has comido')} />
        <p className="lbl fl mt12">{t('¿Cuánto has comido?')}</p>
        <div className="chips eq">
          {TAMANOS_NOTA.map(x => {
            const v = notaPorTamano(x.v, franja)
            return (
              <Chip key={x.v} className="big ux-com-tam" on={tam === x.v} onClick={() => setTam(x.v)}>
                <span>{t(x.t)}<small className="mono">~{v.kcal} kcal</small></span>
              </Chip>
            )
          })}
        </div>
        <details className="ux-com-afinar mt8">
          <summary>
            <span>{t('Afinar:')} <span className="mono">{t('{kcal} kcal · {g} g proteína', { kcal, g: prot })}</span></span>
            <Ico n="caret-down" />
          </summary>
          <div className="grid2 mt8">
            <Stepper className="sm" valor={kcal} onCambio={v => afinar({ kcal: v })} paso={50} min={0} sufijo="kcal" etiqueta={t('kcal aproximadas')} />
            <Stepper className="sm" valor={prot} onCambio={v => afinar({ prot: v })} paso={5} min={0} sufijo={t('g prot.')} etiqueta={t('Proteína aproximada')} />
          </div>
        </details>
        <p className="small muted mt8">{t('Aproximado vale: lo importante es apuntarlo.')}</p>
        <button className="btn mt8" onClick={() => void guardarNota()}>{t('Apuntar')}</button>
      </div>

      {ayer.length > 0 && (
        <button className="card pd row w100 mt12" style={{ textAlign: 'left' }} onClick={() => void repetirAyer()}>
          <span className="ico okb"><Ico n="arrow-counter-clockwise" /></span>
          <span className="tx grow">
            <b>{t('Lo de ayer: {franja}', { franja: nombreFranja(franja).toLowerCase() })}</b>
            <small>{ayer.map(c => t(c.nombre)).join(' + ')} · <span className="mono">{kp(ayer.reduce((s, c) => s + c.kcal, 0), ayer.reduce((s, c) => s + c.proteina, 0))}</span></small>
          </span>
          <Ico n="plus" b className="car" />
        </button>
      )}

      {recien.length > 0 && (
        <>
          <div className="sec-h mt16"><h2 className="h3">{t('Recientes')}</h2><span className="lbl">{t('Toca para apuntar')}</span></div>
          <div className="list">
            {recien.map(c => (
              <button key={`${c.fecha}-${c.hora}-${c.nombre}`} className="it" onClick={() => pedirReciente(c)}>
                <Mini nombre={c.nombre} tipo={c.tipo} />
                <span className="tx"><b>{recortar(t(c.nombre))}</b><small className="mono">{kp(c.kcal, c.proteina, c.cafeina)}</small></span>
                <Ico n="plus" b className="car" />
              </button>
            ))}
          </div>
        </>
      )}

      {comidas.length > 0 && (
        <>
          <div className="sec-h mt16"><h2 className="h3">{t('Comidas')}</h2><span className="lbl">{t('Toca para apuntar')}</span></div>
          <div className="list">
            {comidasVista.map(p => (
              <button key={p.id} className="it" onClick={() => pedirPlantilla(p)}>
                <Mini nombre={p.nombre} tipo={p.tipo} foto={p.foto} />
                <span className="tx"><b>{recortar(t(p.nombre))}</b><small className="mono">{kp(p.kcal, p.proteina)}</small></span>
                <Ico n="plus" b className="car" />
              </button>
            ))}
          </div>
          {comidas.length > MAX_COMIDAS && (
            <button className="lnk mt12" onClick={() => setTodas(v => !v)}>
              {todas ? t('Ver menos') : t('Ver las {n}', { n: comidas.length })} <Ico n={todas ? 'caret-up' : 'caret-down'} />
            </button>
          )}
        </>
      )}

      <div className="sec-h mt16"><h2 className="h3">{t('Picoteo')}</h2><span className="lbl">{t('Toca para apuntar')}</span></div>
      {picoteos.length > 0 && (
        <div className="list">
          {picoteos.map(p => (
            <button key={p.id} className="it" onClick={() => pedirPlantilla(p)}>
              <Mini nombre={p.nombre} tipo={p.tipo} foto={p.foto} />
              <span className="tx"><b>{recortar(t(p.nombre))}</b><small className="mono">{t('entero: {n} kcal', { n: p.kcal })}</small></span>
              <Ico n="plus" b className="car" />
            </button>
          ))}
        </div>
      )}
      <div className="sec-h mt16"><h2 className="h3">{t('Bebida')}</h2><span className="lbl">{t('Toca para apuntar')}</span></div>
      <div className="snk">
        {bebidas.map(p => (
          <button key={p.id} onClick={() => pedirPlantilla(p)}>
            <b>{recortar(t(p.nombre))}</b>
            <small className="mono">{textoSnack(p)}</small>
          </button>
        ))}
      </div>

      <div className="sec-h mt20"><h2 className="h3">{t('¿No está aquí?')}</h2></div>
      <label className="search">
        <Ico n="magnifying-glass" />
        <input className="inp" type="search" maxLength={LARGO.buscar} value={busca} onChange={e => setBusca(e.target.value)} placeholder={t('Buscar en lo guardado')} aria-label={t('Buscar en Mis comidas y escaneados')} />
      </label>
      {q.length >= 2 && encontrados.length > 0 && (
        <div className="list mt8">
          {encontrados.map(e => (
            <button key={e.k} className="it" onClick={e.ir}>
              <Mini nombre={e.nombre} tipo={e.tipo} foto={e.foto} imagen={e.imagen} />
              <span className="tx"><b>{recortar(e.nombre)}</b><small className="mono">{e.sub}</small></span>
              <Ico n="plus" b className="car" />
            </button>
          ))}
        </div>
      )}
      {q.length >= 2 && !encontrados.length && (
        <div className="mt8">
          <p className="small muted">{t('No tienes nada guardado con ese nombre. Apúntalo igual:')}</p>
          <button className="btn ln sm mt8 ux-com-apuntar" onClick={() => abrirNota(busca.trim())}><Ico n="note-pencil" />{t('Apuntar «{texto}»', { texto: busca.trim() })}</button>
        </div>
      )}

      <div className="row jb mt16">
        <button className="lnk" onClick={() => nav.hoja('hoja-plantilla', { fecha, franja })}><Ico n="bowl-food" /> {t('Crear comida nueva')}</button>
        <button className="lnk" onClick={() => nav.ir('plantillas', undefined, 'com')}>{t('Mis comidas')} <Ico n="caret-right" /></button>
      </div>
      <ElegirCuanto x={elegir} onCerrar={() => setElegir(null)} />
    </Hoja>
  )
}
