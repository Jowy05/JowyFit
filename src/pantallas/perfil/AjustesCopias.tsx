// AJU-01 · Copia de seguridad en Ajustes: hacerla, recuperarla, cuántas automáticas guardar y, aparte, la contraseña
// (ProtegerCopias) y las guardadas en Documentos/JowyFit (CopiasGuardadas, solo Android).
import { useCallback, useEffect, useState } from 'react'
import { guardarAjustes } from '../../datos/repos'
import { importar } from '../../datos/copias'
import { OPCIONES_COPIAS_AUTO } from '../../dominio/copias'
import { mensajeDe } from '../../dominio/formato'
import { capacidades, copiasGuardadas, elegirArchivo, type ArchivoElegido, type CopiaGuardada } from '../../plataforma'
import { Chip, FilaInterruptor, Ico } from '../../ui/componentes'
import { useCopiaCifrada } from '../../ui/HojaCopiaCifrada'
import { useAviso } from '../../ui/aviso'
import { useAjustes } from '../../datos/hooks'
import { compartirCopiaAhora, copiaCompartiendo, guardarCopiaEnCarpetaElegida, hacerCopiaConRespaldo, type CopiaPreparada } from '../../app/copias'
import { exportarLigero, type TipoExportLigero } from '../../app/exportar'
import { CopiasGuardadas, cuando } from './CopiasGuardadas'
import { ProtegerCopias } from './ProtegerCopias'
import { t } from '../../i18n'
import { tr } from '../../i18n/jsx'

const textoGuardar = (n: number) => (n ? t('Las {n} últimas', { n }) : t('Todas'))

