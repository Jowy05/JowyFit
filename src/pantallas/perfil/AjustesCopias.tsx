// AJU-01 · Copia de seguridad en Ajustes: hacerla, recuperarla, cuántas automáticas guardar y, aparte, la contraseña
// (ProtegerCopias) y las guardadas en Documentos/JowyFit (CopiasGuardadas, solo Android).
import { useCallback, useEffect, useState, type Ref } from 'react'
import { guardarAjustes } from '../../datos/repos'
import { importar } from '../../datos/copias'
import { OPCIONES_COPIAS_AUTO } from '../../dominio/copias'
import { mensajeDe } from '../../dominio/formato'
import { capacidades, copiasGuardadas, elegirArchivo, type ArchivoElegido, type CopiaGuardada } from '../../plataforma'
import { Chip, FilaInterruptor, Ico } from '../../ui/componentes'
import { useCopiaCifrada } from '../../ui/HojaCopiaCifrada'
import { useAviso } from '../../ui/aviso'
import { useAjustes } from '../../datos/hooks'
import { copiaCompartiendo, hacerCopiaAhora, type CopiaPreparada } from '../../app/copias'
import { CopiasGuardadas, cuando } from './CopiasGuardadas'
import { ProtegerCopias } from './ProtegerCopias'
import { t } from '../../i18n'
import { tr } from '../../i18n/jsx'

const textoGuardar = (n: number) => (n ? t('Las {n} últimas', { n }) : t('Todas'))

/** `refTitulo`: el título de la sección, para llegar con scroll desde el aviso de Inicio. */
export function CopiaDeSeguridad({ refTitulo }: { refTitulo: Ref<HTMLParagraphElement> }) {
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
      const nombre = await hacerCopiaAhora()
      aviso(cap.copiasEnDocumentos ? t('Copia guardada en Documentos/JowyFit: {nombre}', { nombre }) : t('Copia descargada: {nombre}', { nombre }))
      refrescarCopias()
    } catch (e) {
      aviso(t('No se pudo hacer la copia: {error}', { error: mensajeDe(e) }))
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

  return (
    <>
      <p className="grp-t" ref={refTitulo} id="aju-datos">{t('Copia de seguridad')}</p>
      <p className="note ok"><Ico n="device-mobile-camera" /><span>{tr('<b>Todo se guarda en este móvil.</b> Una copia de vez en cuando te sirve si cambias de móvil o se borra algo.', { b: x => <b>{x}</b> })}</span></p>
      <div className="list mt8" data-tour="copia">
        <button className="it" disabled={ocupado} onClick={() => void copiaAhora()}>
          <span className="ico"><Ico n="floppy-disk" /></span>
          <span className="tx"><b>{copiaLista ? t('Guardar la copia') : t('Hacer copia ahora')}</b><small>{copiaLista
            ? t('Está lista: toca para elegir dónde guardarla')
            : <>{cap.apple ? t('Guárdala en Archivos o envíatela') : t('Guarda una copia de todo')} · {a.ultimaCopia ? t('la última, {cuando}', { cuando: cuando(new Date(a.ultimaCopia)) }) : t('aún no has hecho ninguna')}</>}</small></span>
        </button>
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
      <ProtegerCopias copias={copias} onCambio={cambioCopias} />
      {cap.copiasEnDocumentos && copias.length > 0 && <CopiasGuardadas copias={copias} ocupado={ocupado} onRecuperar={recuperarGuardada} onCambio={refrescarCopias} />}
      {cifrada.hoja}
    </>
  )
}
