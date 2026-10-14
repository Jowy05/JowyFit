// Armazón de la app: carga inicial, alta de usuario, pestañas, hojas y mini barra de entreno.
import { Suspense, useEffect, useRef, useState, type ComponentType } from 'react'
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
import { HOJAS, PANTALLAS, precargarPantallas } from './pantallas/registro'
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
        {perfil?.altaCompleta ? <Marco /> : <MarcoAlta />}
      </ProveedorNav>
    </ProveedorAviso>
  )
}

/** Marco del alta: también escucha el cambio de letra (botón «Aa Letra grande» de la bienvenida). */
function MarcoAlta() {
  const [letra, setLetra] = useState(letraGuardada())
  useEffect(() => {
    const f = () => setLetra(letraGuardada())
    window.addEventListener('jf-letra', f)
    return () => window.removeEventListener('jf-letra', f)
  }, [])
  return <div className="app is-full" data-letra={letra}><div className="screens"><Alta /></div></div>
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
  // Con Inicio ya pintado, se trae el código del resto de pantallas sin estorbar.
  useEffect(() => { const t = window.setTimeout(precargarPantallas, 1200); return () => window.clearTimeout(t) }, [])

  const ruta = nav.actual
  const Pant = (PANTALLAS[ruta.p] ?? PANTALLAS.ini) as ComponentType<PropsPantalla>
  const hoja = nav.estado.hoja
  const Hoja = hoja ? (HOJAS[hoja.p] as ComponentType<PropsPantalla> | undefined) : undefined
  // El escáner ocupa toda la pantalla: sin barra de pestañas tapando sus botones.
  const full = !!nav.estado.completa || ruta.p === 'com-scan'
  // El aviso se pinta fuera de .app: se le dice por el body si hay pantalla completa.
  useEffect(() => { document.body.classList.toggle('pantalla-completa', full) }, [full])
  useEffect(() => { window.dispatchEvent(new Event('jf-cerrar-aviso')) }, [nav.estado.pestana, ruta.p, hoja?.p])
  const enCurso = !!sesion && !full

  return (
    <div className={cx('app', full && 'is-full', enCurso && 'session-on')} data-letra={letra}>
      <div className="screens">
        <Suspense fallback={<div className="cargando" />}>
          <Pant key={`${ruta.p}:${JSON.stringify(ruta.d ?? {})}`} ruta={ruta} />
        </Suspense>
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
          <Suspense fallback={null}>
            <Hoja key={`${hoja.p}:${JSON.stringify(hoja.d ?? {})}`} ruta={hoja} />
          </Suspense>
        </>
      )}
    </div>
  )
}
