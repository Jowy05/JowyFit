// RUT-09 · Reto en curso: cámara local con detección de postura (flexiones, sentadillas, plancha)
// o modo manual, cuenta atrás de colocación, cronómetro de 60 s / contrarreloj y guardado de marca.
import { useEffect, useRef, useState } from 'react'
import { guardarIntentoReto } from '../../datos/acciones/retos'
import { useAjustes, useRetos } from '../../datos/hooks'
import { cuentaAtras } from '../../dominio/fotos'
import { estadoPosturaInicial, evaluarPostura, type EstadoPostura } from '../../dominio/postura'
import {
  esNuevoRecordReto, formatoTiempoReto, mejorMarcaReto, retoDe, textoComparativaRecord, textoMarcaReto, textoRetoHoy,
} from '../../dominio/retos'
import {
  abrirCamaraPostura, capacidades, dibujarPostura, falloCamara, pantallaEncendida, pitido, tic, vibrar,
  type CamaraPostura, type FalloCamara, type LadoCamara,
} from '../../plataforma'
import { Barra, Chip, cx, Ico, Pantalla, useUnaVez } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { t, tn } from '../../i18n'

type FaseReto = 'listo' | 'cuenta' | 'curso' | 'fin'

const SEGUNDOS_PREP = 3

