// PRO-06 · Cámara de las fotos de progreso: la imagen en vivo con la silueta guía de la pose, la cámara de atrás o
// la de delante, y un temporizador de 5 s para dejar el móvil apoyado. Así todas las fotos salen iguales.
// Si la cámara no se abre, se hace con la cámara del móvil de siempre (sin silueta).
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { fotosPorFecha } from '../../datos/consultas'
import { guardarFoto } from '../../datos/acciones/cuerpo'
import { guardarAjustes } from '../../datos/repos'
import { useAjustes } from '../../datos/hooks'
import { horaActual, hoyISO } from '../../dominio/fechas'
import { ORDEN_POSES, SEGUNDOS_ESPERA, cuentaAtras, siguientePose, type Pose } from '../../dominio/fotos'
import { abrirCamaraFoto, alVolverAPrimerPlano, capacidades, elegirFoto, falloCamara, hacerFoto, tic, type CamaraFoto as Camara, type FalloCamara, type LadoCamara } from '../../plataforma'
import { Chip, cx, Ico, Pantalla, useUnaVez } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { nombrePose } from './comun'
import { Silueta } from './Silueta'
import { t } from '../../i18n'

type Estado =
  | { e: 'abriendo' }
  | { e: 'vivo' }
  | { e: 'contando' }
  | { e: 'revisar'; foto: Blob; url: string }
  | { e: 'sincamara'; fallo: FalloCamara }

