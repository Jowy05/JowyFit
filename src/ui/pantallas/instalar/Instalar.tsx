// Instrucciones para instalar la app en la pantalla de inicio (solo en los navegadores de Apple).
// Salen al empezar si la app se abre en Safari sin instalar (sobre todo desde la landing, con «?instalar=1»),
// y otra vez desde Perfil → Ajustes. En Android (APK) y ya instalada, nunca al empezar.
import type { ReactNode } from 'react'
import { dispositivoApple, estaInstalada, type DispositivoApple } from '../../../plataforma'
import { cx, Ico } from '../../comp'

const CLAVE_VISTO = 'jf-instalar-visto'
const EVENTO = 'jf-instalar'

/** Abre las instrucciones desde cualquier sitio (Ajustes). */
export const abrirInstrucciones = () => window.dispatchEvent(new Event(EVENTO))
export const alPedirInstrucciones = (f: () => void) => {
  window.addEventListener(EVENTO, f)
  return () => window.removeEventListener(EVENTO, f)
}

function pideInstalar(): boolean {
  try { return new URLSearchParams(location.search).has('instalar') } catch { return false }
}

/** ¿Se enseñan al abrir la app? Solo en Apple, sin instalar, y si se piden (?instalar=1) o aún no se han visto. */
export function ensenarAlEmpezar(): boolean {
  if (!dispositivoApple() || estaInstalada()) return false
  if (pideInstalar()) return true
  try { return !localStorage.getItem(CLAVE_VISTO) } catch { return true }
}

/** Al cerrarlas: no vuelven a salir solas, y se quita «?instalar=1» para que recargar no las abra otra vez. */
export function marcarVistas() {
  try { localStorage.setItem(CLAVE_VISTO, new Date().toISOString()) } catch { /* sin almacenamiento */ }
  if (pideInstalar()) {
    const u = new URL(location.href)
    u.searchParams.delete('instalar')
    history.replaceState(history.state, '', u.pathname + u.search + u.hash)
  }
}

type Paso = { titulo: ReactNode; detalle: ReactNode; dibujo: ReactNode }

/** Barra de Safari dibujada, con el botón que hay que tocar resaltado. */
function BarraSafari({ arriba }: { arriba?: boolean }) {
  return (
    <div className={cx('ins-safari', arriba && 'arriba')} aria-hidden="true">
      <Ico n="caret-left" />
      <span className="ins-dir"><Ico n="lock-simple" />jowy05.github.io</span>
      <span className="ins-toca"><Ico n="export" b /></span>
      <Ico n="dots-three" b />
    </div>
  )
}

/** Fila del menú Compartir dibujada. */
function FilaMenu({ texto, icono }: { texto: string; icono: string }) {
  return (
    <div className="ins-menu" aria-hidden="true">
      <span className="ins-menu-it apagada">Copiar<Ico n="copy" /></span>
      <span className="ins-menu-it ins-toca-fila">{texto}<Ico n={icono} /></span>
      <span className="ins-menu-it apagada">Añadir a favoritos<Ico n="star" /></span>
    </div>
  )
}

/** Cabecera de la ventana «Añadir a inicio» dibujada. */
function CabeceraAnadir({ titulo }: { titulo: string }) {
  return (
    <div className="ins-anadir" aria-hidden="true">
      <span className="apagada">Cancelar</span>
      <b>{titulo}</b>
      <span className="ins-toca-txt">Añadir</span>
    </div>
  )
}

function Icono() {
  return (
    <div className="ins-icono" aria-hidden="true">
      <img src={`${import.meta.env.BASE_URL}iconos/icono-180.png`} alt="" width={60} height={60} />
      <span>JowyFit</span>
    </div>
  )
}

