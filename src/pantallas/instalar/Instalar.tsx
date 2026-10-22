// Instrucciones para instalar la app en la pantalla de inicio (solo en los navegadores de Apple).
// Salen al empezar si la app se abre en Safari sin instalar (sobre todo desde la landing, con «?instalar=1»),
// y otra vez desde Perfil → Ajustes. En Android (APK) y ya instalada, nunca al empezar.
import type { ReactNode } from 'react'
import { dispositivoApple, estaInstalada, type DispositivoApple } from '../../plataforma'
import { cx, Ico } from '../../ui/componentes'
import { t, tc } from '../../i18n'
import { tr } from '../../i18n/jsx'

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
// Lo dibujado copia lo que pone el propio Safari en cada idioma (por eso va con el contexto «iOS»).
const negrita = (x: string) => <b>{x}</b>

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
      <span className="ins-menu-it apagada">{tc('iOS', 'Copiar')}<Ico n="copy" /></span>
      <span className="ins-menu-it ins-toca-fila">{texto}<Ico n={icono} /></span>
      <span className="ins-menu-it apagada">{tc('iOS', 'Añadir a favoritos')}<Ico n="star" /></span>
    </div>
  )
}

/** Cabecera de la ventana «Añadir a inicio» dibujada. */
function CabeceraAnadir({ titulo }: { titulo: string }) {
  return (
    <div className="ins-anadir" aria-hidden="true">
      <span className="apagada">{tc('iOS', 'Cancelar')}</span>
      <b>{titulo}</b>
      <span className="ins-toca-txt">{tc('iOS', 'Añadir')}</span>
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
    { titulo: tr('Abre el menú <b>Archivo</b>', { b: negrita }), detalle: t('Arriba del todo, en la barra de menús de Safari.'), dibujo: <div className="ins-anadir mac" aria-hidden="true"><span className="ins-toca-txt">{tc('macOS', 'Archivo')}</span><span className="apagada">{tc('macOS', 'Edición')}</span><span className="apagada">{tc('macOS', 'Visualización')}</span></div> },
    { titulo: tr('Elige <b>«Añadir al Dock»</b>', { b: negrita }), detalle: t('Si no sale, actualiza el Mac: hace falta macOS Sonoma o más.'), dibujo: <FilaMenu texto={tc('macOS', 'Añadir al Dock…')} icono="plus-square" /> },
    { titulo: tr('Toca <b>«Añadir»</b>', { b: negrita }), detalle: t('JowyFit queda en el Dock, como cualquier app.'), dibujo: <CabeceraAnadir titulo={tc('macOS', 'Añadir al Dock')} /> },
  ]
  return [
    {
      titulo: tr('Toca el botón <b>Compartir</b> {icono}', { b: negrita, icono: <span className="ins-ico-txt"><Ico n="export" b /></span> }),
      detalle: d === 'ipad'
        ? t('Está arriba a la derecha, junto a la dirección de la página.')
        : t('Es el cuadrado con una flecha hacia arriba, abajo o junto a la dirección. Si no lo ves, toca primero «···».'),
      dibujo: <BarraSafari arriba={d === 'ipad'} />,
    },
    {
      titulo: tr('Toca <b>«Añadir a pantalla de inicio»</b>', { b: negrita }),
      detalle: t('Baja un poco en el menú. Si no sale, toca «Ver más» o «Editar acciones».'),
      dibujo: <FilaMenu texto={tc('iOS', 'Añadir a pantalla de inicio')} icono="plus-square" />,
    },
    {
      titulo: tr('Toca <b>«Añadir»</b>', { b: negrita }),
      detalle: t('Arriba a la derecha. Si ves «Abrir como app web», déjalo encendido.'),
      dibujo: <CabeceraAnadir titulo={tc('iOS', 'Añadir a inicio')} />,
    },
    {
      titulo: tr('Ábrela desde su <b>icono</b>', { b: negrita }),
      detalle: t('Ya está en tu pantalla de inicio: se abre a pantalla completa y funciona sin internet.'),
      dibujo: <Icono />,
    },
  ]
}

export function Instalar({ alCerrar, conDatos, letra }: { alCerrar: () => void; conDatos: boolean; letra: string }) {
  const d = dispositivoApple() ?? 'iphone'
  const instalada = estaInstalada()
  // Frases enteras para el Mac y para el iPhone o iPad: en cada idioma «el Dock» y «la pantalla de inicio» cambian la frase.
  const mac = d === 'mac'
  const nombre = d === 'mac' ? 'Mac' : d === 'ipad' ? 'iPad' : 'iPhone'
  return (
    <div className="app is-full ins-capa" data-letra={letra} role="dialog" aria-modal="true" aria-labelledby="ins-titulo">
      <section className="screen" data-full="" id="instalar">
        <div className="alt">
          <div className="alt-hero ins-hero">
            <div className="brand"><img className="brand-img" src={`${import.meta.env.BASE_URL}iconos/icono-192.png`} alt="" width={48} height={48} /><span>JOWYFIT</span></div>
            <h1 className="alt-h ins-h" id="ins-titulo">{mac ? t('Ponla en el Dock') : t('Ponla en tu pantalla de inicio')}</h1>
            <p className="alt-p">{t('Así JowyFit se abre como una app de tu {nombre}: a pantalla completa, al momento y sin internet.', { nombre })}</p>
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
              <p className="note ok mt12"><Ico n="check-circle" /><span>{mac
                ? tr('<b>Ya la tienes instalada.</b> Estás usando la app de el Dock.', { b: negrita })
                : tr('<b>Ya la tienes instalada.</b> Estás usando la app de tu pantalla de inicio.', { b: negrita })}</span></p>
            ) : conDatos ? (
              <p className="note warn mt12"><Ico n="warning" /><span>{tr('<b>Ya tienes datos aquí, en Safari.</b> La app instalada empieza vacía: antes haz una copia (Perfil → Ajustes → Copia de seguridad) y recupérala en la app con «Tengo una copia».', { b: negrita })}</span></p>
            ) : (
              <p className="note mt12"><Ico n="info" /><span>{mac
                ? tr('<b>Instálala antes de empezar.</b> Lo que apuntes aquí, en Safari, no pasa a la app de el Dock.', { b: negrita })
                : tr('<b>Instálala antes de empezar.</b> Lo que apuntes aquí, en Safari, no pasa a la app de tu pantalla de inicio.', { b: negrita })}</span></p>
            )}
          </div>
          <div className="alt-foot col">
            <button className="btn gry" onClick={alCerrar}>{instalada ? t('Cerrar') : t('Seguir en el navegador')}</button>
          </div>
        </div>
      </section>
    </div>
  )
}
