// Créditos y aviso legal: de dónde salen los datos, licencias y aviso de salud.
import type { ReactNode } from 'react'
import { esNativo } from '../../../plataforma'
import { Cab, Ico, Pantalla } from '../../comp'

function Enlace({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
}

export function Creditos() {
  const privacidad = `${import.meta.env.BASE_URL ?? '/'}privacypolicy.html`
  // Las piezas que solo lleva la app de Android no se citan en la web (iPhone).
  const nativo = esNativo()
  return (
    <Pantalla>
      <Cab atras crumb="Ajustes" titulo="Créditos y aviso legal" />
      <div className="pg">
        <p className="note warn mt8"><Ico n="first-aid" /><span><b>JowyFit no es consejo médico.</b> Consulta a un profesional antes de empezar un programa de ejercicio, sobre todo si tienes una lesión o una condición médica.</span></p>

        <p className="grp-t">Ejercicios</p>
        <div className="spec-box"><div className="spec">
          <p><span>Datos e imágenes</span><b><Enlace href="https://repdb.co">Exercise data by RepDB (repdb.co)</Enlace></b></p>
        </div></div>
        <p className="legal mt8">
          El catálogo de ejercicios y sus imágenes viene del plan gratuito de <Enlace href="https://repdb.co">RepDB</Enlace>. Se usa
          dentro de la app tal y como permite su licencia, que exige citar la fuente; no se redistribuye por separado.
        </p>

        <p className="grp-t">Alimentos</p>
        <div className="spec-box"><div className="spec">
          <p><span>Productos escaneados</span><b><Enlace href="https://world.openfoodfacts.org">Open Food Facts</Enlace></b></p>
          <p><span>Licencia</span><b>ODbL</b></p>
        </div></div>
        <p className="legal mt8">
          Los datos de los productos se consultan en <Enlace href="https://world.openfoodfacts.org">Open Food Facts</Enlace>, una base
          de datos abierta y colaborativa publicada con la licencia Open Database License (ODbL). Pueden contener errores:
          revisa la etiqueta si dudas.
        </p>

        <p className="grp-t">Diseño</p>
        <div className="spec-box"><div className="spec">
          <p><span>Iconos</span><b><Enlace href="https://phosphoricons.com">Phosphor</Enlace> · MIT</b></p>
          <p><span>Letra</span><b>Barlow · SIL OFL</b></p>
          <p><span>Números</span><b>JetBrains Mono · SIL OFL</b></p>
        </div></div>

        <p className="grp-t">Código abierto</p>
        <p className="legal">
          JowyFit está hecho con software libre. Gracias a sus autores. Cada pieza conserva su licencia:
        </p>
        <div className="spec-box mt8"><div className="spec">
          <p><span>React, Capacitor, fflate, Workbox</span><b>MIT</b></p>
          <p><span>Dexie (base de datos local)</span><b>Apache 2.0</b></p>
          {nativo && <p><span>Escáner: ML Kit (Android)</span><b>Apache 2.0</b></p>}
          <p><span>Escáner: zxing-wasm, barcode-detector (web)</span><b>MIT</b></p>
          {nativo && <p><span>Pasos: @capgo/capacitor-health</span><b>MPL 2.0</b></p>}
          <p><span>Iconos Phosphor</span><b>MIT</b></p>
          <p><span>Fuentes Barlow y JetBrains Mono</span><b>SIL OFL 1.1</b></p>
        </div></div>
        <p className="legal mt8">
          El código de JowyFit tiene licencia MIT. Los datos de ejercicios (RepDB) y de alimentos (Open Food Facts) no son
          parte de esa licencia: tienen las suyas, indicadas arriba.
        </p>

        <p className="grp-t">Tus datos</p>
        <p className="legal">
          Todo lo que apuntas se guarda solo en este móvil. La app no tiene cuentas ni servidores propios y no envía tus datos a
          ningún sitio; solo se conecta a internet para buscar productos al escanear.
        </p>
        <div className="list mt12">
          <a className="it" href={privacidad} target="_blank" rel="noopener noreferrer">
            <span className="ico"><Ico n="shield-check" /></span>
            <span className="tx"><b>Política de privacidad</b></span>
            <Ico n="arrow-square-out" className="car" />
          </a>
        </div>
      </div>
    </Pantalla>
  )
}