function pasos(d: DispositivoApple): Paso[] {
  if (d === 'mac') return [
    { titulo: <>Abre el menú <b>Archivo</b></>, detalle: 'Arriba del todo, en la barra de menús de Safari.', dibujo: <div className="ins-anadir mac" aria-hidden="true"><span className="ins-toca-txt">Archivo</span><span className="apagada">Edición</span><span className="apagada">Visualización</span></div> },
    { titulo: <>Elige <b>«Añadir al Dock»</b></>, detalle: 'Si no sale, actualiza el Mac: hace falta macOS Sonoma o más.', dibujo: <FilaMenu texto="Añadir al Dock…" icono="plus-square" /> },
    { titulo: <>Toca <b>«Añadir»</b></>, detalle: 'JowyFit queda en el Dock, como cualquier app.', dibujo: <CabeceraAnadir titulo="Añadir al Dock" /> },
  ]
  return [
    {
      titulo: <>Toca el botón <b>Compartir</b> <span className="ins-ico-txt"><Ico n="export" b /></span></>,
      detalle: d === 'ipad'
        ? 'Está arriba a la derecha, junto a la dirección de la página.'
        : 'Es el cuadrado con una flecha hacia arriba, abajo o junto a la dirección. Si no lo ves, toca primero «···».',
      dibujo: <BarraSafari arriba={d === 'ipad'} />,
    },
    {
      titulo: <>Toca <b>«Añadir a pantalla de inicio»</b></>,
      detalle: 'Baja un poco en el menú. Si no sale, toca «Ver más» o «Editar acciones».',
      dibujo: <FilaMenu texto="Añadir a pantalla de inicio" icono="plus-square" />,
    },
    {
      titulo: <>Toca <b>«Añadir»</b></>,
      detalle: 'Arriba a la derecha. Si ves «Abrir como app web», déjalo encendido.',
      dibujo: <CabeceraAnadir titulo="Añadir a inicio" />,
    },
    {
      titulo: <>Ábrela desde su <b>icono</b></>,
      detalle: 'Ya está en tu pantalla de inicio: se abre a pantalla completa y funciona sin internet.',
      dibujo: <Icono />,
    },
  ]
}

export function Instalar({ alCerrar, conDatos, letra }: { alCerrar: () => void; conDatos: boolean; letra: string }) {
  const d = dispositivoApple() ?? 'iphone'
  const instalada = estaInstalada()
  const donde = d === 'mac' ? 'el Dock' : 'tu pantalla de inicio'
  const nombre = d === 'mac' ? 'Mac' : d === 'ipad' ? 'iPad' : 'iPhone'
  return (
    <div className="app is-full ins-capa" data-letra={letra} role="dialog" aria-modal="true" aria-labelledby="ins-titulo">
      <section className="screen" data-full="" id="instalar">
        <div className="alt">
          <div className="alt-hero ins-hero">
            <div className="brand"><span className="brand-ic"><Ico n="barbell" b /></span><span>JOWYFIT</span></div>
            <h1 className="alt-h ins-h" id="ins-titulo">Ponla en {donde}</h1>
            <p className="alt-p">Así JowyFit se abre como una app de tu {nombre}: a pantalla completa, al momento y sin internet.</p>
          </div>
          <div className="alt-body">
            <ol className="ins-pasos">
              {pasos(d).map((p, i) => (
                <li key={i} className="card ins-paso">
                  <span className="ins-n" aria-hidden="true">{i + 1}</span>
                  <div className="ins-tx">
                    <p className="ins-t">{p.titulo}</p>
                    <p className="ins-d">{p.detalle}</p>
                    {p.dibujo}
                  </div>
                </li>
              ))}
            </ol>
            {instalada ? (
              <p className="note ok mt12"><Ico n="check-circle" /><span><b>Ya la tienes instalada.</b> Estás usando la app de {donde}.</span></p>
            ) : conDatos ? (
              <p className="note warn mt12"><Ico n="warning" /><span><b>Ya tienes datos aquí, en Safari.</b> La app instalada empieza vacía: antes haz una copia (Perfil → Ajustes → Copia de seguridad) y recupérala en la app con «Tengo una copia».</span></p>
            ) : (
              <p className="note mt12"><Ico n="info" /><span><b>Instálala antes de empezar.</b> Lo que apuntes aquí, en Safari, no pasa a la app de {donde}.</span></p>
            )}
          </div>
          <div className="alt-foot col">
            <button className="btn gry" onClick={alCerrar}>{instalada ? 'Cerrar' : 'Seguir en el navegador'}</button>
          </div>
        </div>
      </section>
    </div>
  )
}
