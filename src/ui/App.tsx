// Armazón de la app: carga inicial, alta de usuario, pestañas, hojas y mini barra de entreno.
import { useEffect, useRef, useState, type ComponentType } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { cargarCatalogo } from '../catalogo/catalogo'
import { db, pedirPersistencia } from '../datos/db'
import { prepararBase } from '../datos/repos'
import { alPulsarAtras } from '../plataforma'
import { ProveedorAviso } from './aviso'
import { cx, Ico } from './comp'
import { letraGuardada } from './tema'
import { ProveedorNav, puedeVolver, useNav, type Pestana, type Ruta } from './nav'
import { useSesionEnCurso } from './datos'
import { HOJAS, PANTALLAS } from './pantallas/registro'
import { Alta } from './pantallas/alta/Alta'
import { MiniBarra } from './pantallas/entreno/MiniBarra'
import { arrancarServicios } from './servicios'

export type PropsPantalla = { ruta: Ruta }

export function App() {
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    Promise.all([cargarCatalogo(), prepararBase()])
      .then(() => { setListo(true); void pedirPersistencia() })
      .catch(e => setError(String(e?.message ?? e)))
  }, [])
  const perfil = useLiveQuery(() => db.perfil.get('yo'), [], null)
  if (error) return <div className="app"><div className="cargando" style={{ padding: 24, textAlign: 'center' }}>No se pudo abrir la app: {error}</div></div>
  if (!listo || perfil === null) return <div className="app"><div className="cargando">JowyFit</div></div>
  return (
    <ProveedorAviso>
      <ProveedorNav>
        {perfil?.altaCompleta ? <Marco /> : <div className="app is-full" data-letra={letraGuardada()}><div className="screens"><Alta /></div></div>}
      </ProveedorNav>
    </ProveedorAviso>
  )
}

const TABS: { t: Pestana; n: string; i: string }[] = [
  { t: 'ini', n: 'Inicio', i: 'house' },
  { t: 'rut', n: 'Rutina', i: 'barbell' },
  { t: 'com', n: 'Comida', i: 'fork-knife' },
  { t: 'pro', n: 'Progreso', i: 'chart-line-up' },
  { t: 'per', n: 'Perfil', i: 'user' },
]

function Marco() {
  const nav = useNav()
  const sesion = useSesionEnCurso()
  const [letra, setLetra] = useState(letraGuardada())
  const estado = useRef(nav.estado)
  estado.current = nav.estado

  useEffect(() => {
    let quitar = () => {}
    void alPulsarAtras(() => {
      const s = estado.current
      if (!puedeVolver(s)) return false
      nav.atras()
      return true
    }).then(f => { quitar = f })
    return () => quitar()
  }, [nav])

  useEffect(() => {
    const f = () => setLetra(letraGuardada())
    window.addEventListener('jf-letra', f)
    return () => window.removeEventListener('jf-letra', f)
  }, [])

  useEffect(() => arrancarServicios(), [])

  const ruta = nav.actual
  const Pant = (PANTALLAS[ruta.p] ?? PANTALLAS.ini) as ComponentType<PropsPantalla>
  const hoja = nav.estado.hoja
  const Hoja = hoja ? (HOJAS[hoja.p] as ComponentType<PropsPantalla> | undefined) : undefined
  const full = !!nav.estado.completa
  const enCurso = !!sesion && !full

  return (
    <div className={cx('app', full && 'is-full', enCurso && 'session-on')} data-letra={letra}>
      <div className="screens">
        <Pant key={`${ruta.p}:${JSON.stringify(ruta.d ?? {})}`} ruta={ruta} />
      </div>
      {enCurso && <MiniBarra sesion={sesion} />}
      <nav className="tabbar" aria-label="Pestañas">
        {TABS.map(t => (
          <button key={t.t} className={cx(nav.estado.pestana === t.t && !full && 'on')} aria-label={t.n} aria-current={nav.estado.pestana === t.t ? 'page' : undefined} onClick={() => nav.pestana(t.t)}>
            <Ico n={t.i} />{t.n}
          </button>
        ))}
      </nav>
      {hoja && Hoja && (
        <>
          <div className="backdrop" onClick={() => nav.hoja(null)} />
          <Hoja key={hoja.p} ruta={hoja} />
        </>
      )}
    </div>
  )
}
