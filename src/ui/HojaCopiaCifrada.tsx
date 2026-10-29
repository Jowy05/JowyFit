// «Esta copia tiene contraseña»: pide la contraseña, avisa de lo que se cambia y recupera la copia. La contraseña se
// queda puesta para las copias siguientes (lo que se quiere al cambiar de móvil). Lo usan Ajustes, la bienvenida y
// «Algo ha ido mal» con `useCopiaCifrada`.
import { useCallback, useState, type ReactNode } from 'react'
import { abrirCifrada, recuperarCifrada } from '../datos/copias'
import { esCifrada, type ClaveCopias } from '../datos/cifrado'
import { mensajeDe } from '../dominio/formato'
import type { ArchivoElegido } from '../plataforma'
import { CampoContrasena } from './CampoContrasena'
import { HojaSuelta, Ico } from './componentes'
import { t } from '../i18n'
import { tr } from '../i18n/jsx'

type Archivo = ArchivoElegido
type Tipo = 'copia' | 'perfil'

/**
 * `abrir(archivo, confirmar)`: si la copia lleva contraseña, abre su hoja y devuelve true; si no, false (y la copia
 * sigue su camino de siempre). `confirmar`: preguntar «¿Recuperar…?» antes de cambiar nada (no hace falta si ya se
 * confirmó o en la bienvenida, sin datos aún). `hoja` va en el JSX de la pantalla.
 */
export function useCopiaCifrada(onRecuperada: (tipo: Tipo) => void): { abrir: (a: Archivo, confirmar?: boolean) => boolean; hoja: ReactNode } {
  const [abierta, setAbierta] = useState<Archivo & { confirmar: boolean } | null>(null)
  const cerrar = useCallback(() => setAbierta(null), [])
  const abrir = (a: Archivo, confirmar = true) => {
    if (!esCifrada(a.bytes)) return false
    setAbierta({ ...a, confirmar })
    return true
  }
  const hoja = abierta && <HojaCopiaCifrada {...abierta} onCerrar={cerrar} onRecuperada={tipo => { setAbierta(null); onRecuperada(tipo) }} />
  return { abrir, hoja }
}

function HojaCopiaCifrada({ nombre, bytes, confirmar, onCerrar, onRecuperada }: Archivo & { confirmar: boolean; onCerrar: () => void; onRecuperada: (tipo: Tipo) => void }) {
  const [contrasena, setContrasena] = useState('')
  // `error`: el de la contraseña (debajo del campo); `fallo`: la copia abrió pero no se pudo recuperar.
  const [error, setError] = useState('')
  const [fallo, setFallo] = useState('')
  const [abierta, setAbierta] = useState<{ zip: Uint8Array; clave: ClaveCopias } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const recuperar = async (a: { zip: Uint8Array; clave: ClaveCopias }) => {
    setOcupado(true)
    try { onRecuperada(await recuperarCifrada(a.zip, a.clave)) }
    catch (e) { setFallo(t('No se pudo recuperar: {error}', { error: mensajeDe(e) })); setOcupado(false) }
  }
  const abrir = async () => {
    if (ocupado) return
    if (!contrasena) { setError(t('Escribe la contraseña de esta copia')); return }
    setOcupado(true)
    setFallo('')
    try {
      const a = await abrirCifrada(bytes, contrasena)
      if (!confirmar) { await recuperar(a); return }
      setContrasena('')
      setAbierta(a)
    } catch (e) {
      // La contraseña mala ya trae su texto («No es esta contraseña…»).
      setError(mensajeDe(e))
    }
    setOcupado(false)
  }

  return (
    <HojaSuelta titulo={t('Esta copia tiene contraseña')} sub={<span className="mono">{nombre}</span>} onCerrar={onCerrar}>
      {!abierta ? (
        <div className="fields">
          <CampoContrasena etiqueta={t('Contraseña')} nombre="contrasena" valor={contrasena} error={error} enfocar onEnter={() => void abrir()}
            onCambio={v => { setContrasena(v); setError('') }} />
          {fallo && <p className="note bad" role="alert"><Ico n="warning-circle" /><span>{fallo}</span></p>}
          <button type="button" className="btn w100" disabled={ocupado} onClick={() => void abrir()}>
            <Ico n="lock-simple-open" />{ocupado ? t('Abriendo…') : t('Abrir')}
          </button>
        </div>
      ) : (
        <div className="fields">
          <p className="note ok"><Ico n="check-circle" /><span><b>{t('Contraseña correcta.')}</b></span></p>
          <p className="note warn"><Ico n="warning" /><span>{tr('¿Recuperar {nombre}? Lo que hay ahora en el móvil se cambia por lo que tiene la copia.', { nombre: <b>{nombre}</b> })}</span></p>
          {fallo && <p className="note bad" role="alert"><Ico n="warning-circle" /><span>{fallo}</span></p>}
          <div className="btns mt8">
            <button type="button" className="btn gry sm" disabled={ocupado} onClick={onCerrar}>{t('Cancelar')}</button>
            <button type="button" className="btn sm" disabled={ocupado} onClick={() => void recuperar(abierta)}>{t('Recuperar')}</button>
          </div>
        </div>
      )}
    </HojaSuelta>
  )
}
