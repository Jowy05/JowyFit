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
import './ui/estilos/tokens.css'
import './ui/estilos/base.css'
import './ui/estilos/componentes.css'
import './ui/estilos/extra.css'
import './ui/estilos/ux-alta.css'
import './ui/estilos/ux-entreno.css'
import './ui/estilos/ux-comida.css'
import './ui/estilos/ux-rutina.css'
import './ui/estilos/ux-progreso.css'
import { Capacitor } from '@capacitor/core'
import { App } from './ui/App'
import { RedSeguridad } from './ui/Rescate'
import { aplicarTemaGuardado } from './ui/tema'

aplicarTemaGuardado()

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
