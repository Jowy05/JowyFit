// Armazón de la app: carga inicial, alta de usuario, pestañas, hojas y mini barra de entreno.
import { Suspense, useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { cargarCatalogo } from '../catalogo/catalogo'
import { cargarIdioma, t, tk } from '../i18n'
import { leerPerfil, pedirPersistencia, prepararBase } from '../datos/repos'
import { alPulsarAtras, marcarPlataforma, prepararSonido } from '../plataforma'
import { ProveedorAviso } from '../ui/aviso'
import { cx, Ico } from '../ui/componentes'
import { letraGuardada } from '../ui/tema'
import { ProveedorNav, queHaceAtras, useNav, type Pestana, type Ruta } from './nav'
import { useSesionEnCurso } from '../datos/hooks'
import { HOJAS, PANTALLAS, precargarPantallas } from './rutas'
import { Alta } from '../pantallas/alta/Alta'
import { MiniBarra } from '../pantallas/entreno/MiniBarra'
import { arrancarServicios } from './servicios'
import { alPedirInstrucciones, ensenarAlEmpezar, Instalar, marcarVistas } from '../pantallas/instalar/Instalar'
import { PantallaRescate, RedSeguridad } from './Rescate'
import { alLanzarTutorial, marcarTutorialOfrecido, Tutorial, tutorialOfrecido } from '../ui/tutorial/Tutorial'

// Apple: estilos propios (barra de estado de la app instalada). En todas partes: el sonido se abre con el primer
// toque, para que el pitido de fin de descanso suene en iPhone.
marcarPlataforma()
prepararSonido()

declare global { interface Window { __jfAtras?: () => boolean } }

export function App() {
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    // El idioma (si no es castellano) se carga antes de pintar nada: así todo sale ya traducido.
    Promise.all([cargarIdioma(), cargarCatalogo(), prepararBase()])
      .then(() => { setListo(true); void pedirPersistencia() })
      .catch(e => setError(String(e?.message ?? e)))
  }, [])
  const perfil = useLiveQuery(leerPerfil, [], null)
  // Instrucciones para instalarla (solo Apple sin instalar al empezar; también desde Ajustes).
  const [instalar, setInstalar] = useState(ensenarAlEmpezar)
  useEffect(() => alPedirInstrucciones(() => setInstalar(true)), [])
  const cerrarInstalar = () => { marcarVistas(); setInstalar(false) }
  // Si no abre, hay salida: recuperar una copia o borrar los datos.
  if (error) return <PantallaRescate detalle={t('No se pudo abrir la app: {error}', { error })} />
  if (!listo || perfil === null) return <div className="app"><div className="cargando">JowyFit</div></div>
  return (
    <ProveedorAviso>
      <ProveedorNav>
        {perfil?.altaCompleta ? <Marco /> : <MarcoAlta />}
      </ProveedorNav>
      {instalar && <Instalar alCerrar={cerrarInstalar} conDatos={!!perfil?.altaCompleta} letra={letraGuardada()} />}
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

// Los nombres se traducen al pintarlos (esta lista se crea antes de cargar el idioma).
const TABS: { t: Pestana; n: string; i: string }[] = [
  { t: 'ini', n: tk('Inicio'), i: 'house' },
  { t: 'rut', n: tk('Rutina'), i: 'barbell' },
  { t: 'com', n: tk('Comida'), i: 'fork-knife' },
  { t: 'pro', n: tk('Progreso'), i: 'chart-line-up' },
  { t: 'per', n: tk('Perfil'), i: 'user' },
]

function Marco() {
  const nav = useNav()
  const sesion = useSesionEnCurso()
  const [letra, setLetra] = useState(letraGuardada())
  const estado = useRef(nav.estado)
  estado.current = nav.estado
  // Tutorial: se lanza desde la hoja de bienvenida o desde Ajustes. Mientras dura, «atrás» lo cierra.
  const [tutorial, setTutorial] = useState(false)
  const enTutorial = useRef(false)
  enTutorial.current = tutorial
  const cerrarTutorial = useCallback(() => setTutorial(false), [])
  useEffect(() => alLanzarTutorial(() => setTutorial(true)), [])

  useEffect(() => {
    const manejar = () => {
      if (enTutorial.current) { setTutorial(false); return true }
      const que = queHaceAtras(estado.current)
      if (que === 'preguntar-entreno') nav.hoja('sheet-salir-entreno')
      else if (que === 'atras') nav.atras()
      return que !== 'minimizar-app'
    }
    // Las pruebas de extremo a extremo (en el navegador no hay botón atrás) lo pulsan por aquí.
    window.__jfAtras = manejar
    let quitar = () => {}
    void alPulsarAtras(manejar).then(f => { quitar = f })
    return () => { quitar(); delete window.__jfAtras }
  }, [nav])

  useEffect(() => {
    const f = () => setLetra(letraGuardada())
    window.addEventListener('jf-letra', f)
    return () => window.removeEventListener('jf-letra', f)
  }, [])

  useEffect(() => arrancarServicios(), [])

  // La primera vez, con Inicio ya a la vista, se ofrece el tutorial (una sola vez; luego está en Ajustes).
  // En Apple, si están saliendo las instrucciones para instalarla, se espera a que se cierren.
  const libre = nav.estado.pestana === 'ini' && !nav.estado.hoja && !nav.estado.completa && !tutorial
  useEffect(() => {
    if (!libre || tutorialOfrecido()) return
    const t = window.setInterval(() => {
      if (document.getElementById('instalar')) return
      window.clearInterval(t)
      marcarTutorialOfrecido()
      nav.hoja('sheet-tutorial')
    }, 1500)
    return () => window.clearInterval(t)
  }, [libre, nav])
  // Con Inicio ya pintado, se trae el código del resto de pantallas sin estorbar.
  useEffect(() => { const t = window.setTimeout(precargarPantallas, 1200); return () => window.clearTimeout(t) }, [])

  const ruta = nav.actual
  // rutas.tsx da a cada código su pantalla y nav.tsx sus datos; TypeScript no sabe casar las dos uniones aquí.
  const Pant = PANTALLAS[ruta.p] as ComponentType<{ ruta: Ruta }>
  const hoja = nav.estado.hoja
  const Hoja = hoja ? (HOJAS[hoja.p] as ComponentType<{ ruta: Ruta }>) : undefined
  // El escáner ocupa toda la pantalla: sin barra de pestañas tapando sus botones.
  const full = !!nav.estado.completa || ruta.p === 'com-scan'
  // El aviso se pinta fuera de .app: se le dice por el body si hay pantalla completa.
  useEffect(() => { document.body.classList.toggle('pantalla-completa', full) }, [full])
  useEffect(() => { document.body.classList.toggle('con-hoja', !!hoja) }, [hoja])
  useEffect(() => { window.dispatchEvent(new Event('jf-cerrar-aviso')) }, [nav.estado.pestana, ruta.p, hoja?.p])
  const enCurso = !!sesion && !full

  return (
    <div className={cx('app', full && 'is-full', enCurso && 'session-on')} data-letra={letra}>
      <div className="screens">
        {/* Una pantalla que falla no tumba la app: se queda la barra de pestañas y la salida a Inicio. */}
        <RedSeguridad key={`${ruta.p}:${JSON.stringify(ruta.d ?? {})}`} nivel="pantalla" alVolver={() => { nav.completa(null); nav.hoja(null); nav.pestana('ini') }}>
          <Suspense fallback={<div className="cargando" />}>
            <Pant ruta={ruta} />
          </Suspense>
        </RedSeguridad>
      </div>
      {enCurso && <MiniBarra sesion={sesion} />}
      <nav className="tabbar" aria-label={t('Pestañas')}>
        {TABS.map(x => (
          <button key={x.t} className={cx(nav.estado.pestana === x.t && !full && 'on')} aria-label={t(x.n)} aria-current={nav.estado.pestana === x.t ? 'page' : undefined} onClick={() => nav.pestana(x.t)}>
            <Ico n={x.i} />{t(x.n)}
          </button>
        ))}
      </nav>
      {hoja && Hoja && (
        <>
          <div className="backdrop" onClick={() => nav.hoja(null)} />
          <RedSeguridad key={`${hoja.p}:${JSON.stringify(hoja.d ?? {})}`} nivel="hoja" alVolver={() => nav.hoja(null)}>
            <Suspense fallback={null}>
              <Hoja ruta={hoja} />
            </Suspense>
          </RedSeguridad>
        </>
      )}
      {tutorial && <Tutorial alCerrar={cerrarTutorial} />}
    </div>
  )
}
