// COM-03 · Escáner: lee el código, lo busca en lo ya guardado y si no en Open Food Facts.
import { useEffect, useRef, useState } from 'react'
import { db } from '../../../datos/db'
import type { Franja, Producto } from '../../../datos/tipos'
import { buscarOFF, codigoValido, porRacion } from '../../../dominio/comida'
import { hoyISO } from '../../../dominio/fechas'
import { escanearNativo, esAndroid, vibrar } from '../../../plataforma'
import type { Camara } from '../../../plataforma/escanerWeb'
import { cx, Ico, Pantalla, Stepper, useUnaVez } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { Mini, apuntar, kp } from './comun'

type Estado =
  | { e: 'camara' }
  | { e: 'buscando'; codigo: string }
  | { e: 'encontrado'; p: Producto; ya: boolean }
  | { e: 'no'; codigo: string }
  | { e: 'offline'; codigo: string }
  | { e: 'sincamara'; motivo: string }

export function Escaner({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const fecha = typeof ruta.d?.fecha === 'string' ? ruta.d.fecha : hoyISO()
  const franja = ruta.d?.franja as Franja | undefined
  const [estado, setEstado] = useState<Estado>({ e: 'camara' })
  const [ronda, setRonda] = useState(0)
  const [escribir, setEscribir] = useState(false)
  const [codigoMano, setCodigoMano] = useState('')
  const [luz, setLuz] = useState(false)
  const [nombre, setNombre] = useState('')
  const [kcal, setKcal] = useState(250)
  const [prot, setProt] = useState(10)
  const video = useRef<HTMLVideoElement>(null)
  const camara = useRef<Camara | null>(null)

  const buscar = async (codigo: string) => {
    camara.current?.parar(); camara.current = null
    void vibrar('corta')
    setEstado({ e: 'buscando', codigo })
    const guardado = await db.productos.get(codigo)
    if (guardado && !guardado.pendiente) { setEstado({ e: 'encontrado', p: guardado, ya: true }); return }
    const r = await buscarOFF(codigo)
    if (r.estado === 'encontrado') {
      await db.productos.put(r.producto)
      setEstado({ e: 'encontrado', p: r.producto, ya: false })
    } else setEstado(r.estado === 'no' ? { e: 'no', codigo } : { e: 'offline', codigo })
  }

  useEffect(() => {
    if (estado.e !== 'camara' || escribir) return
    let cancelado = false
    void (async () => {
      if (esAndroid()) {
        const c = await escanearNativo()
        if (cancelado) return
        if (c === 'cancelado') { setEscribir(true); return }
        if (c) { void buscar(c); return }
      }
      try {
        const { abrirCamara } = await import('../../../plataforma/escanerWeb')
        if (cancelado || !video.current) return
        const cam = await abrirCamara(video.current, c => { if (!cancelado) void buscar(c) })
        if (cancelado) cam.parar(); else camara.current = cam
      } catch (e) {
        if (!cancelado) setEstado({ e: 'sincamara', motivo: String(e).includes('NotAllowed') ? 'No hay permiso para usar la cámara.' : 'No se ha podido abrir la cámara.' })
      }
    })()
    return () => { cancelado = true; camara.current?.parar(); camara.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ronda, escribir])

  const otraVez = () => { setEscribir(false); setEstado({ e: 'camara' }); setRonda(r => r + 1) }
  // Doble toque en «Añadir»: apuntaba dos veces y hacía «atrás» dos veces (salía también de la pantalla anterior).
  const unaVez = useUnaVez()
  const apuntarProducto = async (p: Producto) => {
    const v = porRacion(p)
    const des = await apuntar({ fecha, franja, nombre: p.nombre, kcal: v.kcal, proteina: v.proteina, cafeina: v.cafeina, racion: 'N', tipo: 'producto', codigo: p.codigo })
    nav.atras()
    aviso(`Añadido: ${p.nombre} (${kp(v.kcal, v.proteina, v.cafeina)})`, des)
  }
  const anadir = unaVez(apuntarProducto)
  const anadirAMano = unaVez(async (codigo: string) => {
    const p: Producto = { codigo, nombre: nombre.trim() || `Producto ${codigo}`, marca: '', kcal100: null, proteina100: null, racionG: null, kcalRacion: kcal, proteinaRacion: prot, guardado: new Date().toISOString(), manual: true }
    await db.productos.put(p)
    await apuntarProducto(p)
  })
  const salirPendiente = unaVez(async (codigo: string, comoNota: boolean) => {
    await guardarPendiente(codigo)
    nav.atras()
    if (comoNota) nav.hoja('sheet-add', { fecha, franja, nota: true })
    else aviso('Guardado para buscarlo luego')
  })
  const guardarPendiente = async (codigo: string) => {
    await db.productos.put({ codigo, nombre: `Código ${codigo}`, marca: '', kcal100: null, proteina100: null, racionG: null, kcalRacion: null, proteinaRacion: null, guardado: new Date().toISOString(), pendiente: true })
  }

  const enCamara = estado.e === 'camara' && !escribir

  return (
    <Pantalla full>
      <div className={cx('cam', enCamara && 'live')}>
        {enCamara && <video ref={video} className="scanner-video" playsInline muted aria-hidden="true" />}
        <div className="cam-top" style={{ position: 'relative' }}>
          <button className="cam-b" aria-label="Cerrar" onClick={() => nav.atras()}><Ico n="x" b /></button>
          <span className="cam-t">Escanear código</span>
          {enCamara && !esAndroid()
            ? <button className={cx('cam-b', luz && 'on')} aria-label="Linterna" onClick={async () => { const ok = await camara.current?.linterna(!luz); if (ok) setLuz(!luz); else aviso('Este móvil no deja encender la linterna desde aquí') }}><Ico n="flashlight" b /></button>
            : <span style={{ width: 48 }} />}
        </div>
        {enCamara && (
          <>
            <div className="vf">
              <span className="vf-c tl" /><span className="vf-c tr" /><span className="vf-c bl" /><span className="vf-c br" />
              <span className="laser" />
            </div>
            <p className="cam-hint" style={{ position: 'relative' }}>Pon el código dentro del recuadro</p>
          </>
        )}
        <div className="chips cam-demo">
          {!escribir && <button className="chip" onClick={() => setEscribir(true)}><Ico n="keyboard" /> Escribir el código</button>}
          {escribir && estado.e === 'camara' && <button className="chip" onClick={otraVez}><Ico n="camera" /> Usar la cámara</button>}
        </div>

        {(escribir && estado.e === 'camara') && (
          <div className="cam-panel">
            <p className="lbl fl">Número debajo de las barras</p>
            <input className="inp inp-num" inputMode="numeric" autoFocus value={codigoMano} onChange={e => setCodigoMano(e.target.value.replace(/\D/g, ''))} placeholder="8480000123458" aria-label="Código de barras" />
            <button className="btn mt12" disabled={!codigoValido(codigoMano)} onClick={() => void buscar(codigoMano)}>Buscar</button>
          </div>
        )}

        {estado.e === 'buscando' && (
          <div className="cam-panel"><p className="row"><Ico n="spinner" className="blue" /> <b>Buscando {estado.codigo}…</b></p></div>
        )}

        {estado.e === 'sincamara' && (
          <div className="cam-panel">
            <p className="row"><span className="ico badb"><Ico n="camera-slash" /></span><span className="tx"><b>{estado.motivo}</b><small>Puedes escribir el número del código.</small></span></p>
            <button className="btn mt12" onClick={() => { setEstado({ e: 'camara' }); setEscribir(true) }}>Escribir el código</button>
          </div>
        )}

        {estado.e === 'encontrado' && (() => {
          const v = porRacion(estado.p)
          return (
            <div className="cam-panel">
              <div className="row">
                <Mini nombre={estado.p.nombre} imagen={estado.p.imagen} className="l" />
                <div className="grow">
                  {estado.ya ? <span className="tag blue"><Ico n="lightning" b />Al instante</span> : <span className="tag ok"><Ico n="check" b />Encontrado</span>}
                  <b className="d-block">{estado.p.nombre}</b>
                  <small className="muted">{estado.ya ? 'Ya lo tenías · ' : estado.p.marca ? `${estado.p.marca} · ` : ''}<span className="mono">{kp(v.kcal, v.proteina, v.cafeina)}</span> {v.base === 'racion' ? 'por ración' : 'por 100 g'}</small>
                </div>
              </div>
              <div className="btns mt12">
                <button className="btn gry sm" onClick={() => nav.reemplazar('com-prod', { codigo: estado.p.codigo, fecha, franja })}>Ver producto</button>
                <button className="btn sm" onClick={() => void anadir(estado.p)}>Añadir</button>
              </div>
              <button className="lnk mt12" onClick={otraVez}><Ico n="barcode" /> Escanear otro</button>
            </div>
          )
        })()}

        {estado.e === 'no' && (
          <div className="cam-panel">
            <p className="row"><span className="tag warn">No está</span><b>No está en la base de datos</b></p>
            <input className="inp mt8" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Nombre del producto" aria-label="Nombre del producto" />
            <div className="grid2 mt8">
              <Stepper className="sm" valor={kcal} onCambio={setKcal} paso={10} min={0} sufijo="kcal" etiqueta="kcal por envase" />
              <Stepper className="sm" valor={prot} onCambio={setProt} paso={1} min={0} sufijo="g prot." etiqueta="Proteína por envase" />
            </div>
            <p className="small muted mt8">Mira la etiqueta: lo que trae el envase entero o la ración que te comes. Se guarda para la próxima vez.</p>
            <button className="btn mt8" onClick={() => void anadirAMano(estado.codigo)}>Añadir a mano</button>
            <button className="lnk mt12" onClick={otraVez}><Ico n="barcode" /> Escanear otro</button>
          </div>
        )}

        {estado.e === 'offline' && (
          <div className="cam-panel">
            <p className="row"><span className="ico badb"><Ico n="wifi-slash" /></span><span className="tx"><b>Sin conexión</b><small>Lo buscaremos al volver a tener cobertura (Comida → Productos).</small></span></p>
            <div className="btns mt12">
              <button className="btn gry sm" onClick={() => void salirPendiente(estado.codigo, false)}>Vale</button>
              <button className="btn sm" onClick={() => void salirPendiente(estado.codigo, true)}>Apuntar como nota</button>
            </div>
          </div>
        )}
      </div>
    </Pantalla>
  )
}
