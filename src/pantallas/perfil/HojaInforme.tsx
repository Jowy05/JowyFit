// AJU-02 · Informe en PDF (Ajustes): de qué días y qué lleva; se crea en el móvil (§1 del diseño del informe).
// Android lo guarda en Documentos/JowyFit y deja compartirlo; iPhone abre Compartir (si no puede, se descarga); el ordenador lo descarga.
import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import paquete from '../../../package.json'
import { datosInforme, periodoInforme } from '../../informe/calculo/leer'
import { guardarAjustes } from '../../datos/repos'
import type { PeriodoInforme, SeccionesInforme } from '../../informe/calculo/tipos'
import { ORDEN_PERIODOS, PERIODO_POR_DEFECTO, SECCIONES_POR_DEFECTO, etiquetaPeriodo } from '../../informe/calculo/periodo'
import { capacidades, compartirArchivo, compartirNativo, guardarArchivo } from '../../plataforma'
import { cx, Hoja, Ico, useUnaVez } from '../../ui/componentes'
import { useAviso } from '../../ui/aviso'
import { useAjustes } from '../../datos/hooks'
import { t, tk } from '../../i18n'

// Los textos se traducen al pintarlos (t(c.titulo)): esto se evalúa antes de cargar el idioma.
type Casilla = { k: keyof SeccionesInforme; titulo: string; d: string }
const CASILLAS: Casilla[] = [
  { k: 'entrenos', titulo: tk('Entrenos y subidas de peso'), d: tk('Cada entreno, récords, esfuerzo y gráficas de fuerza') },
  { k: 'comida', titulo: tk('Comida'), d: tk('Proteína, energía, picoteo y cafeína de cada día') },
  { k: 'cuerpo', titulo: tk('Cuerpo'), d: tk('Peso, % de grasa, cintura y cómo están') },
  { k: 'pasos', titulo: tk('Pasos y gasto'), d: tk('Pasos de cada día y lo que gastas') },
  { k: 'detalle', titulo: tk('Cada serie y cada comida, una a una'), d: tk('La lista completa (más páginas)') },
]

type Hecho = { nombre: string; bytes: Uint8Array; titulo: string }

/** Mensaje claro si algo falla al crear o guardar el PDF. */
function textoError(e: unknown): string {
  const m = String((e as Error)?.message ?? e ?? '')
  if (/quota|space|espacio|ENOSPC/i.test(m)) return t('No queda sitio en el móvil para guardarlo. Libera algo de espacio y vuelve a probar.')
  if (/permission|permiso|denied/i.test(m)) return t('El móvil no ha dejado guardar el archivo. Revisa los permisos de JowyFit y vuelve a probar.')
  if (/import|chunk|fetch|module/i.test(m)) return t('No se ha podido cargar lo necesario para hacer el PDF. Cierra la app, ábrela otra vez y vuelve a probar.')
  return t('No se ha podido crear el PDF. Vuelve a probar en un momento.')
}

