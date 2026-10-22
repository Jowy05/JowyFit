// COM-03 · Escáner: lee el código, lo busca en lo ya guardado y si no en Open Food Facts.
import { useEffect, useRef, useState } from 'react'
import { db } from '../../datos/db'
import type { Producto } from '../../datos/tipos'
import { buscarOFF, codigoValido, porRacion } from '../../dominio/comida'
import { hoyISO } from '../../dominio/fechas'
import { escanearNativo, esAndroid, vibrar } from '../../plataforma'
import type { Camara } from '../../plataforma/escanerWeb'
import { cx, Ico, Pantalla, Stepper, useUnaVez, recortar, LARGO } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { LineaMacros, Mini, kp } from './comun'
import { apuntar, guardarProducto } from '../../datos/acciones/comida'
import { t } from '../../i18n'

type Estado =
  | { e: 'camara' }
  | { e: 'buscando'; codigo: string }
  | { e: 'encontrado'; p: Producto; ya: boolean }
  | { e: 'no'; codigo: string }
  | { e: 'offline'; codigo: string }
  | { e: 'sincamara'; motivo: string }

export function Escaner({ ruta }: { ruta: Ruta<'com-scan'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const fecha = ruta.d?.fecha ?? hoyISO()
  const franja = ruta.d?.franja
  const [estado, setEstado] = useState<Estado>({ e: 'camara' })
  const [ronda, setRonda] = useState(0)
  const [escribir, setEscribir] = useState(false)
  const [codigoMano, setCodigoMano] = useState('')
  const [luz, setLuz] = useState(false)
  // La linterna solo se enseña si la cámara deja encenderla (en iPhone casi nunca).
  const [hayLuz, setHayLuz] = useState(false)
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
      await guardarProducto(r.producto)
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
        const { abrirCamara } = await import('../../plataforma/escanerWeb')
        if (cancelado || !video.current) return
        const cam = await abrirCamara(video.current, c => { if (!cancelado) void buscar(c) })
        if (cancelado) cam.parar(); else { camara.current = cam; setHayLuz(cam.tieneLinterna) }
      } catch (e) {
        if (!cancelado) setEstado({ e: 'sincamara', motivo: String(e).includes('NotAllowed') ? t('No hay permiso para usar la cámara.') : t('No se ha podido abrir la cámara.') })
      }
    })()
    return () => { cancelado = true; camara.current?.parar(); camara.current = null }
  }, [ronda, escribir])

  const otraVez = () => { setEscribir(false); setEstado({ e: 'camara' }); setRonda(r => r + 1) }
  // Un doble toque en «Añadir» no apunta dos veces ni hace dos «atrás» (saldría también de la pantalla anterior).
  const unaVez = useUnaVez()
  const apuntarProducto = async (p: Producto) => {
    const { base: _, ...v } = porRacion(p)
    // Con lo que traiga la etiqueta: hidratos, azúcares, grasas y sal se apuntan también.
    const des = await apuntar({ fecha, franja, nombre: p.nombre, ...v, racion: 'N', tipo: 'producto', codigo: p.codigo })
    nav.atras()
    aviso(t('Añadido: {nombre}', { nombre: `${p.nombre} (${kp(v.kcal, v.proteina, v.cafeina)})` }), des)
  }
  const anadir = unaVez(apuntarProducto)
  const anadirAMano = unaVez(async (codigo: string) => {
    const p: Producto = { codigo, nombre: nombre.trim() || t('Producto {codigo}', { codigo }), marca: '', kcal100: null, proteina100: null, racionG: null, kcalRacion: kcal, proteinaRacion: prot, guardado: new Date().toISOString(), manual: true }
    await guardarProducto(p)
    await apuntarProducto(p)
  })
  const salirPendiente = unaVez(async (codigo: string, comoNota: boolean) => {
    await guardarPendiente(codigo)
    nav.atras()
    if (comoNota) nav.hoja('sheet-add', { fecha, franja, nota: true })
    else aviso(t('Guardado para buscarlo luego'))
  })
  const guardarPendiente = async (codigo: string) => {
    await guardarProducto({ codigo, nombre: t('Código {codigo}', { codigo }), marca: '', kcal100: null, proteina100: null, racionG: null, kcalRacion: null, proteinaRacion: null, guardado: new Date().toISOString(), pendiente: true })
  }

  const enCamara = estado.e === 'camara' && !escribir

  return (
    <Pantalla full>
      <div className={cx('cam', enCamara && 'live')}>
        {enCamara && <video ref={video} className="scanner-video" playsInline muted aria-hidden="true" />}
        <div className="cam-top" style={{ position: 'relative' }}>
          <button className="cam-b" aria-label={t('Cerrar')} onClick={() => nav.atras()}><Ico n="x" b /></button>
          <span className="cam-t">{t('Escanear código')}</span>
          {enCamara && !esAndroid() && hayLuz
            ? <button className={cx('cam-b', luz && 'on')} aria-label={t('Linterna')} onClick={async () => { const ok = await camara.current?.linterna(!luz); if (ok) setLuz(!luz); else aviso(t('Este móvil no deja encender la linterna desde aquí')) }}><Ico n="flashlight" b /></button>
            : <span style={{ width: 48 }} />}
        </div>
        {enCamara && (
          <>
            <div className="vf">
              <span className="vf-c tl" /><span className="vf-c tr" /><span className="vf-c bl" /><span className="vf-c br" />
              <span className="laser" />
            </div>
            <p className="cam-hint" style={{ position: 'relative' }}>{t('Apunta al código de barras del envase: se lee solo')}</p>
          </>
        )}
        <div className="chips cam-demo">
          {enCamara && <button className="chip" onClick={() => setEscribir(true)}><Ico n="keyboard" /> {t('Escribir el código')}</button>}
          {escribir && estado.e === 'camara' && <button className="chip" onClick={otraVez}><Ico n="camera" /> {t('Usar la cámara')}</button>}
        </div>

        {(escribir && estado.e === 'camara') && (
          <div className="cam-panel">
            <p className="lbl fl">{t('Escribe el número que hay debajo de las barras')}</p>
            <input className="inp inp-num" inputMode="numeric" autoFocus maxLength={14} value={codigoMano} onChange={e => setCodigoMano(e.target.value.replace(/\D/g, ''))} placeholder="8480000123458" aria-label={t('Código de barras')} />
            <button className="btn mt12" disabled={!codigoValido(codigoMano)} onClick={() => void buscar(codigoMano)}>{t('Buscar')}</button>
          </div>
        )}

        {estado.e === 'buscando' && (
          <div className="cam-panel"><p className="row"><Ico n="spinner" className="blue" /> <b>{t('Buscando {codigo}…', { codigo: estado.codigo })}</b></p></div>
        )}

        {estado.e === 'sincamara' && (
          <div className="cam-panel">
            <p className="row"><span className="ico badb"><Ico n="camera-slash" /></span><span className="tx"><b>{estado.motivo}</b><small>{t('No pasa nada: escribe el número que hay debajo de las barras.')}</small></span></p>
            <button className="btn mt12" onClick={() => { setEstado({ e: 'camara' }); setEscribir(true) }}><Ico n="keyboard" b />{t('Escribir el código')}</button>
          </div>
        )}

        {estado.e === 'encontrado' && (() => {
          const v = porRacion(estado.p)
          return (
            <div className="cam-panel">
              <div className="row">
                <Mini nombre={estado.p.nombre} imagen={estado.p.imagen} className="l" />
                <div className="grow">
                  {estado.ya ? <span className="tag blue"><Ico n="check" b />{t('Ya lo tenías')}</span> : <span className="tag ok"><Ico n="check" b />{t('Encontrado')}</span>}
                  <b className="d-block">{recortar(estado.p.nombre)}</b>
                  <small className="muted">{estado.p.marca ? `${estado.p.marca} · ` : ''}<span className="mono">{kp(v.kcal, v.proteina, v.cafeina)}</span> {v.base === 'racion' ? t('por ración') : t('por 100 g')}</small>
                </div>
              </div>
              <LineaMacros m={v} className="mt8" />
              <button className="btn mt12" onClick={() => void anadir(estado.p)}><Ico n="plus" b />{t('Añadir')}</button>
              <div className="btns mt8">
                <button className="btn gry sm" onClick={() => nav.reemplazar('com-prod', { codigo: estado.p.codigo, fecha, franja })}>{t('Ver producto')}</button>
                <button className="btn ln sm" onClick={otraVez}><Ico n="barcode" /> {t('Escanear otro')}</button>
              </div>
              <p className="small muted mt8">{t('En «Ver producto» puedes elegir otra cantidad.')}</p>
            </div>
          )
        })()}

        {estado.e === 'no' && (
          <div className="cam-panel">
            <p className="row"><span className="tag warn">{t('No está')}</span><b>{t('No está en la base de datos')}</b></p>
            <p className="small muted mt4">{t('Apúntalo tú: mira la etiqueta del envase.')}</p>
            <input className="inp mt8" maxLength={LARGO.nombre} value={nombre} onChange={e => setNombre(e.target.value)} placeholder={t('Nombre del producto')} aria-label={t('Nombre del producto')} />
            <div className="grid2 mt8">
              <Stepper className="sm" valor={kcal} onCambio={setKcal} paso={10} min={0} sufijo="kcal" etiqueta={t('kcal por envase')} />
              <Stepper className="sm" valor={prot} onCambio={setProt} paso={1} min={0} sufijo={t('g prot.')} etiqueta={t('Proteína por envase')} />
            </div>
            <p className="small muted mt8">{t('Lo que trae el envase entero o la ración que te comes. Se guarda para la próxima vez.')}</p>
            <button className="btn mt8" onClick={() => void anadirAMano(estado.codigo)}>{t('Añadir a mano')}</button>
            <button className="lnk mt12" onClick={otraVez}><Ico n="barcode" /> {t('Escanear otro')}</button>
          </div>
        )}

        {estado.e === 'offline' && (
          <div className="cam-panel">
            <p className="row"><span className="ico badb"><Ico n="wifi-slash" /></span><span className="tx"><b>{t('Sin conexión')}</b><small>{t('Lo guardamos y lo buscamos solo al volver la cobertura (lo verás en Comida → Mis comidas).')}</small></span></p>
            <div className="btns mt12">
              <button className="btn gry sm" onClick={() => void salirPendiente(estado.codigo, false)}>{t('Vale')}</button>
              <button className="btn sm" onClick={() => void salirPendiente(estado.codigo, true)}>{t('Apuntar como nota')}</button>
            </div>
          </div>
        )}
      </div>
    </Pantalla>
  )
}
