// AJU-01 · Copia de seguridad en Ajustes: hacerla, recuperarla y, en Android, las guardadas en Documentos/JowyFit.
import { useCallback, useEffect, useState, type Ref } from 'react'
import { guardarAjustes } from '../../datos/repos'
import { importar } from '../../datos/copias'
import { aISO, fechaCorta, horaDe } from '../../dominio/fechas'
import { capacidades, copiasGuardadas, elegirArchivo, leerCopiaGuardada } from '../../plataforma'
import { cx, FilaInterruptor, Ico } from '../../ui/componentes'
import { useAviso } from '../../ui/aviso'
import { useAjustes } from '../../datos/hooks'
import { copiaCompartiendo, hacerCopiaAhora, type CopiaPreparada } from '../../app/servicios'
import { miles } from '../../dominio/formato'
import { t } from '../../i18n'
import { tr } from '../../i18n/jsx'

type Copia = { nombre: string; fecha: number; tam: number }

/** «13 oct, 20:15» a partir de una fecha ISO con hora. */
function cuando(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${fechaCorta(aISO(d))}, ${horaDe(d.getTime())}`
}

/** `refTitulo`: el título de la sección, para llegar con scroll desde el aviso de Inicio. */
export function CopiaDeSeguridad({ refTitulo }: { refTitulo: Ref<HTMLParagraphElement> }) {
  const aviso = useAviso()
  const a = useAjustes()
  const cap = capacidades()
  const [copias, setCopias] = useState<Copia[]>([])
  const [confirmar, setConfirmar] = useState<string | null>(null)
  const [archivo, setArchivo] = useState<{ nombre: string; bytes: Uint8Array } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  // Apple: la copia está hecha pero Safari no dejó abrir el menú Compartir (tardó demasiado tras el toque).
  const [copiaLista, setCopiaLista] = useState<CopiaPreparada | null>(null)

  const refrescarCopias = useCallback(() => { void copiasGuardadas().then(setCopias) }, [])
  useEffect(() => { refrescarCopias() }, [refrescarCopias])

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
      aviso(t('No se pudo hacer la copia: {error}', { error: String((e as Error).message ?? e) }))
    } finally { setOcupado(false) }
  }
  const restaurar = async (bytes: Uint8Array) => {
    setOcupado(true)
    try {
      const tipo = await importar(bytes)
      aviso(tipo === 'copia' ? t('Copia recuperada') : t('Datos del perfil recuperados'))
      window.setTimeout(() => location.reload(), 700)
    } catch (e) {
      aviso(t('No se pudo recuperar: {error}', { error: String((e as Error).message ?? e) }))
      setOcupado(false)
    }
  }
  const elegir = async () => {
    const f = await elegirArchivo()
    if (f) setArchivo(f)
  }
  const restaurarGuardada = async (nombre: string) => {
    if (confirmar !== nombre) { setConfirmar(nombre); return }
    setConfirmar(null)
    try { await restaurar(await leerCopiaGuardada(nombre)) }
    catch (e) { aviso(t('No se pudo leer la copia: {error}', { error: String((e as Error).message ?? e) })) }
  }

  return (
    <>
      <p className="grp-t" ref={refTitulo} id="aju-datos">{t('Copia de seguridad')}</p>
      <p className="note ok"><Ico n="device-mobile-camera" /><span>{tr('<b>Todo se guarda en este móvil.</b> Una copia de vez en cuando te sirve si cambias de móvil o se borra algo.', { b: x => <b>{x}</b> })}</span></p>
      <div className="list mt8" data-tour="copia">
        <button className="it" disabled={ocupado} onClick={() => void copiaAhora()}>
          <span className="ico"><Ico n="floppy-disk" /></span>
          <span className="tx"><b>{copiaLista ? t('Guardar la copia') : t('Hacer copia ahora')}</b><small>{copiaLista
            ? t('Está lista: toca para elegir dónde guardarla')
            : <>{cap.apple ? t('Guárdala en Archivos o envíatela') : t('Guarda una copia de todo')} · {a.ultimaCopia ? t('la última, {cuando}', { cuando: cuando(a.ultimaCopia) }) : t('aún no has hecho ninguna')}</>}</small></span>
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
      </div>
      {cap.copiasEnDocumentos && copias.length > 0 && (
        <details className="fold mt8">
          <summary><Ico n="folder-open" className="blue" />{t('Copias guardadas en el móvil')} <span className="tag">{copias.length}</span><Ico n="caret-down" /></summary>
          <div className="in">
            <div className="list">
              {copias.slice(0, 8).map(c => (
                <div key={c.nombre} className="it">
                  <span className="tx"><b className="small">{c.fecha ? cuando(new Date(c.fecha).toISOString()) : c.nombre}</b><small className="mono">{c.nombre}{c.tam ? ` · ${miles(Math.max(1, Math.round(c.tam / 1024)))} KB` : ''}</small></span>
                  <button className={cx('btn sm auto', confirmar === c.nombre ? 'badf' : 'gry')} disabled={ocupado} onClick={() => void restaurarGuardada(c.nombre)}>
                    {confirmar === c.nombre ? t('¿Seguro?') : t('Recuperar')}
                  </button>
                </div>
              ))}
            </div>
            {confirmar && <p className="small muted mt8">{t('Toca otra vez para recuperarla. Lo que hay ahora se cambia por lo de la copia.')}</p>}
          </div>
        </details>
      )}
    </>
  )
}
