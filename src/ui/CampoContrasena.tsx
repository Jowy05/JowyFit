// El campo de una contraseña con su ojo para verla y el fallo debajo (Ajustes, la bienvenida y «Algo ha ido mal»).
import { useId, useState } from 'react'
import { Ico } from './componentes'
import { t } from '../i18n'

/** `nueva`: contraseña nueva (el gestor de contraseñas propone una); si no, la de una copia. `nombre`: para el gestor. */
export function CampoContrasena({ etiqueta, pista, nombre, valor, onCambio, onSalir, onEnter, error, nueva, enfocar }: {
  etiqueta: string; pista?: string; nombre: string; valor: string; onCambio: (v: string) => void; onSalir?: () => void; onEnter?: () => void
  error?: string; nueva?: boolean; enfocar?: boolean
}) {
  const [ver, setVer] = useState(false)
  const idError = useId()
  return (
    <div>
      <label className="fl">
        <span className="lbl fl">{etiqueta}{pista && <> <span className="hint">{pista}</span></>}</span>
        <span className="campo-clave">
          <input className="inp" name={nombre} type={ver ? 'text' : 'password'} value={valor} autoComplete={nueva ? 'new-password' : 'current-password'}
            autoCapitalize="off" autoCorrect="off" spellCheck={false} autoFocus={enfocar} aria-invalid={!!error} aria-describedby={error ? idError : undefined}
            onChange={e => onCambio(e.target.value)} onBlur={onSalir} onKeyDown={e => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter() } }} />
          <button type="button" className="ib sm" aria-label={ver ? t('Ocultar la contraseña') : t('Ver la contraseña')} aria-pressed={ver} onClick={() => setVer(v => !v)}>
            <Ico n={ver ? 'eye-slash' : 'eye'} />
          </button>
        </span>
      </label>
      {/* Fuera de la etiqueta (si no, el lector lo repite como parte del nombre) y siempre presente para que se anuncie. */}
      <span className="fallo-campo" id={idError} aria-live="polite">{error}</span>
    </div>
  )
}