export function HojaInforme() {
  const aviso = useAviso()
  const a = useAjustes()
  // APK: el PDF se guarda en Documentos/JowyFit y se comparte con el menú del sistema; Apple: con Compartir de Safari.
  const { compartirNativo: nativo, apple } = capacidades()
  // Uno para crear y otro para compartir: con uno solo, compartir justo después de crear se ignoraría.
  const unaVez = useUnaVez()
  const unaVezCompartir = useUnaVez()
  const guardado = a.informe
  const [periodo, setPeriodo] = useState<PeriodoInforme>(guardado?.periodo && ORDEN_PERIODOS.includes(guardado.periodo) ? guardado.periodo : PERIODO_POR_DEFECTO)
  const [sec, setSec] = useState<SeccionesInforme>({ ...SECCIONES_POR_DEFECTO, ...guardado?.secciones })
  // Los ajustes llegan un instante después de abrir la hoja: si aún no se ha tocado nada, se usa lo último elegido.
  const tocado = useRef(false)
  useEffect(() => {
    if (tocado.current || !guardado) return
    if (guardado.periodo && ORDEN_PERIODOS.includes(guardado.periodo)) setPeriodo(guardado.periodo)
    setSec({ ...SECCIONES_POR_DEFECTO, ...guardado.secciones })
  }, [guardado])

  const rango = useLiveQuery(() => periodoInforme(periodo), [periodo])
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<Hecho | null>(null)
  // iPhone: el PDF está hecho pero Safari no dejó abrir el menú Compartir (tardó demasiado tras el toque).
  const [pendiente, setPendiente] = useState(false)

  const recordar = (p: PeriodoInforme, s: SeccionesInforme) => { void guardarAjustes({ informe: { periodo: p, secciones: s } }) }
  const elegirPeriodo = (p: PeriodoInforme) => {
    tocado.current = true
    setPeriodo(p); setHecho(null); setError(null); setPendiente(false)
    recordar(p, sec)
  }
  const cambiarCasilla = (k: keyof SeccionesInforme) => {
    tocado.current = true
    const s = { ...sec, [k]: !sec[k] }
    setSec(s); setHecho(null); setError(null); setPendiente(false)
    recordar(periodo, s)
  }

  /** Guarda o comparte el PDF ya hecho. */
  const entregar = async (h: Hecho) => {
    if (nativo) {
      await guardarArchivo(h.nombre, h.bytes, 'application/pdf')
      aviso(t('PDF guardado en Documentos/JowyFit: {nombre}', { nombre: h.nombre }))
      return
    }
    if (apple) {
      const r = await compartirArchivo(h.nombre, h.bytes, 'application/pdf')
      setPendiente(r === 'sin-gesto')
      if (r === 'compartido') aviso(t('PDF listo. Guárdalo en Archivos o envíalo'))
      else if (r === 'cancelado') aviso(t('No se ha guardado el PDF'))
      else if (r === 'no-se-puede') {
        await guardarArchivo(h.nombre, h.bytes, 'application/pdf')
        aviso(t('PDF guardado en Archivos → Descargas: {nombre}', { nombre: h.nombre }))
      }
      return
    }
    await guardarArchivo(h.nombre, h.bytes, 'application/pdf')
    aviso(t('PDF descargado: {nombre}', { nombre: h.nombre }))
  }

  const crear = unaVez(async () => {
    if (creando || !rango?.hayDatos) return
    setCreando(true); setError(null); setHecho(null); setPendiente(false)
    try {
      const [inf, pdf] = await Promise.all([datosInforme(periodo, new Date(), sec), import('../../informe/pdf')])
      const bytes = await pdf.crearPdf(inf, { version: paquete.version })
      const h: Hecho = { nombre: pdf.nombrePdf(inf.rango), bytes, titulo: inf.cabecera.tituloPdf }
      setHecho(h)
      await entregar(h)
    } catch (e) {
      setError(textoError(e))
    } finally {
      setCreando(false)
    }
  })

  const compartir = unaVezCompartir(async () => {
    if (!hecho) return
    try {
      if (nativo) {
        const r = await compartirNativo(hecho.nombre, hecho.bytes, hecho.titulo)
        if (r === 'cancelado') aviso(t('No se ha enviado el PDF'))
      } else await entregar(hecho)
    } catch (e) {
      setError(textoError(e))
    }
  })

  const hayDatos = rango?.hayDatos ?? false
  const ninguna = !sec.entrenos && !sec.comida && !sec.cuerpo && !sec.pasos

  return (
    <Hoja titulo={t('Informe en PDF')} sub={t('Un resumen de tus entrenos, tu comida y tu cuerpo para guardar o enseñar.')} className="hoja-informe">
      <p className="lbl mt8">{t('¿De qué días?')}</p>
      <div className="chips inf-periodos mt8" role="radiogroup" aria-label={t('De qué días')}>
        {ORDEN_PERIODOS.map(p => (
          <button key={p} type="button" role="radio" aria-checked={periodo === p} className={cx('chip', periodo === p && 'on')} onClick={() => elegirPeriodo(p)}>{etiquetaPeriodo(p)}</button>
        ))}
      </div>
      <p className="small muted mt8" aria-live="polite">{rango?.textoHoja ?? ' '}</p>
      {rango?.notaHoja && <p className="small muted">{rango.notaHoja}</p>}

      <p className="lbl mt20">{t('¿Qué quieres que lleve?')}</p>
      <div className="list mt8 inf-casillas">
        {CASILLAS.map(c => (
          <button key={c.k} type="button" role="checkbox" aria-checked={sec[c.k]} className={cx('it', sec[c.k] && 'on')} onClick={() => cambiarCasilla(c.k)}>
            <span className={cx('casilla', sec[c.k] && 'on')} aria-hidden="true">{sec[c.k] && <Ico n="check" b />}</span>
            <span className="tx"><b>{t(c.titulo)}</b><small>{t(c.d)}</small></span>
          </button>
        ))}
      </div>
      {ninguna && <p className="small muted mt8">{t('Solo llevará la primera página, con el resumen.')}</p>}

      {rango && !hayDatos && <p className="note warn mt12"><Ico n="warning" /><span>{t('No hay nada apuntado de esos días. Prueba con otro periodo.')}</span></p>}
      {error && <p className="note bad mt12" role="alert"><Ico n="warning-circle" /><span>{error}</span></p>}

      {creando ? (
        <div className="inf-creando mt16" role="status">
          <span className="bar go carga"><i /></span>
          <span className="small">{t('Haciendo tu PDF…')}</span>
        </div>
      ) : null}
      <button className={cx('btn mt16', pendiente && 'gry')} disabled={!hayDatos || creando} onClick={() => void crear()}>
        <Ico n="file-pdf" b />{creando ? t('Creando…') : t('Crear el PDF')}
      </button>

      {hecho && !creando && (
        <div className="inf-hecho mt12">
          <p className="note ok"><Ico n="check-circle" /><span><b>{pendiente ? t('Tu PDF está listo.') : nativo ? t('Guardado en Documentos/JowyFit.') : apple ? t('Tu PDF está hecho.') : t('Descargado.')}</b> <span className="small">{hecho.nombre}</span></span></p>
          <button className={cx('btn mt8', !pendiente && 'ln')} onClick={() => void compartir()}>
            <Ico n={nativo || apple || pendiente ? 'share-network' : 'download-simple'} />{pendiente ? t('Guardar o enviar el PDF') : nativo || apple ? t('Compartir') : t('Descargar otra vez')}
          </button>
        </div>
      )}
      <p className="small muted mt12 center">{t('El PDF se hace en tu móvil. No se envía a ningún sitio.')}</p>
    </Hoja>
  )
}
