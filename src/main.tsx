import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow/700.css'
import '@fontsource/barlow-semi-condensed/500.css'
import '@fontsource/barlow-semi-condensed/600.css'
import '@fontsource/barlow-semi-condensed/700.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'
import '@phosphor-icons/web/regular/style.css'
import '@phosphor-icons/web/bold/style.css'
// Todo el CSS de la app se importa aquí y en este orden: la cascada depende de él.
import './ui/estilos/tokens.css'
import './ui/estilos/base.css'
import './ui/estilos/componentes.css'
import './ui/estilos/pantallas/alta.css'
import './ui/estilos/pantallas/inicio.css'
import './ui/estilos/pantallas/rutina.css'
import './ui/estilos/pantallas/propios.css'
import './ui/estilos/pantallas/entreno.css'
import './ui/estilos/pantallas/comida.css'
import './ui/estilos/pantallas/progreso.css'
import './ui/estilos/pantallas/perfil.css'
import './ui/estilos/tutorial.css'
import './ui/estilos/pantallas/instalar.css'
import './ui/estilos/iphone.css'
import { Capacitor } from '@capacitor/core'
import { App } from './app/App'
import { RedSeguridad } from './app/Rescate'
import { aplicarTemaGuardado } from './ui/tema'
import { cargarIdioma } from './i18n'

aplicarTemaGuardado()
// El diccionario del idioma (si no es castellano) se empieza a bajar ya; App espera a que esté antes de pintar.
void cargarIdioma()

// Service worker solo en la web (iPhone): guarda la app para usarla sin conexión.
// En Android la app ya va dentro del APK; un service worker guardaría la versión vieja tras actualizar.
if (Capacitor.isNativePlatform()) {
  void navigator.serviceWorker?.getRegistrations().then(rs => rs.forEach(r => void r.unregister()))
  void globalThis.caches?.keys().then(ks => ks.forEach(k => void caches.delete(k)))
} else if ('serviceWorker' in navigator) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
}

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    {/* Si algo falla al pintar, nunca se queda en blanco: «Algo ha ido mal» con salida (Inicio, copia, borrar). */}
    <RedSeguridad nivel="app">
      <App />
    </RedSeguridad>
  </StrictMode>,
)
