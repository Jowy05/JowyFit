// Poner, cambiar o quitar la contraseña de las copias. No se pide la de antes: quien tiene el móvil abierto ya ve
// todos los datos en la app; lo que protege la contraseña es el archivo que sale del móvil.
import { useState } from 'react'
import { ponerContrasena, quitarContrasena } from '../../datos/claveCopias'
import { largoContrasena, MIN_CONTRASENA } from '../../datos/cifrado'
import { CampoContrasena } from '../../ui/CampoContrasena'
import { cx, HojaSuelta, Ico } from '../../ui/componentes'
import { mensajeDe } from '../../dominio/formato'
import { t } from '../../i18n'

export type HechoContrasena = 'puesta' | 'cambiada' | 'quitada'

export function HojaContrasena({ cambiar, onCerrar, onHecho }: { cambiar: boolean; onCerrar: () => void; onHecho: (h: HechoContrasena) => void }) {
  const [una, setUna] = useState('')
  const [otra, setOtra] = useState('')
  // Los fallos salen al dejar el campo o al escribir la segunda, no a la primera letra.
  const [visto, setVisto] = useState({ una: false, otra: false })
  const [ocupado, setOcupado] = useState(false)
  const [quitar, setQuitar] = useState(false)
  const [fallo, setFallo] = useState('')

  const largo = largoContrasena(una)
  const corta = !!una && largo < MIN_CONTRASENA && (visto.una || !!otra)
  const distintas = !!otra && una !== otra && (visto.otra || otra.length >= una.length)
  const vale = largo >= MIN_CONTRASENA && una === otra

  const guardar = async () => {
    if (!vale || ocupado) return
    setOcupado(true)
    try {
      await ponerContrasena(una)
      onHecho(cambiar ? 'cambiada' : 'puesta')
    } catch (e) {
      setFallo(t('No se pudo guardar la contraseña: {error}', { error: mensajeDe(e) }))
      setOcupado(false)
    }
  }
  const quitarla = async () => {
    if (!quitar) { setQuitar(true); return }
    setOcupado(true)
    try {
      await quitarContrasena()
      onHecho('quitada')
    } catch (e) {
      setFallo(t('No se pudo quitar la contraseña: {error}', { error: mensajeDe(e) }))
      setOcupado(false)
    }
  }

  return (
    <HojaSuelta titulo={cambiar ? t('Cambiar la contraseña') : t('Poner contraseña')} sub={t('Para tus copias nuevas')} onCerrar={onCerrar}>
      {cambiar
        ? <p className="note plain"><Ico n="key" /><span>{t('Las copias que ya tienes siguen con la contraseña de antes.')}</span></p>
        : <p className="note warn"><Ico n="warning" /><span><b>{t('Si la olvidas, nadie puede abrir esas copias, ni siquiera nosotros.')}</b> {t('Apúntala en un sitio seguro.')}</span></p>}
      <div className="fields mt12">
        <CampoContrasena etiqueta={cambiar ? t('Contraseña nueva') : t('Contraseña')} pista={t('(mínimo {n})', { n: MIN_CONTRASENA })} nombre="contrasena" nueva enfocar
          valor={una} onCambio={setUna} onSalir={() => setVisto(v => ({ ...v, una: true }))}
          error={corta ? t('Mínimo {n}: llevas {llevas}', { n: MIN_CONTRASENA, llevas: largo }) : undefined} />
        <CampoContrasena etiqueta={t('Repítela')} nombre="repetida" nueva valor={otra} onCambio={setOtra} onSalir={() => setVisto(v => ({ ...v, otra: true }))}
          onEnter={() => void guardar()} error={distintas ? t('No coinciden') : undefined} />
        {fallo && <p className="note bad" role="alert"><Ico n="warning-circle" /><span>{fallo}</span></p>}
        <button type="button" className="btn w100" disabled={!vale || ocupado} onClick={() => void guardar()}>
          <Ico n="lock-simple" />{ocupado ? t('Un momento…') : cambiar ? t('Cambiar la contraseña') : t('Poner contraseña')}
        </button>
      </div>
      {cambiar && (
        <div className="quitar-clave">
          <button type="button" className={cx('btn w100', quitar ? 'badf' : 'bad')} disabled={ocupado} onClick={() => void quitarla()}>
            {quitar ? t('¿Seguro? Quitar la contraseña') : t('Quitar la contraseña')}
          </button>
          <p className="small muted mt8">{t('Las copias nuevas irán sin contraseña, como antes.')}</p>
        </div>
      )}
    </HojaSuelta>
  )
}
