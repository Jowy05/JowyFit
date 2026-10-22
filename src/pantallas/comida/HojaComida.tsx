// Editar algo ya apuntado: nombre, cuándo (franja), cuánto («Poco · Normal · Mucho»), hora y, en «Afinar», los números.
import { useEffect, useState } from 'react'
import { db } from '../../datos/db'
import { borrarComida, guardarComida } from '../../datos/acciones/comida'
import type { Comida, Franja } from '../../datos/tipos'
import { FRANJAS, NOMBRE_RACION, PISTA_RACION, TAMANOS_NOTA, escalarMacros, factorRacion, nombreFranja, notaPorTamano, tamanoDe, tipoRacion, type Racion, type TamanoNota } from '../../dominio/comida'
import { t } from '../../i18n'
import { Chip, Hoja, Ico, Stepper, LARGO } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { LineaMacros, useUrlBlob } from './comun'

export function HojaComida({ ruta }: { ruta: Ruta<'sheet-comida'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const id = Number(ruta.d.id)
  const [c, setC] = useState<Comida | null>(null)
  const [original, setOriginal] = useState<Comida | null>(null)
  // Lo escrito a mano («nota» o «foto»): el tamaño elegido, o null si los números se afinaron a mano.
  const [tam, setTam] = useState<TamanoNota | null>(null)
  const fotoUrl = useUrlBlob(c?.foto)
  useEffect(() => {
    void db.comidas.get(id).then(x => {
      // El nombre en el idioma de la app (lo apuntado de una comida de partida está en castellano); deshacer usa el original.
      setC(x ? { ...x, nombre: t(x.nombre) } : null)
      setOriginal(x ?? null)
      setTam(x ? tamanoDe(x.kcal, x.proteina, x.franja) : null)
    })
  }, [id])
  if (!c || !original) return <Hoja titulo={t('Editar')}><p className="muted">{t('Cargando…')}</p></Hoja>
  const cambia = (x: Partial<Comida>) => setC({ ...c, ...x })
  // Lo que viene de algo guardado (Mis comidas, un producto, picoteo o bebida) se agranda o achica con la ración;
  // lo escrito a mano, con los mismos tamaños que al apuntarlo.
  const aMano = c.tipo === 'nota' || c.tipo === 'foto'
  // Lo que sería «Normal» con los números de ahora: de ahí salen Poco y Mucho (un picoteo guarda «Normal» = la mitad).
  const enRacion = (r: Racion) => factorRacion(r, c.tipo) / factorRacion(c.racion, c.tipo)
  const ponerRacion = (r: Racion) => {
    const f = enRacion(r)
    cambia({ racion: r, kcal: Math.round(c.kcal * f), proteina: Math.round(c.proteina * f), cafeina: c.cafeina ? Math.round(c.cafeina * f) : c.cafeina, ...escalarMacros(c, f) })
  }
  const ponerTamano = (x: TamanoNota) => { setTam(x); cambia(notaPorTamano(x, c.franja)) }
  const ponerFranja = (franja: Franja) => cambia({ franja, ...(aMano && tam ? notaPorTamano(tam, franja) : {}) })
  const afinar = (x: Partial<Comida>) => { setTam(null); cambia(x) }
  const guardar = async () => {
    const deshacer = await guardarComida({ ...c, nombre: c.nombre.trim() || original.nombre }, original)
    nav.hoja(null)
    aviso(t('Guardado'), deshacer)
  }
  const borrar = async () => {
    const deshacer = await borrarComida(original)
    nav.hoja(null)
    aviso(t('Borrado: {nombre}', { nombre: t(original.nombre) }), deshacer)
  }

  return (
    <Hoja titulo={t('Editar')} sub={nombreFranja(c.franja)} className="tall">
      {fotoUrl && <img className="foto-prev" src={fotoUrl} alt={t('Foto de la comida')} />}
      <span className="lbl fl mt8">{t('Qué es')}</span>
      <input className="inp" maxLength={LARGO.nombre} value={c.nombre} onChange={e => cambia({ nombre: e.target.value })} aria-label={t('Nombre')} />
      <p className="lbl fl mt16">{t('Cuándo')}</p>
      <div className="chips eq">
        {FRANJAS.map(f => <Chip key={f.v} on={c.franja === f.v} onClick={() => ponerFranja(f.v)}>{nombreFranja(f.v)}</Chip>)}
      </div>
      <p className="lbl fl mt16">{c.tipo === 'bebida' ? t('¿Cuánto has bebido?') : t('¿Cuánto has comido?')}</p>
      <div className="chips eq">
        {aMano
          ? TAMANOS_NOTA.map(x => (
              <Chip key={x.v} className="big ux-com-tam" on={tam === x.v} onClick={() => ponerTamano(x.v)}>
                <span>{t(x.t)}<small className="mono">~{notaPorTamano(x.v, c.franja).kcal} kcal</small></span>
              </Chip>
            ))
          : (['P', 'N', 'G'] as const).map(r => (
              <Chip key={r} className="big ux-com-tam" on={c.racion === r} onClick={() => ponerRacion(r)}>
                <span>{t(NOMBRE_RACION[r])}<small>{t(PISTA_RACION[tipoRacion(c.tipo)][r])} · <span className="mono">{Math.round(c.kcal * enRacion(r))}</span></small></span>
              </Chip>
            ))}
      </div>
      <details className="ux-com-afinar mt8">
        <summary>
          <span>{t('Afinar:')} <span className="mono">{t('{kcal} kcal · {g} g proteína', { kcal: c.kcal, g: c.proteina })}{c.cafeina ? ` · ${t('{n} mg cafeína', { n: c.cafeina })}` : ''}</span></span>
          <Ico n="caret-down" />
        </summary>
        <div className="grid2 mt8">
          <Stepper className="sm" valor={c.proteina} onCambio={v => afinar({ proteina: v })} paso={1} min={0} sufijo={t('g prot.')} etiqueta={t('Proteína')} />
          <Stepper className="sm" valor={c.kcal} onCambio={v => afinar({ kcal: v })} paso={10} min={0} sufijo="kcal" etiqueta="kcal" />
        </div>
        {(c.tipo === 'bebida' || (c.cafeina ?? 0) > 0) && (
          <div className="mt8"><Stepper className="sm" valor={c.cafeina ?? 0} onCambio={v => afinar({ cafeina: v })} paso={10} min={0} sufijo={t('mg cafeína')} etiqueta={t('Cafeína')} /></div>
        )}
      </details>
      <LineaMacros m={c} className="mt4" />
      <p className="small muted mt4">{t('Aproximado vale.')}</p>
      <p className="lbl fl mt16">{t('Hora')}</p>
      <input className="inp inp-num" type="time" value={c.hora} onChange={e => e.target.value && cambia({ hora: e.target.value })} aria-label={t('Hora')} />
      <div className="btns mt20">
        <button className="btn bad sm" onClick={() => void borrar()}>{t('Borrar')}</button>
        <button className="btn sm" onClick={() => void guardar()}>{t('Guardar')}</button>
      </div>
    </Hoja>
  )
}