export function CamaraFoto({ ruta }: { ruta: Ruta<'camara-foto'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const ajustes = useAjustes()
  const fotos = useLiveQuery(fotosPorFecha, [])
  const [pose, setPose] = useState<Pose>(ruta.d.pose)
  const [lado, setLado] = useState<LadoCamara>(ruta.d.camara)
  const [esperar, setEsperar] = useState(ruta.d.esperar)
  const [estado, setEstado] = useState<Estado>({ e: 'abriendo' })
  const [quedan, setQuedan] = useState<number | null>(null)
  const [ronda, setRonda] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const camara = useRef<Camara | null>(null)
  // Hay una apertura en marcha (con el cuadro del permiso, por ejemplo): volver a la app no debe lanzar otra.
  const abriendo = useRef(false)
  const unaVez = useUnaVez()

  // Abre la cámara elegida (otra vez al cambiarla, al «Probar otra vez» o al volver a la app) y la apaga al salir.
  // La foto que se está revisando no se pierde por eso: se queda hasta guardarla o repetirla.
  useEffect(() => {
    let cancelado = false
    const poner = (e: Estado) => setEstado(s => (s.e === 'revisar' ? s : e))
    poner({ e: 'abriendo' })
    abriendo.current = true
    void (async () => {
      try {
        if (!video.current) return
        const cam = await abrirCamaraFoto(video.current, lado, () => {
          if (cancelado) return
          camara.current = null
          poner({ e: 'sincamara', fallo: 'no-se-pudo' })
        }, () => cancelado)
        camara.current = cam
        poner({ e: 'vivo' })
      } catch (e) {
        if (!cancelado) poner({ e: 'sincamara', fallo: falloCamara(e) })
      } finally {
        // Si se canceló, la apertura que la sustituye ya lo ha puesto a true y es ella quien lo baja.
        if (!cancelado) abriendo.current = false
      }
    })()
    return () => { cancelado = true; abriendo.current = false; camara.current?.parar(); camara.current = null }
  }, [lado, ronda])
  // Al salir de la app el sistema puede apagar la cámara: al volver se abre de nuevo, pero solo si se apagó. En
  // Android, el cuadro del permiso también cuenta como salir y volver, y la cámara aún se está abriendo.
  useEffect(() => {
    let vivo = true
    let quitar = () => {}
    const reabrir = () => {
      if (abriendo.current) return
      // Si sigue viva, solo se reanuda el vídeo (Safari lo pausa al salir de la app).
      if (camara.current?.viva()) void video.current?.play().catch(() => {})
      else setRonda(r => r + 1)
    }
    void alVolverAPrimerPlano(reabrir).then(f => { if (vivo) quitar = f; else f() })
    return () => { vivo = false; quitar() }
  }, [])

  const disparar = async () => {
    try {
      if (!camara.current) throw new Error('Sin cámara')
      const foto = await camara.current.capturar()
      if (ajustes.sonido) tic(true)
      setEstado({ e: 'revisar', foto, url: URL.createObjectURL(foto) })
    } catch {
      setEstado(camara.current ? { e: 'vivo' } : { e: 'sincamara', fallo: 'no-se-pudo' })
      aviso(t('No se ha podido hacer la foto. Prueba otra vez.'))
    }
  }

  // La cuenta atrás: un pitido por segundo (se oye con el móvil lejos) y la foto al llegar a 0.
  const contando = estado.e === 'contando'
  useEffect(() => {
    if (!contando) return
    const sonar = ajustes.sonido
    const parar = cuentaAtras(SEGUNDOS_ESPERA, n => { setQuedan(n); if (sonar) tic() }, () => { setQuedan(null); void disparar() })
    return () => { parar(); setQuedan(null) }
  }, [contando])

  // La foto que se está revisando se suelta de la memoria al guardarla o repetirla.
  const url = estado.e === 'revisar' ? estado.url : null
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  const recordar = (c: LadoCamara, s: boolean) => { void guardarAjustes({ fotos: { camara: c, esperar: s } }) }
  const cambiarLado = (c: LadoCamara) => { if (c === lado) return; setLado(c); recordar(c, esperar) }
  const cambiarEspera = () => { setEsperar(!esperar); recordar(lado, !esperar) }
  const hacer = () => { if (esperar) setEstado({ e: 'contando' }); else void disparar() }
  // De vuelta a la cámara (tras guardar o para repetir); si se apagó mientras se miraba la foto, se abre otra vez.
  const repetir = () => { setEstado({ e: camara.current ? 'vivo' : 'abriendo' }); if (!camara.current) setRonda(r => r + 1) }

  /** Guarda la foto y pasa a la siguiente pose que falte hoy; null si ya están las tres. */
  const apuntar = async (foto: Blob): Promise<Pose | null> => {
    const hoy = hoyISO()
    await guardarFoto({ fecha: `${hoy}T${horaActual()}`, pose, imagen: foto })
    aviso(t('Foto guardada · {pose}', { pose: nombrePose(pose).toLowerCase() }))
    const sig = siguientePose([...(fotos ?? []).filter(f => f.fecha.startsWith(hoy)).map(f => f.pose), pose])
    if (sig) setPose(sig)
    return sig
  }
  const guardar = unaVez(async (foto: Blob) => {
    if (await apuntar(foto)) repetir()
    else nav.atras()
  })
  // Sin cámara en vivo: la del móvil, con la misma cámara elegida, o una foto de la galería.
  const sinVivo = (de: () => Promise<Blob | null>) => unaVez(async () => {
    const f = await de()
    if (f && !(await apuntar(f))) nav.atras()
  })
  const delSistema = sinVivo(() => hacerFoto(1280, lado))
  const deGaleria = sinVivo(() => elegirFoto(1280))

  const nombre = nombrePose(pose).toLowerCase()
  const enVivo = estado.e === 'abriendo' || estado.e === 'vivo' || contando

  return (
    <Pantalla full>
      <div className="cam live foto-cam">
        <div className="cam-top">
          <button className="cam-b" aria-label={t('Cerrar')} onClick={() => nav.atras()}><Ico n="x" b /></button>
          <span className="cam-t">{t('Foto de {pose}', { pose: nombre })}</span>
          <span style={{ width: 48 }} />
        </div>

        {/* Siempre montado: los lectores de pantalla solo leen los cambios de una región que ya estaba. */}
        <span className="foto-lector" role="timer" aria-live="assertive" aria-atomic="true">{quedan ?? ''}</span>

        <div className="foto-visor">
          <div className="foto-marco">
            {/* La delantera se ve como un espejo; la silueta va con ella para que la foto guardada salga como con la de atrás. */}
            <div className={cx('foto-vivo', lado === 'delantera' && 'espejo')}>
              <video ref={video} playsInline muted aria-hidden="true" />
              {enVivo && <Silueta pose={pose} />}
            </div>
            {estado.e === 'abriendo' && <span className="foto-espera"><Ico n="spinner" /></span>}
            {quedan !== null && <span key={quedan} className="foto-cuenta" aria-hidden="true">{quedan}</span>}
            {estado.e === 'revisar' && <img src={estado.url} alt={t('Foto de {pose}', { pose: nombre })} />}
          </div>
        </div>

        {enVivo && (
          <div className="foto-mandos">
            <p className="cam-hint">{contando ? t('Ponte en tu sitio: la foto sale sola') : t('Ponte dentro de la silueta, de la cabeza a los pies')}</p>
            {!contando && (
              <>
                <div className="chips eq">{ORDEN_POSES.map(p => <Chip key={p} on={pose === p} onClick={() => setPose(p)}>{nombrePose(p)}</Chip>)}</div>
                <div className="chips eq">
                  <Chip on={lado === 'trasera'} onClick={() => cambiarLado('trasera')}><Ico n="camera" />{t('Cámara de atrás')}</Chip>
                  <Chip on={lado === 'delantera'} onClick={() => cambiarLado('delantera')}><Ico n="user-focus" />{t('Cámara de delante')}</Chip>
                </div>
                <div className="chips eq">
                  <Chip on={esperar} ck onClick={cambiarEspera}><Ico n="timer" />{t('Esperar {n} segundos', { n: SEGUNDOS_ESPERA })}</Chip>
                </div>
              </>
            )}
            {contando
              ? <button className="btn xl gry" onClick={() => setEstado({ e: 'vivo' })}><Ico n="stop" b />{t('Parar')}</button>
              : <button className="btn xl" disabled={estado.e !== 'vivo'} onClick={hacer}><Ico n={esperar ? 'timer' : 'camera'} b />{esperar ? t('Hacer foto en {n} s', { n: SEGUNDOS_ESPERA }) : t('Hacer foto')}</button>}
          </div>
        )}

        {estado.e === 'revisar' && (
          <div className="cam-panel">
            <p className="lbl fl">{t('¿Se ve bien? Si no, repítela.')}</p>
            <div className="grid2">
              <button className="btn gry" onClick={repetir}><Ico n="arrow-counter-clockwise" b />{t('Repetir')}</button>
              <button className="btn" onClick={() => void guardar(estado.foto)}><Ico n="check" b />{t('Guardar')}</button>
            </div>
          </div>
        )}

        {estado.e === 'sincamara' && (
          <div className="cam-panel">
            {/* En el APK sin permiso, la cámara del móvil tampoco se abre: se explica dónde darlo y queda la galería. */}
            {estado.fallo === 'permiso' && capacidades().permisoCamaraDeLaApp ? (
              <>
                <p className="row">
                  <span className="ico badb"><Ico n="camera-slash" /></span>
                  <span className="tx"><b>{t('No hay permiso para usar la cámara.')}</b><small>{t('Dalo en los ajustes del móvil: Aplicaciones → JowyFit → Permisos → Cámara. Mientras, puedes elegir una foto de la galería.')}</small></span>
                </p>
                <button className="btn mt12" onClick={() => void deGaleria()}><Ico n="image" b />{t('Elegir de la galería')}</button>
              </>
            ) : (
              <>
                <p className="row">
                  <span className="ico badb"><Ico n="camera-slash" /></span>
                  <span className="tx"><b>{estado.fallo === 'permiso' ? t('No hay permiso para usar la cámara.') : t('No se ha podido abrir la cámara.')}</b><small>{t('No pasa nada: hazla con la cámara del móvil, sin la silueta.')}</small></span>
                </p>
                <button className="btn mt12" onClick={() => void delSistema()}><Ico n="camera" b />{t('Abrir la cámara del móvil')}</button>
              </>
            )}
            <button className="btn gry mt8" onClick={() => setRonda(r => r + 1)}><Ico n="arrow-clockwise" b />{t('Probar otra vez')}</button>
          </div>
        )}
      </div>
    </Pantalla>
  )
}
