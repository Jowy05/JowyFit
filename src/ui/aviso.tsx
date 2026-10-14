// Aviso breve inferior («toast»), con «Deshacer» opcional.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

type Aviso = { id: number; texto: string; deshacer?: () => void }
type Ctx = (texto: string, deshacer?: () => void) => void

const AvisoCtx = createContext<Ctx>(() => {})

export function ProveedorAviso({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const temporizador = useRef<number | undefined>(undefined)
  const mostrar = useCallback<Ctx>((texto, deshacer) => {
    window.clearTimeout(temporizador.current)
    setAviso({ id: Date.now(), texto, deshacer })
    temporizador.current = window.setTimeout(() => setAviso(null), deshacer ? 4500 : 2800)
  }, [])
  useEffect(() => () => window.clearTimeout(temporizador.current), [])
  // Al cambiar de pestaña o de pantalla el aviso ya no viene a cuento: se cierra.
  useEffect(() => {
    // Solo si ya lleva un rato: el aviso que sale justo al volver de una hoja («Añadido…») se queda.
    const cerrar = () => setAviso(a => (a && Date.now() - a.id > 900 ? null : a))
    window.addEventListener('jf-cerrar-aviso', cerrar)
    return () => window.removeEventListener('jf-cerrar-aviso', cerrar)
  }, [])
  return (
    <AvisoCtx.Provider value={mostrar}>
      {children}
      {aviso && (
        <div className="toast" role="status" key={aviso.id}>
          <span className="toast-msg" onClick={() => setAviso(null)}>{aviso.texto}</span>
          {aviso.deshacer && (
            <button className="toast-act" type="button" onClick={() => { aviso.deshacer?.(); setAviso(null) }}>
              Deshacer
            </button>
          )}
        </div>
      )}
    </AvisoCtx.Provider>
  )
}

export const useAviso = () => useContext(AvisoCtx)
