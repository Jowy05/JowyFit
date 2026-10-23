// Créditos y aviso legal: de dónde salen los datos, licencias y aviso de salud.
import type { ReactNode } from 'react'
import { capacidades } from '../../plataforma'
import { Cab, Ico, Pantalla } from '../../ui/componentes'
import { t } from '../../i18n'
import { tr } from '../../i18n/jsx'

function Enlace({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
}

export function Creditos() {
  const privacidad = `${import.meta.env.BASE_URL ?? '/'}privacypolicy.html`
  // Las piezas que solo lleva la app de Android no se citan en la web (iPhone).
  const cap = capacidades()
  return (
    <Pantalla>
      <Cab atras crumb={t('Ajustes')} titulo={t('Créditos y aviso legal')} />
      <div className="pg">
        <p className="note warn mt8"><Ico n="first-aid" /><span>{tr('<b>JowyFit no es consejo médico.</b> Consulta a un profesional antes de empezar un programa de ejercicio, sobre todo si tienes una lesión o una condición médica.', { b: x => <b>{x}</b> })}</span></p>

        <p className="grp-t">{t('Ejercicios')}</p>
        <div className="spec-box"><div className="spec">
          {/* La cita que pide la licencia de RepDB va tal cual, en inglés. */}
          <p><span>{t('Datos e imágenes')}</span><b><Enlace href="https://repdb.co">Exercise data by RepDB (repdb.co)</Enlace></b></p>
        </div></div>
        <p className="legal mt8">
          {tr('El catálogo de ejercicios y sus imágenes viene del plan gratuito de {repdb}. Se usa dentro de la app tal y como permite su licencia, que exige citar la fuente; no se redistribuye por separado.', { repdb: <Enlace href="https://repdb.co">RepDB</Enlace> })}
        </p>

        <p className="grp-t">{t('Alimentos')}</p>
        <div className="spec-box"><div className="spec">
          <p><span>{t('Productos escaneados')}</span><b><Enlace href="https://world.openfoodfacts.org">Open Food Facts</Enlace></b></p>
          <p><span>{t('Licencia')}</span><b>ODbL</b></p>
        </div></div>
        <p className="legal mt8">
          {tr('Los datos de los productos se consultan en {off}, una base de datos abierta y colaborativa publicada con la licencia Open Database License (ODbL). Pueden contener errores: revisa la etiqueta si dudas.', { off: <Enlace href="https://world.openfoodfacts.org">Open Food Facts</Enlace> })}
        </p>

        <p className="grp-t">{t('Diseño')}</p>
        <div className="spec-box"><div className="spec">
          <p><span>{t('Iconos')}</span><b><Enlace href="https://phosphoricons.com">Phosphor</Enlace> · MIT</b></p>
          <p><span>{t('Letra')}</span><b>Barlow · SIL OFL</b></p>
          <p><span>{t('Números')}</span><b>JetBrains Mono · SIL OFL</b></p>
        </div></div>

        <p className="grp-t">{t('Código abierto')}</p>
        <p className="legal">
          {t('JowyFit está hecho con software libre. Gracias a sus autores. Cada pieza conserva su licencia:')}
        </p>
        <div className="spec-box mt8"><div className="spec">
          <p><span>React, Capacitor, fflate, Workbox</span><b>MIT</b></p>
          <p><span>{t('Dexie (base de datos local)')}</span><b>Apache 2.0</b></p>
          {cap.escanerNativo && <p><span>{t('Escáner: ML Kit (Android)')}</span><b>Apache 2.0</b></p>}
          <p><span>{t('Escáner: zxing-wasm, barcode-detector (web)')}</span><b>MIT</b></p>
          {cap.salud && <p><span>{t('Pasos: @capgo/capacitor-health')}</span><b>MPL 2.0</b></p>}
          <p><span>{t('Iconos Phosphor')}</span><b>MIT</b></p>
          <p><span>{t('Fuentes Barlow y JetBrains Mono')}</span><b>SIL OFL 1.1</b></p>
        </div></div>
        <p className="legal mt8">
          {t('El código de JowyFit tiene licencia PolyForm Noncommercial: puedes usarlo, copiarlo y cambiarlo diciendo quién lo hizo, pero no venderlo. Los datos de ejercicios (RepDB) y de alimentos (Open Food Facts) no son parte de esa licencia: tienen las suyas, indicadas arriba.')}
        </p>

        <p className="grp-t">{t('Tus datos')}</p>
        <p className="legal">
          {t('Todo lo que apuntas se guarda solo en este móvil. La app no tiene cuentas ni servidores propios y no envía tus datos a ningún sitio; solo se conecta a internet para buscar productos al escanear.')}
        </p>
        <div className="list mt12">
          <a className="it" href={privacidad} target="_blank" rel="noopener noreferrer">
            <span className="ico"><Ico n="shield-check" /></span>
            <span className="tx"><b>{t('Política de privacidad')}</b></span>
            <Ico n="arrow-square-out" className="car" />
          </a>
        </div>
      </div>
    </Pantalla>
  )
}
