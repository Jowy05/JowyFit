// Red de seguridad: si algo falla al pintar, en vez de dejar la app en blanco (sin salida) se enseña
// «Algo ha ido mal» con lo necesario para salir: volver a Inicio, recuperar una copia o borrar los datos.
// No depende de Ajustes ni de la navegación: funciona aunque la app entera haya fallado.
import { Component, useState, type ErrorInfo, type ReactNode } from 'react'
import { borrarTodosLosDatos, importar } from '../datos/copias'
import { elegirArchivo } from '../plataforma'
import { hacerCopiaAhora } from './servicios'
import { recortar } from './comp'

type Nivel = 'app' | 'pantalla' | 'hoja'
type Props = { children: ReactNode; nivel: Nivel; alVolver?: () => void }
type Estado = { error: Error | null }

export class RedSeguridad extends Component<Props, Estado> {
  state: Estado = { error: null }
  static getDerivedStateFromError(error: unknown): Estado {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('JowyFit: fallo al pintar', error, info.componentStack)
  }
  private volver = () => {
    this.setState({ error: null })
    if (this.props.alVolver) this.props.alVolver()
    else location.reload()
  }
  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (this.props.nivel === 'hoja') {
      return (
        <div className="sheet" role="dialog" aria-modal="true" data-rescate="">
          <div className="grab" />
          <div className="sh-h"><div className="grow"><h2>Algo ha ido mal</h2></div></div>
          <p className="muted">Esto no se ha podido abrir. Tus datos siguen guardados.</p>
          <button className="btn mt16 w100" onClick={this.volver}>Cerrar</button>
        </div>
      )
    }
    return <PantallaRescate detalle={error.message} enApp={this.props.nivel === 'app'} alVolver={this.volver} />
  }
}

/** La pantalla de «Algo ha ido mal», también para cuando la app no llega a abrir. */
export function PantallaRescate({ detalle, enApp = true, alVolver = () => location.reload() }: { detalle?: string; enApp?: boolean; alVolver?: () => void }) {
  const [paso, setPaso] = useState<'nada' | 'copia' | 'borrar' | 'borrar2'>('nada')
  const [archivo, setArchivo] = useState<Uint8Array | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const elegir = async () => {
    setMensaje(null)
    const f = await elegirArchivo()
    if (!f) return
    setArchivo(f.bytes)
    setPaso('copia')
  }
  const recuperar = async () => {
    if (!archivo) return
    setOcupado(true)
    try {
      await importar(archivo)
      setMensaje('Copia recuperada. Abriendo la app…')
      window.setTimeout(() => location.reload(), 700)
    } catch (e) {
      setMensaje(`No se pudo recuperar: ${String((e as Error)?.message ?? e)}`)
      setOcupado(false)
      setPaso('nada')
    }
  }
  const guardarCopia = async () => {
    setOcupado(true)
    try {
      const nombre = await hacerCopiaAhora()
      setMensaje(`Copia guardada: ${nombre}`)
    } catch (e) {
      setMensaje(`No se pudo hacer la copia: ${String((e as Error)?.message ?? e)}`)
    } finally { setOcupado(false) }
  }
  const borrar = async () => {
    if (paso !== 'borrar2') { setPaso(paso === 'borrar' ? 'borrar2' : 'borrar'); return }
    setOcupado(true)
    await borrarTodosLosDatos()
    location.reload()
  }

  const cuerpo = (
    <div className="pg rescate" data-rescate="" style={{ padding: '32px 16px', maxWidth: 520, margin: '0 auto' }}>
      <h1 className="h1" style={{ marginBottom: 8 }}>Algo ha ido mal</h1>
      <p className="muted">Esta pantalla no se ha podido abrir. Tus datos siguen guardados en el móvil.</p>
      {mensaje && <p className="note mt12" role="status"><span>{mensaje}</span></p>}
      <div className="mt16" style={{ display: 'grid', gap: 10 }}>
        <button className="btn" disabled={ocupado} onClick={alVolver}>Volver a Inicio</button>
        {paso === 'copia' ? (
          <div className="card pd">
            <p><b>¿Recuperar esta copia?</b></p>
            <p className="muted small">Lo que hay ahora en el móvil se cambia por lo que tiene la copia.</p>
            <div className="btns mt12">
              <button className="btn gry sm" disabled={ocupado} onClick={() => { setPaso('nada'); setArchivo(null) }}>Cancelar</button>
              <button className="btn sm" disabled={ocupado} onClick={() => void recuperar()}>Sí, recuperar</button>
            </div>
          </div>
        ) : (
          <button className="btn ln" disabled={ocupado} onClick={() => void elegir()}>Recuperar una copia</button>
        )}
        <button className="btn ln" disabled={ocupado} onClick={() => void guardarCopia()}>Guardar una copia de lo que hay</button>
        {(paso === 'borrar' || paso === 'borrar2') && (
          <p className="note bad"><span>{paso === 'borrar2' ? '¿Seguro del todo? Se borran tus entrenos, comidas, medidas y fotos de este móvil.' : 'Se borra todo lo que hay en este móvil. No se puede deshacer.'}</span></p>
        )}
        <div className="btns">
          {paso === 'borrar' || paso === 'borrar2' ? <button className="btn gry sm" disabled={ocupado} onClick={() => setPaso('nada')}>Cancelar</button> : null}
          <button className="btn badf sm" disabled={ocupado} onClick={() => void borrar()}>
            {paso === 'borrar2' ? 'Sí, borrarlo todo' : paso === 'borrar' ? 'Borrar todo' : 'Borrar todos los datos'}
          </button>
        </div>
      </div>
      {detalle && <p className="small muted mt16" style={{ wordBreak: 'break-word' }}>Detalle: {recortar(detalle, 200)}</p>}
    </div>
  )
  // Fuera de la app (fallo de todo) hace falta el marco con el fondo y la letra de la app.
  return enApp ? <div className="app"><div className="screens" style={{ overflow: 'auto' }}>{cuerpo}</div></div> : <section className="screen" style={{ overflow: 'auto' }}>{cuerpo}</section>
}
