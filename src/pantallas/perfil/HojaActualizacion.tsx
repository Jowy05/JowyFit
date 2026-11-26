// AJU-03 · Buscar y descargar actualizaciones desde la propia app (Android nativo + web/PWA).
import { useEffect, useRef, useState } from 'react'
import { version } from '../../../package.json'
import { tamanoMB, type InfoActualizacion } from '../../dominio/actualizacion'
import {
  aplicarActualizacionWeb,
  buscarActualizacion,
  capacidades,
  instalarActualizacionApk,
  type ProgresoDescarga,
} from '../../plataforma'
import { Hoja, Ico, useUnaVez } from '../../ui/componentes'
import { t } from '../../i18n'

type Fase = 'buscando' | 'al-dia' | 'nueva' | 'error' | 'sin-red'

export function HojaActualizacion() {
  const { actualizarApk, apple } = capacidades()
  const unaVez = useUnaVez()
  const [fase, setFase] = useState<Fase>('buscando')
  const [info, setInfo] = useState<InfoActualizacion | null>(null)
  const [webLista, setWebLista] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [progreso, setProgreso] = useState<ProgresoDescarga | null>(null)
  const [estadoApk, setEstadoApk] = useState<'ninguno' | 'permiso' | 'instalando' | 'navegador'>('ninguno')
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)
  const montado = useRef(true)

  const comprobar = async () => {
    setFase('buscando')
    setErrorDescarga(null)
    setEstadoApk('ninguno')
    setProgreso(null)
    const r = await buscarActualizacion(version)
    if (!montado.current) return
    if (!r.ok) {
      setFase(r.motivo)
      return
    }
    setInfo(r.info)
    setWebLista(r.webLista)
    setFase(r.info.hayNueva ? 'nueva' : 'al-dia')
  }

  useEffect(() => {
    montado.current = true
    void comprobar()
    return () => { montado.current = false }
  }, [])

  const descargar = unaVez(async () => {
    if (!info?.urlApk || descargando) return
    setDescargando(true)
    setErrorDescarga(null)
    setEstadoApk('ninguno')
    setProgreso({ porcentaje: 0, descargado: 0, total: info.bytes ?? 0 })
    try {
      const estado = await instalarActualizacionApk(info, p => {
        if (montado.current) setProgreso(p)
      })
      if (!montado.current) return
      setEstadoApk(estado)
    } catch (e) {
      if (!montado.current) return
      const msg = String((e as Error)?.message ?? '')
      if (/SHA-256|huella/i.test(msg)) {
        setErrorDescarga(t('El archivo descargado no coincide con la versión oficial. No se ha instalado.'))
      } else {
        setErrorDescarga(t('No se ha podido descargar la actualización. Comprueba tu conexión y vuelve a probar.'))
      }
    } finally {
      if (montado.current) setDescargando(false)
    }
  })

  const recargarWeb = unaVez(async () => {
    await aplicarActualizacionWeb()
  })

  const pct = progreso && progreso.porcentaje >= 0 ? progreso.porcentaje : null

  return (
    <Hoja
      titulo={t('Actualizaciones')}
      sub={t('Versión actual: {version}', { version })}
      className="hoja-actualizacion"
    >
      {fase === 'buscando' && (
        <div className="inf-creando mt16" role="status">
          <span className="bar go carga"><i /></span>
          <span className="small">{t('Buscando actualizaciones…')}</span>
        </div>
      )}

      {fase === 'sin-red' && (
        <>
          <p className="note warn mt12" role="alert">
            <Ico n="wifi-slash" />
            <span>{t('Sin conexión a internet. Conéctate para comprobar si hay una versión nueva.')}</span>
          </p>
          <button type="button" className="btn mt16" onClick={() => void comprobar()}>
            <Ico n="arrows-clockwise" />{t('Volver a comprobar')}
          </button>
        </>
      )}

      {fase === 'error' && (
        <>
          <p className="note bad mt12" role="alert">
            <Ico n="warning-circle" />
            <span>{t('No se ha podido comprobar ahora mismo. Vuelve a intentarlo en un momento.')}</span>
          </p>
          <button type="button" className="btn mt16" onClick={() => void comprobar()}>
            <Ico n="arrows-clockwise" />{t('Volver a comprobar')}
          </button>
        </>
      )}

      {fase === 'al-dia' && (
        <>
          <p className="note ok mt12" role="status">
            <Ico n="check-circle" />
            <span><b>{t('Tienes la última versión.')}</b> {t('JowyFit {version} está al día.', { version })}</span>
          </p>
          {!actualizarApk && webLista && (
            <button type="button" className="btn mt16" onClick={() => void recargarWeb()}>
              <Ico n="arrows-clockwise" b />{t('Recargar para aplicar cambios')}
            </button>
          )}
          <button type="button" className="btn ln mt12" onClick={() => void comprobar()}>
            <Ico n="arrows-clockwise" />{t('Volver a comprobar')}
          </button>
        </>
      )}

      {fase === 'nueva' && info && (
        <>
          <div className="spec-box mt12">
            <div className="spec">
              <p><span>{t('Nueva versión')}</span><b>{info.ultima}</b></p>
              {info.fecha && <p><span>{t('Publicada')}</span><b>{info.fecha}</b></p>}
              {info.bytes && <p><span>{t('Tamaño del APK')}</span><b>{tamanoMB(info.bytes)}</b></p>}
            </div>
          </div>

          {info.notas && (
            <div className="mt12">
              <p className="lbl">{t('Novedades')}</p>
              <p className="small muted mt8" style={{ whiteSpace: 'pre-line' }}>{info.notas}</p>
            </div>
          )}

          {descargando && (
            <div className="inf-creando mt16" role="status" aria-live="polite">
              <span className={pct === null ? 'bar go carga' : 'bar go'}>
                <i style={pct !== null ? { width: `${pct}%` } : undefined} />
              </span>
              <span className="small">
                {pct !== null
                  ? t('Descargando actualización… {n} %', { n: pct })
                  : t('Descargando actualización…')}
              </span>
            </div>
          )}

          {estadoApk === 'permiso' && (
            <p className="note warn mt12" role="status">
              <Ico n="shield-check" />
              <span>{t('Activa «Permitir desde esta fuente» en los ajustes que acabamos de abrir y vuelve a tocar Descargar e instalar.')}</span>
            </p>
          )}

          {estadoApk === 'instalando' && (
            <p className="note ok mt12" role="status">
              <Ico n="check-circle" />
              <span>{t('Descarga verificada. Sigue los pasos del instalador de Android para actualizar sin perder tus datos.')}</span>
            </p>
          )}

          {estadoApk === 'navegador' && (
            <p className="note ok mt12" role="status">
              <Ico n="download-simple" />
              <span>{t('Descarga abierta en el navegador. Al acabar, abre el archivo para actualizar.')}</span>
            </p>
          )}

          {errorDescarga && (
            <p className="note bad mt12" role="alert">
              <Ico n="warning-circle" />
              <span>{errorDescarga}</span>
            </p>
          )}

          {actualizarApk && info.urlApk && (
            <button type="button" className="btn mt16" disabled={descargando} onClick={() => void descargar()}>
              <Ico n="download-simple" b />{descargando ? t('Descargando…') : t('Descargar e instalar')}
            </button>
          )}

          {!actualizarApk && apple && (
            <>
              <p className="note mt12">
                <Ico n="info" />
                <span>{t('La versión web se actualiza sola con conexión. Toca abajo para recargarla ahora.')}</span>
              </p>
              <button type="button" className="btn mt16" onClick={() => void recargarWeb()}>
                <Ico n="arrows-clockwise" b />{t('Actualizar ahora')}
              </button>
            </>
          )}

          {!actualizarApk && !apple && (
            <>
              {info.urlApk && (
                <button type="button" className="btn mt16" onClick={() => void descargar()}>
                  <Ico n="download-simple" b />{t('Descargar APK (v{version})', { version: info.ultima })}
                </button>
              )}
              {webLista && (
                <button type="button" className="btn ln mt8" onClick={() => void recargarWeb()}>
                  <Ico n="arrows-clockwise" />{t('Actualizar versión web')}
                </button>
              )}
            </>
          )}

          <a className="btn ln mt8" href={info.urlRelease} target="_blank" rel="noopener noreferrer">
            <Ico n="arrow-square-out" />{t('Ver notas en GitHub')}
          </a>
        </>
      )}

      <p className="small muted mt12 center">
        {t('Solo se consulta GitHub cuando tocas aquí. Tus datos se conservan al actualizar.')}
      </p>
    </Hoja>
  )
}
