// Traducir frases con trozos de JSX dentro (negritas, iconos, números resaltados) sin partirlas en pedazos.
//   tr('Te faltan {cant} de proteína', { cant: <b>30 g</b> })
//   tr('Toca <b>Hecho</b> al acabar cada serie', { b: s => <b>{s}</b> })
// {nombre} se cambia por lo que haya en vars (texto, número o JSX); <marca>…</marca> se pinta con la función
// vars.marca (recibe el texto de dentro, ya traducido y con sus {variables} de texto o número puestas:
// tr('Después: <b>{nombre}</b>', { nombre: 'A', b: s => <b>{s}</b> })). La traducción mueve las piezas si hace falta.
import { Fragment, type ReactNode } from 'react'
import { t } from './index'

type VarsJSX = Record<string, ReactNode | ((dentro: string) => ReactNode)>

const PIEZA = /\{(\w+)\}|<(\w+)>([\s\S]*?)<\/\2>/g

export function tr(texto: string, vars: VarsJSX = {}): ReactNode {
  const frase = t(texto)
  const partes: ReactNode[] = []
  let desde = 0
  for (const m of frase.matchAll(PIEZA)) {
    if (m.index > desde) partes.push(frase.slice(desde, m.index))
    const [todo, variable, marca, dentro] = m
    if (variable != null) {
      const v = Object.hasOwn(vars, variable) ? vars[variable] : todo
      partes.push(typeof v === 'function' ? v('') : v)
    } else {
      const f = Object.hasOwn(vars, marca!) ? vars[marca!] : undefined
      const texto = (dentro ?? '').replace(/\{(\w+)\}/g, (v, k: string) => {
        const x = Object.hasOwn(vars, k) ? vars[k] : undefined
        return typeof x === 'string' || typeof x === 'number' ? String(x) : v
      })
      partes.push(typeof f === 'function' ? f(texto) : texto)
    }
    desde = m.index + todo.length
  }
  if (desde < frase.length) partes.push(frase.slice(desde))
  return <>{partes.map((p, i) => <Fragment key={i}>{p}</Fragment>)}</>
}