/** Copia de seguridad: hacer copia, recuperar, automáticas, contraseña y copias guardadas. */
export function CopiaDeSeguridad() {
  const aviso = useAviso()
  const a = useAjustes()
  const cap = capacidades()
  const [copias, setCopias] = useState<CopiaGuardada[]>([])
  const [archivo, setArchivo] = useState<ArchivoElegido | null>(null)
  const [ocupado, setOcupado] = useState(false)
  // Apple: la copia está hecha pero Safari no dejó abrir el menú Compartir (tardó demasiado tras el toque).
  const [copiaLista, setCopiaLista] = useState<CopiaPreparada | null>(null)

  const refrescarCopias = useCallback(() => { void copiasGuardadas().then(setCopias) }, [])
  useEffect(() => { refrescarCopias() }, [refrescarCopias])
  /** La contraseña cambió o se borraron copias: la copia ya preparada (Apple) y la lista ya no valen. */
  const cambioCopias = useCallback(() => { setCopiaLista(null); refrescarCopias() }, [refrescarCopias])
  const recuperada = (tipo: 'copia' | 'perfil') => {
    aviso(tipo === 'copia' ? t('Copia recuperada') : t('Datos del perfil recuperados'))
    window.setTimeout(() => location.reload(), 700)
  }
  const cifrada = useCopiaCifrada(() => {
    aviso(t('Copia recuperada. Tus copias nuevas llevarán su contraseña'))
    window.setTimeout(() => location.reload(), 700)
  })

  const copiaAhora = async () => {
    setOcupado(true)
    try {
      if (cap.apple) {
        // Menú Compartir: «Guardar en Archivos», AirDrop, WhatsApp… Si no se puede, se descarga.
        const r = await copiaCompartiendo(copiaLista ?? undefined)
        setCopiaLista(r.resultado === 'sin-gesto' ? r.copia : null)
        if (r.resultado === 'compartido') aviso(t('Copia hecha. Guárdala en Archivos o envíatela'))
        else if (r.resultado === 'descargado') aviso(t('Copia guardada en Archivos → Descargas: {nombre}', { nombre: r.copia.nombre }))
        else if (r.resultado === 'cancelado') aviso(t('No se ha guardado la copia'))
        return
      }
      const r = await hacerCopiaConRespaldo()
      if (r.resultado === 'documentos') aviso(t('Copia guardada en Documentos/JowyFit: {nombre}', { nombre: r.nombre }))
      else if (r.resultado === 'descargas') aviso(t('Copia guardada en Descargas/JowyFit: {nombre}', { nombre: r.nombre }))
      else if (r.resultado === 'compartido') aviso(t('Copia lista para compartir: {nombre}', { nombre: r.nombre }))
      else if (r.resultado === 'cancelado') aviso(t('No se ha guardado la copia'))
      else aviso(t('Copia descargada: {nombre}', { nombre: r.nombre }))
      refrescarCopias()
    } catch (e) {
      aviso(t('No se pudo hacer la copia: {error}', { error: mensajeDe(e) }))
    } finally { setOcupado(false) }
  }
  const elegirCarpeta = async () => {
    setOcupado(true)
    try {
      const r = await guardarCopiaEnCarpetaElegida()
      if (r.resultado === 'guardado') aviso(t('Copia guardada: {nombre}', { nombre: r.nombre }))
      else if (r.resultado === 'compartido') aviso(t('Copia lista para compartir: {nombre}', { nombre: r.nombre }))
      else aviso(t('No se ha guardado la copia'))
      refrescarCopias()
    } catch (e) {
      aviso(t('No se pudo hacer la copia: {error}', { error: mensajeDe(e) }))
    } finally { setOcupado(false) }
  }
  const compartirCopia = async () => {
    setOcupado(true)
    try {
      const r = await compartirCopiaAhora()
      if (r.resultado === 'compartido') aviso(t('Copia lista para compartir: {nombre}', { nombre: r.nombre }))
      else aviso(t('No se ha guardado la copia'))
    } catch (e) {
      aviso(t('No se pudo compartir la copia: {error}', { error: mensajeDe(e) }))
    } finally { setOcupado(false) }
  }
  const restaurar = async (bytes: Uint8Array) => {
    setOcupado(true)
    try { recuperada(await importar(bytes)) }
    catch (e) {
      aviso(t('No se pudo recuperar: {error}', { error: mensajeDe(e) }))
      setOcupado(false)
    }
  }
  const elegir = async () => {
    const f = await elegirArchivo()
    // Con contraseña, su hoja la pide y pregunta antes de cambiar nada; sin ella, el «¿Recuperar…?» de aquí.
    if (f && !cifrada.abrir(f)) setArchivo(f)
  }
  /** Una guardada ya pasó por su «¿Seguro?»: no se vuelve a preguntar. */
  const recuperarGuardada = (f: ArchivoElegido) => { if (!cifrada.abrir(f, false)) void restaurar(f.bytes) }

  const exportar = async (tipo: TipoExportLigero) => {
    setOcupado(true)
    try {
      const r = await exportarLigero(tipo)
      if (r.resultado === 'compartido') aviso(t('Archivo listo: {nombre}', { nombre: r.nombre }))
      else if (r.resultado === 'cancelado') aviso(t('No se ha guardado el archivo'))
      else if (r.resultado === 'descargas') aviso(t('Guardado en Descargas/JowyFit: {nombre}', { nombre: r.nombre }))
      else aviso(cap.copiasEnDocumentos ? t('Guardado en Documentos/JowyFit: {nombre}', { nombre: r.nombre }) : t('Descargado: {nombre}', { nombre: r.nombre }))
    } catch (e) {
      aviso(t('No se pudo exportar: {error}', { error: mensajeDe(e) }))
    } finally { setOcupado(false) }
  }

  return (
    <>
      <p className="grp-t" id="aju-datos">{t('Copia de seguridad')}</p>
      <p className="note ok"><Ico n="device-mobile-camera" /><span>{tr('<b>Todo se guarda en este móvil.</b> Una copia de vez en cuando te sirve si cambias de móvil o se borra algo.', { b: x => <b>{x}</b> })}</span></p>
      <div className="list mt8">
        <button className="it" disabled={ocupado} onClick={() => void copiaAhora()}>
          <span className="ico"><Ico n="floppy-disk" /></span>
          <span className="tx"><b>{copiaLista ? t('Guardar la copia') : t('Hacer copia ahora')}</b><small>{copiaLista
            ? t('Está lista: toca para elegir dónde guardarla')
            : <>{cap.apple ? t('Guárdala en Archivos o envíatela') : t('Guarda una copia de todo')} · {a.ultimaCopia ? t('la última, {cuando}', { cuando: cuando(new Date(a.ultimaCopia)) }) : t('aún no has hecho ninguna')}</>}</small></span>
        </button>
        {cap.compartirNativo && (
          <>
            <button className="it" disabled={ocupado} onClick={() => void elegirCarpeta()}>
              <span className="ico"><Ico n="folder-open" /></span>
              <span className="tx"><b>{t('Elegir dónde guardar la copia')}</b><small>{t('Descargas, Drive o la carpeta que prefieras')}</small></span>
            </button>
            <button className="it" disabled={ocupado} onClick={() => void compartirCopia()}>
              <span className="ico"><Ico n="share-network" /></span>
              <span className="tx"><b>{t('Enviar o compartir copia')}</b><small>{t('WhatsApp, Telegram, Drive u otra app')}</small></span>
            </button>
          </>
        )}
        <button className="it" disabled={ocupado} onClick={() => void elegir()}>
          <span className="ico"><Ico n="clock-counter-clockwise" /></span>
          <span className="tx"><b>{t('Recuperar una copia')}</b><small>{cap.apple ? t('Elige en Archivos el .jowyfit que guardaste antes') : t('Elige un archivo .jowyfit que guardaste antes')}</small></span>
        </button>
        {archivo && (
          <div className="it col">
            <p className="note warn"><Ico n="warning" /><span>{tr('¿Recuperar {nombre}? Lo que hay ahora en el móvil se cambia por lo que tiene la copia.', { nombre: <b>{archivo.nombre}</b> })}</span></p>
            <div className="btns">
              <button className="btn gry sm" onClick={() => setArchivo(null)}>{t('Cancelar')}</button>
              <button className="btn sm" disabled={ocupado} onClick={() => void restaurar(archivo.bytes)}>{t('Recuperar')}</button>
            </div>
          </div>
        )}
        {cap.copiasEnDocumentos && (
          <FilaInterruptor ico="calendar-check" titulo={t('Copia sola cada semana')} d={t('Se guarda en Documentos/JowyFit')}
            on={a.copiaAuto} onCambio={v => { void guardarAjustes({ copiaAuto: v }) }} etiqueta={t('Copia automática semanal')} />
        )}
        {cap.copiasEnDocumentos && a.copiaAuto && (
          <div className="it col">
            <span className="tx"><b>{t('Guardar las automáticas')}</b><small>{t('Las más viejas se borran solas. Las que haces tú, nunca.')}</small></span>
            <div className="chips eq w100" role="group" aria-label={t('Guardar las automáticas')}>
              {OPCIONES_COPIAS_AUTO.map(n => <Chip key={n} on={a.copiasAuto === n} onClick={() => { void guardarAjustes({ copiasAuto: n }) }}>{textoGuardar(n)}</Chip>)}
            </div>
          </div>
        )}
      </div>
      <p className="grp-t">{t('Exportar para hoja de cálculo')}</p>
      <div className="list">
        <button className="it" disabled={ocupado} onClick={() => void exportar('entrenos')}>
          <span className="ico"><Ico n="file-csv" /></span>
          <span className="tx"><b>{t('Entrenos (.csv)')}</b><small>{t('Todas tus series, pesos, repeticiones y récords para Excel o Sheets')}</small></span>
        </button>
        <button className="it" disabled={ocupado} onClick={() => void exportar('comidas')}>
          <span className="ico"><Ico n="file-csv" /></span>
          <span className="tx"><b>{t('Comidas (.csv)')}</b><small>{t('Diario de comidas con proteína, calorías, cafeína y macros')}</small></span>
        </button>
        <button className="it" disabled={ocupado} onClick={() => void exportar('medidas')}>
          <span className="ico"><Ico n="file-csv" /></span>
          <span className="tx"><b>{t('Medidas y peso (.csv)')}</b><small>{t('Peso, perímetros y datos de la báscula ordenados por fecha')}</small></span>
        </button>
        <button className="it" disabled={ocupado} onClick={() => void exportar('json')}>
          <span className="ico"><Ico n="file-code" /></span>
          <span className="tx"><b>{t('Todo en JSON ligero (.json)')}</b><small>{t('Tus datos legibles sin fotos ni archivos pesados')}</small></span>
        </button>
      </div>
      <ProtegerCopias copias={copias} onCambio={cambioCopias} />
      {cap.copiasEnDocumentos && copias.length > 0 && <CopiasGuardadas copias={copias} ocupado={ocupado} onRecuperar={recuperarGuardada} onCambio={refrescarCopias} />}
      {cifrada.hoja}
    </>
  )
}
