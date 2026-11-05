// INI-01 · Un ejercicio que ha molestado varios entrenos seguidos: se propone cambiarlo por otro que no cargue esa
// zona (o quitarlo si no hay ninguno), con un toque y «Deshacer». «Seguir igual» no vuelve a preguntar hasta otra molestia.
import { useLiveQuery } from 'dexie-react-hooks'
import { propuestasMolestia, type PropuestaMolestia } from '../../datos/consultas'
import { cambiarPorMolestia, seguirConMolestia } from '../../datos/acciones/molestias'
import { nombreEjercicio, useCatalogo } from '../../catalogo/catalogo'
import { nombreZonaDolor } from '../../dominio/salud'
import { VECES_MOLESTIA } from '../../dominio/molestias'
import { Ico, useUnaVez } from '../../ui/componentes'
import { useAviso } from '../../ui/aviso'
import { t } from '../../i18n'

export function MolestiaRepetida() {
  // Sin el catálogo cargado no se sabe qué poner en su lugar: hasta entonces, nada.
  const cat = useCatalogo()
  const props = useLiveQuery(() => (cat ? propuestasMolestia() : Promise.resolve([])), [cat])
  // De una en una: con dos a la vez la pantalla se llena de preguntas.
  const p = props?.[0]
  if (!p) return null
  return <Tarjeta key={`${p.ejercicio}-${p.sesion}`} p={p} />
}

function Tarjeta({ p }: { p: PropuestaMolestia }) {
  const aviso = useAviso()
  const unaVez = useUnaVez()
  const nombre = nombreEjercicio(p.ejercicio)
  const cambiar = unaVez(async () => {
    const r = await cambiarPorMolestia(p.ejercicio)
    aviso(r.texto, () => void r.deshacer())
  })
  const seguir = unaVez(async () => {
    const deshacer = await seguirConMolestia(p.ejercicio, p.sesion)
    aviso(t('Vale, lo dejamos. Si vuelve a molestar, te avisamos'), () => void deshacer())
  })
  return (
    <div className="sec">
      <div className="card pd">
        <div className="row">
          <span className="ico big warnb"><Ico n="warning" /></span>
          <div className="grow">
            <h3 className="h3">{t('{ejercicio} te molesta', { ejercicio: nombre })}</h3>
            <p className="small muted">
              {t('Lo has marcado con molestia en los {n} últimos entrenos.', { n: VECES_MOLESTIA })}{' '}
              {p.otro
                ? (p.zona ? t('¿Lo cambiamos por {otro}? Carga menos {zona}.', { otro: nombreEjercicio(p.otro), zona: nombreZonaDolor(p.zona).toLowerCase() }) : t('¿Lo cambiamos por {otro}?', { otro: nombreEjercicio(p.otro) }))
                : t('No hay otro parecido que puedas hacer: ¿lo quitamos de tu plan?')}
            </p>
          </div>
        </div>
        <div className="btns mt12">
          <button className="btn gry sm" onClick={() => void seguir()}>{t('Seguir igual')}</button>
          <button className="btn sm" onClick={() => void cambiar()}>{p.otro ? t('Cambiarlo') : t('Quitarlo')}</button>
        </div>
      </div>
    </div>
  )
}