export function RetoActivo({ ruta }: { ruta: Ruta<'reto-activo'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const ajustes = useAjustes()
  const intentos = useRetos()
  const def = retoDe(ruta.d.reto)
  const mejor = mejorMarcaReto(intentos, def.id)
  const cap = capacidades()

  const [modo, setModo] = useState<'camara' | 'manual'>(cap.camaraEnVivo ? 'camara' : 'manual')
  const [lado, setLado] = useState<LadoCamara>('delantera')
  const [camEstado, setCamEstado] = useState<'abriendo' | 'viva' | 'fallo'>(cap.camaraEnVivo ? 'abriendo' : 'fallo')
  const [fallo, setFallo] = useState<FalloCamara>('no-se-pudo')
  const [fase, setFase] = useState<FaseReto>('listo')
  const [prep, setPrep] = useState<number | null>(null)
  const [transcurrido, setTranscurrido] = useState(0)
  const [manualReps, setManualReps] = useState(0)
  const [postura, setPostura] = useState<EstadoPostura>(estadoPosturaInicial)
  const [guardado, setGuardado] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const camRef = useRef<CamaraPostura | null>(null)
  const faseRef = useRef<FaseReto>(fase)
  faseRef.current = fase
  const posturaRef = useRef<EstadoPostura>(postura)
  posturaRef.current = postura
  const inicioRef = useRef<number>(0)
  const unaVez = useUnaVez()

  // Mantener la pantalla encendida durante el reto.
  useEffect(() => {
    if (fase !== 'curso' && fase !== 'cuenta') return
    void pantallaEncendida(true)
    return () => { void pantallaEncendida(false) }
  }, [fase])

  // Abrir cámara local con motor MediaPipe BlazePose cuando está en modo cámara.
  useEffect(() => {
    if (modo !== 'camara') return
    let cancelado = false
    let ultimoRender = 0
    setCamEstado('abriendo')
    void (async () => {
      try {
        if (!videoRef.current) return
        const cam = await abrirCamaraPostura(
          videoRef.current,
          lado,
          (pts3D, pts2D, ahoraMs) => {
            if (cancelado) return
            const ant = posturaRef.current
            const sig = faseRef.current === 'curso'
              ? evaluarPostura(ant, pts3D, def.ejercicio, ahoraMs)
              : { ...evaluarPostura({ ...estadoPosturaInicial(), ultimoMs: ahoraMs }, pts3D, def.ejercicio, ahoraMs), validas: 0, invalidas: 0, segundosValidos: 0 }
            if (faseRef.current === 'curso' && sig.validas > ant.validas) {
              if (ajustes.sonido) tic(true)
              if (ajustes.vibrar) void vibrar('corta')
            }
            posturaRef.current = sig
            // Pintar el esqueleto en el lienzo a la resolución nativa del vídeo para alineación exacta.
            const v = videoRef.current
            const c = canvasRef.current
            const ctx = c?.getContext('2d')
            if (v && c && ctx && v.videoWidth > 0 && v.videoHeight > 0) {
              if (c.width !== v.videoWidth || c.height !== v.videoHeight) {
                c.width = v.videoWidth
                c.height = v.videoHeight
              }
              dibujarPostura(ctx, c.width, c.height, pts2D, sig.posturaBien)
            }
            // Actualizar React solo cuando cambia algo visible o cada ~120 ms (evita saturar la interfaz).
            const cambioClave = sig.validas !== ant.validas
              || sig.invalidas !== ant.invalidas
              || sig.aviso !== ant.aviso
              || sig.posturaBien !== ant.posturaBien
              || sig.cuerpoVisible !== ant.cuerpoVisible
              || Math.floor(sig.segundosValidos) !== Math.floor(ant.segundosValidos)
            if (cambioClave || ahoraMs - ultimoRender >= 120) {
              ultimoRender = ahoraMs
              setPostura(sig)
            }
          },
          () => { if (!cancelado) { camRef.current = null; setCamEstado('fallo'); setFallo('no-se-pudo') } },
          () => cancelado,
        )
        camRef.current = cam
        setCamEstado('viva')
      } catch (e) {
        if (!cancelado) { setCamEstado('fallo'); setFallo(falloCamara(e)) }
      }
    })()
    return () => { cancelado = true; camRef.current?.parar(); camRef.current = null }
  }, [modo, lado, def.ejercicio, ajustes.sonido, ajustes.vibrar])

  // Cuenta atrás de colocación (3 s) antes de empezar.
  useEffect(() => {
    if (fase !== 'cuenta') return
    const sonar = ajustes.sonido
    const parar = cuentaAtras(SEGUNDOS_PREP, n => {
      setPrep(n)
      if (sonar) tic()
    }, () => {
      setPrep(null)
      if (sonar) tic(true)
      if (ajustes.vibrar) void vibrar('corta')
      inicioRef.current = Date.now()
      posturaRef.current = estadoPosturaInicial()
      setPostura(posturaRef.current)
      setManualReps(0)
      setTranscurrido(0)
      setFase('curso')
    })
    return () => { parar(); setPrep(null) }
  }, [fase, ajustes.sonido, ajustes.vibrar])

  const repsActuales = modo === 'camara' ? postura.validas : manualReps
  const duracionMeta = def.duracionS ?? 0

  // Reloj del reto en curso (cada 200 ms para respuesta ágil).
  useEffect(() => {
    if (fase !== 'curso') return
    const id = window.setInterval(() => {
      const seg = (Date.now() - inicioRef.current) / 1000
      setTranscurrido(seg)
      if (def.modo === 'mas-reps' && duracionMeta > 0 && seg >= duracionMeta) {
        if (ajustes.sonido) pitido()
        if (ajustes.vibrar) void vibrar('fin')
        setFase('fin')
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [fase, def.modo, duracionMeta, ajustes.sonido, ajustes.vibrar])

  // En contrarreloj («X reps en el menor tiempo»), termina automáticamente al completar las repeticiones válidas.
  useEffect(() => {
    if (fase !== 'curso' || def.modo !== 'menos-tiempo' || !def.objetivoReps) return
    if (repsActuales >= def.objetivoReps) {
      setTranscurrido(Math.max(1, (Date.now() - inicioRef.current) / 1000))
      if (ajustes.sonido) pitido()
      if (ajustes.vibrar) void vibrar('fin')
      setFase('fin')
    }
  }, [fase, def.modo, def.objetivoReps, repsActuales, ajustes.sonido, ajustes.vibrar])

  const completadoContrarreloj = def.modo !== 'menos-tiempo' || !def.objetivoReps || repsActuales >= def.objetivoReps
  const valorFinal = def.modo === 'mas-reps'
    ? repsActuales
    : def.modo === 'mas-tiempo'
      ? Math.round(modo === 'camara' && postura.segundosValidos > 0 ? postura.segundosValidos : transcurrido)
      : completadoContrarreloj ? Math.max(1, Math.round(transcurrido)) : 0

  const esRecord = fase === 'fin' && esNuevoRecordReto(intentos, def.id, valorFinal)
  const quedan = def.modo === 'mas-reps' ? Math.max(0, Math.ceil(duracionMeta - transcurrido)) : Math.round(transcurrido)

  const iniciar = () => {
    setGuardado(false)
    if (modo === 'camara' && camEstado === 'viva') {
      setFase('cuenta')
    } else {
      inicioRef.current = Date.now()
      setManualReps(0)
      setTranscurrido(0)
      setFase('curso')
    }
  }

  const terminarAhora = () => {
    setTranscurrido(Math.max(1, (Date.now() - inicioRef.current) / 1000))
    setFase('fin')
  }

  const repetir = () => {
    setGuardado(false)
    posturaRef.current = estadoPosturaInicial()
    setPostura(posturaRef.current)
    setManualReps(0)
    setTranscurrido(0)
    setFase('listo')
  }

  const guardar = unaVez(async () => {
    if (valorFinal <= 0) { aviso(t('Haz al menos una marca válida para guardar')); return }
    const res = await guardarIntentoReto({
      reto: def.id,
      valor: valorFinal,
      ...(modo === 'camara' && postura.invalidas > 0 ? { invalidas: postura.invalidas } : {}),
      duracionS: Math.max(1, Math.round(transcurrido)),
      modo,
    })
    setGuardado(true)
    aviso(res.record ? t('¡Nuevo récord guardado!') : t('Marca guardada'))
    nav.atras()
  })

  const valorEnVivo = def.modo === 'mas-reps'
    ? repsActuales
    : def.modo === 'mas-tiempo'
      ? Math.round(modo === 'camara' && postura.segundosValidos > 0 ? postura.segundosValidos : transcurrido)
      : repsActuales

  return (
    <Pantalla full>
      <div className={cx('cam live ret-cam', modo === 'manual' && 'ret-manual')}>
        <div className="cam-top">
          <button className="cam-b" aria-label={t('Cerrar')} onClick={() => nav.atras()}><Ico n="x" b /></button>
          <span className="cam-t">{t(def.corto)}</span>
          {modo === 'camara' && camEstado === 'viva' ? (
            <button className="cam-b" aria-label={t('Cambiar cámara')} onClick={() => setLado(l => (l === 'delantera' ? 'trasera' : 'delantera'))}>
              <Ico n="camera-rotate" b />
            </button>
          ) : <span style={{ width: 48 }} />}
        </div>

        {modo === 'camara' ? (
          <div className="ret-visor">
            <div className={cx('ret-marco', lado === 'delantera' && 'espejo')}>
              <video ref={videoRef} playsInline muted aria-hidden="true" />
              <canvas ref={canvasRef} className="ret-esqueleto" aria-hidden="true" />
              {camEstado === 'abriendo' && <span className="foto-espera"><Ico n="spinner" /></span>}
              {prep !== null && <span key={prep} className="foto-cuenta">{prep}</span>}
              {camEstado === 'viva' && (
                <div className={cx('ret-estado', postura.posturaBien ? 'ok' : 'warn')}>
                  <Ico n={postura.posturaBien ? 'check-circle' : 'warning'} b />
                  <span className="grow">{postura.aviso ? t(postura.aviso) : t('Colócate en el encuadre')}</span>
                  {postura.cuerpoVisible && <b className="mono ret-ang">{postura.anguloActual}°</b>}
                </div>
              )}
              {camEstado === 'viva' && fase === 'curso' && (
                <div className="ret-hud-wrap">
                  {def.modo !== 'mas-tiempo' && postura.cuerpoVisible && (
                    <div className={cx('ret-prof', postura.fase === 'abajo' && 'llena')} aria-hidden="true">
                      <span style={{ width: `${postura.profundidadPct}%` }} />
                    </div>
                  )}
                  <div className="ret-hud">
                    <div className="ret-hud-n">
                      <small>{def.modo === 'mas-tiempo' ? t('Tiempo válido') : t('Válidas')}</small>
                      <b className="mono">{def.modo === 'mas-tiempo' ? formatoTiempoReto(valorEnVivo) : valorEnVivo}</b>
                    </div>
                    <div className="ret-hud-t">
                      <small>{def.modo === 'mas-reps' ? t('Quedan') : t('Crono')}</small>
                      <b className="mono">{formatoTiempoReto(quedan)}</b>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="ret-manual-zona">
            <span className="tag blue">{t('Modo manual · sin cámara')}</span>
            <p className="ret-big-clock mono">{formatoTiempoReto(quedan)}</p>
            <p className="ret-big-sub">{def.modo === 'mas-reps' ? t('Segundos restantes') : t('Tiempo en curso')}</p>
            {def.modo !== 'mas-tiempo' && (
              <div className="ret-big-reps">
                <b className="mono">{manualReps}</b>
                <span>{def.objetivoReps ? t('de {n} reps', { n: def.objetivoReps }) : t('reps válidas')}</span>
              </div>
            )}
          </div>
        )}

        <div className="cam-panel ret-panel">
          {fase === 'listo' && (
            <>
              <div className="row jb">
                <span className="lbl">{t('Tu objetivo')}</span>
                {mejor && <span className="tag gold"><Ico n="trophy" b />{textoMarcaReto(mejor.valor, def.modo)}</span>}
              </div>
              <p className="ret-panel-t mt4">{textoRetoHoy(mejor, def)}</p>
              <p className="small muted mt4">{t(def.descripcion)}</p>

              {modo === 'camara' && camEstado === 'fallo' && (
                <p className="note warn mt8">
                  <Ico n="camera-slash" />
                  <span>{fallo === 'permiso' ? t('Sin permiso de cámara: puedes hacer el reto en modo manual.') : t('No se pudo abrir la cámara: usa el modo manual.')}</span>
                </p>
              )}

              <div className="chips eq mt12">
                <Chip on={modo === 'camara'} onClick={() => setModo('camara')}><Ico n="camera" />{t('Con cámara')}</Chip>
                <Chip on={modo === 'manual'} onClick={() => setModo('manual')}><Ico n="hand-tap" />{t('Manual')}</Chip>
              </div>

              <button
                className="btn xl mt12"
                disabled={modo === 'camara' && camEstado === 'abriendo'}
                onClick={iniciar}
              >
                <Ico n="play" b />{modo === 'camara' && camEstado === 'viva' ? t('Empezar (3 s)') : t('Empezar ahora')}
              </button>
            </>
          )}

          {fase === 'cuenta' && (
            <div className="center">
              <p className="lbl">{t('Prepárate')}</p>
              <p className="ret-panel-t mt4">{t('Colócate de cuerpo entero frente a la cámara')}</p>
              <button className="btn gry sm mt12" onClick={repetir}>{t('Cancelar')}</button>
            </div>
          )}

          {fase === 'curso' && (
            <>
              {mejor && def.modo === 'mas-reps' && (
                <div>
                  <div className="row jb">
                    <span className="small muted">{t('Frente a tu récord ({n})', { n: mejor.valor })}</span>
                    <span className="mono small">{repsActuales} / {mejor.valor}</span>
                  </div>
                  <div className="mt4"><Barra v={repsActuales} total={mejor.valor} tono={repsActuales > mejor.valor ? 'gold' : 'go'} /></div>
                </div>
              )}

              {modo === 'camara' && postura.invalidas > 0 && (
                <p className="small warnc mt4">
                  <Ico n="warning" b /> {tn(postura.invalidas, '{n} repetición no contada por técnica', '{n} repeticiones no contadas por técnica')}
                </p>
              )}

              {modo === 'manual' && def.modo !== 'mas-tiempo' && (
                <button className="btn xl mt8" onClick={() => {
                  setManualReps(r => r + 1)
                  if (ajustes.vibrar) void vibrar('corta')
                }}>
                  <Ico n="plus" b />{t('+1 repetición')}
                </button>
              )}

              <div className="btns mt8">
                {modo === 'manual' && def.modo !== 'mas-tiempo' && (
                  <button className="btn gry sm" disabled={manualReps === 0} onClick={() => setManualReps(r => Math.max(0, r - 1))}>−1</button>
                )}
                <button className={cx('btn sm', def.modo === 'mas-tiempo' ? '' : 'gry')} onClick={terminarAhora}>
                  <Ico n="stop" b />{t('Terminar')}
                </button>
              </div>
            </>
          )}

          {fase === 'fin' && (
            <>
              {esRecord && (
                <div className="ach mb8">
                  <span className="tro"><Ico n="trophy" b /></span>
                  <span className="tx">
                    <small className="au">{t('¡Nuevo récord personal!')}</small>
                    <b>{textoMarcaReto(valorFinal, def.modo)}</b>
                    <small>{textoComparativaRecord(valorFinal, mejor, def)}</small>
                  </span>
                </div>
              )}
              {!esRecord && (
                <div>
                  <span className="lbl">{t('Reto terminado')}</span>
                  <p className="tot-big mono mt4">{completadoContrarreloj ? textoMarcaReto(valorFinal, def.modo) : `${repsActuales} ${t('de {n} reps', { n: def.objetivoReps! })}`}</p>
                  <p className="small muted mt4">{completadoContrarreloj ? textoComparativaRecord(valorFinal, mejor, def) : t('Haz al menos una marca válida para guardar')}</p>
                </div>
              )}
              {modo === 'camara' && postura.invalidas > 0 && (
                <p className="note warn mt8">
                  <Ico n="warning" />
                  <span>{tn(postura.invalidas, '{n} repetición no se contó por técnica. Cuida la profundidad y la cadera.', '{n} repeticiones no se contaron por técnica. Cuida la profundidad y la cadera.')}</span>
                </p>
              )}
              <div className="grid2 mt12">
                <button className="btn gry" onClick={repetir}><Ico n="arrow-counter-clockwise" b />{t('Repetir')}</button>
                <button className="btn" disabled={guardado || valorFinal <= 0} onClick={() => void guardar()}><Ico n="check" b />{t('Guardar')}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </Pantalla>
  )
}
