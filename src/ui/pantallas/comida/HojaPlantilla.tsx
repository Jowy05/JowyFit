// COM-06 · Crear/editar una comida de «Mis comidas» (antes «plantilla»). Lo mínimo: nombre y cuánto es
// («Poco · Normal · Mucho», los mismos botones que al escribir lo que has comido); los números, en «Afinar».
// Si se crea desde Añadir, «Guardar y apuntar» la deja guardada y apuntada de una vez.
import { useEffect, useState } from 'react'
import { db } from '../../../datos/db'
import type { Franja, Plantilla } from '../../../datos/tipos'
import { FRANJAS, NOMBRE_FRANJA, TAMANOS_NOTA, aspecto, franjaPorHora, notaPorTamano, picoteoPorTamano, tamanoDe, type TamanoNota } from '../../../dominio/comida'
import { horaActual, hoyISO } from '../../../dominio/fechas'
import { hacerFoto } from '../../../plataforma'
import { Chip, cx, Hoja, Ico, Stepper, useUnaVez } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { apuntarPlantilla, useUrlBlob } from './comun'

/** Una comida nueva empieza en «Normal» para la comida del mediodía. */
const nueva = (): Plantilla => ({ nombre: '', ...notaPorTamano('normal', 'comida'), tipo: 'comida', usos: 0 })
/** Lo habitual de una bebida (para no dejar las 600 kcal de una comida). */
const BEBIDA = { kcal: 100, proteina: 0 } as const

export function HojaPlantilla({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const id = typeof ruta.d?.id === 'number' ? ruta.d.id : undefined
  // Desde Añadir llegan el día y la franja: entonces se puede apuntar a la vez que se guarda.
  const apuntarEn = id == null && typeof ruta.d?.fecha === 'string' ? { fecha: ruta.d.fecha, franja: ruta.d.franja as Franja | undefined } : null
  const [p, setP] = useState<Plantilla | null>(id == null ? nueva() : null)
  // Tamaño elegido con los botones; null si los números se han afinado a mano.
  const [tam, setTam] = useState<TamanoNota | null>(id == null ? 'normal' : null)
  const fotoUrl = useUrlBlob(p?.foto)
  // Una comida nueva no tiene id: con un doble toque en «Guardar» se creaban dos.
  const unaVez = useUnaVez()
  useEffect(() => {
    if (id != null) void db.plantillas.get(id).then(x => {
      setP(x ?? nueva())
      setTam(x ? tamanoDe(x.kcal, x.proteina, x.franja ?? 'comida', x.tipo === 'picoteo') : 'normal')
    })
  }, [id])
  if (!p) return <Hoja titulo="Mis comidas"><p className="muted">Cargando…</p></Hoja>
  const cambia = (c: Partial<Plantilla>) => setP({ ...p, ...c })
  const a = aspecto(p.nombre || 'comida', p.tipo)
  /** kcal y proteína de un tamaño: los del picoteo, o los de una comida en su franja. */
  const valores = (t: TamanoNota, tipo: Plantilla['tipo'], franja: Franja | undefined) => (tipo === 'picoteo' ? picoteoPorTamano(t) : notaPorTamano(t, franja ?? 'comida'))

  const ponTamano = (t: TamanoNota) => { setTam(t); cambia(valores(t, p.tipo, p.franja)) }
  const afinar = (c: Partial<Plantilla>) => { setTam(null); cambia(c) }
  const ponTipo = (tipo: Plantilla['tipo']) => {
    if (tipo !== 'bebida') cambia({ tipo, ...(tam ? valores(tam, tipo, p.franja) : {}) })
    // Sin tocar los números, una bebida nueva empieza con valores de bebida.
    else cambia({ tipo, ...(p.id == null && tam ? BEBIDA : {}) })
  }
  const ponFranja = (franja: Franja | undefined) => cambia({ franja, ...(tam && p.tipo === 'comida' ? valores(tam, 'comida', franja) : {}) })

  /** La comida lista para guardar, o null (con aviso) si falta el nombre. */
  const limpia = (): Plantilla | null => {
    if (!p.nombre.trim()) { aviso('Ponle un nombre'); return null }
    return { ...p, nombre: p.nombre.trim(), cafeina: p.tipo === 'bebida' ? p.cafeina ?? 0 : p.cafeina || undefined }
  }
  const guardar = unaVez(async () => {
    const x = limpia()
    if (!x) return
    await db.plantillas.put(x)
    nav.hoja(null)
    // Crear no es apuntar: el aviso lo dice para que nadie crea que ya está en el Día.
    aviso(id == null ? `Creada «${x.nombre}» (aún sin apuntar)` : 'Cambios guardados')
  })
  const guardarYApuntar = unaVez(async () => {
    const x = limpia()
    if (!x || !apuntarEn) return
    const nuevoId = await db.plantillas.add(x)
    // Como en Añadir: la comida va a la franja elegida; el picoteo y la bebida de hoy, a la de la hora.
    const franja = x.tipo === 'comida' || apuntarEn.fecha !== hoyISO() ? apuntarEn.franja : franjaPorHora(horaActual())
    const deshacer = await apuntarPlantilla({ ...x, id: nuevoId }, 'N', apuntarEn.fecha, franja)
    nav.hoja(null)
    // Deshacer quita lo apuntado; la comida sigue en Mis comidas.
    aviso(`Añadido: ${x.nombre}`, deshacer)
  })
  const borrar = async () => {
    if (p.id == null) return
    const copia = p
    await db.plantillas.delete(p.id)
    nav.hoja(null)
    aviso(`Borrado de Mis comidas: ${p.nombre}`, () => { void db.plantillas.put(copia) })
  }
  const foto = async () => { const f = await hacerFoto(600); if (f) cambia({ foto: f }) }

  return (
    <Hoja titulo={id == null ? 'Crear comida nueva' : 'Editar'} sub={id == null ? (apuntarEn ? 'Se apunta ahora y queda guardada para otras veces' : 'Para apuntarla luego con un toque') : 'Mis comidas · se apunta con un toque'} className="tall">
      <div className="row">
        <button className={cx('fp xl', !fotoUrl && a.fp)} aria-label="Foto (opcional)" onClick={() => void foto()} style={fotoUrl ? { background: '#fff' } : undefined}>
          {fotoUrl ? <img src={fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Ico n="camera" b />}
        </button>
        <div className="grow">
          <span className="lbl fl">Nombre</span>
          <input className="inp" value={p.nombre} onChange={e => cambia({ nombre: e.target.value })} placeholder="p. ej. Lentejas de mi madre" aria-label="Nombre de la comida" />
          <small className="small muted">Foto opcional: toca la cámara.</small>
        </div>
      </div>

      <p className="lbl fl mt16">Qué es</p>
      <div className="chips eq">
        <Chip on={p.tipo === 'comida'} onClick={() => ponTipo('comida')}>Comida</Chip>
        <Chip on={p.tipo === 'picoteo'} onClick={() => ponTipo('picoteo')}>Picoteo</Chip>
        <Chip on={p.tipo === 'bebida'} onClick={() => ponTipo('bebida')}>Bebida</Chip>
      </div>

      {p.tipo !== 'bebida' ? (
        <>
          <p className="lbl fl mt16">{p.tipo === 'picoteo' ? '¿Cuánto suele ser?' : '¿Cuánto sueles comer?'}</p>
          <div className="chips eq">
            {TAMANOS_NOTA.map(t => (
              <Chip key={t.v} className="big ux-com-tam" on={tam === t.v} onClick={() => ponTamano(t.v)}>
                <span>{t.t}<small className="mono">~{valores(t.v, p.tipo, p.franja).kcal} kcal</small></span>
              </Chip>
            ))}
          </div>
          <details className="ux-com-afinar mt8">
            <summary>
              <span>Afinar: <span className="mono">{p.kcal} kcal · {p.proteina} g proteína</span></span>
              <Ico n="caret-down" />
            </summary>
            <div className="grid2 mt8">
              <Stepper className="sm" valor={p.kcal} onCambio={v => afinar({ kcal: v })} paso={10} min={0} sufijo="kcal" etiqueta="kcal" />
              <Stepper className="sm" valor={p.proteina} onCambio={v => afinar({ proteina: v })} paso={1} min={0} sufijo="g prot." etiqueta="Proteína" />
            </div>
            <p className="small muted mt4">Si lo sabes, mira la etiqueta. Si no, deja lo que viene.</p>
          </details>
          <p className="small muted mt4">Aproximado vale.</p>
        </>
      ) : (
        <>
          <p className="lbl fl mt16">Lo que trae</p>
          <div className="grid2">
            <Stepper className="sm" valor={p.kcal} onCambio={v => afinar({ kcal: v })} paso={10} min={0} sufijo="kcal" etiqueta="kcal" />
            <Stepper className="sm" valor={p.proteina} onCambio={v => afinar({ proteina: v })} paso={1} min={0} sufijo="g prot." etiqueta="Proteína" />
          </div>
          <p className="small muted mt4">Aproximado vale. Si no lo sabes, mira la etiqueta o deja lo que viene.</p>
          <p className="lbl fl mt16">Cafeína</p>
          <Stepper className="sm" valor={p.cafeina ?? 0} onCambio={v => cambia({ cafeina: v })} paso={10} min={0} sufijo="mg" etiqueta="Cafeína" />
          <p className="small muted mt4">Una lata de energética suele llevar 160 mg; un café, unos 80 mg.</p>
        </>
      )}

      {p.tipo === 'comida' && (
        <details className="fold mt16">
          <summary>Más opciones (opcional)<Ico n="caret-down" /></summary>
          <div className="in">
            <p className="lbl fl">Cuándo la sueles tomar (opcional)</p>
            <div className="chips eq">
              {FRANJAS.map(f => <Chip key={f.v} on={p.franja === f.v} onClick={() => ponFranja(p.franja === f.v ? undefined : f.v)}>{NOMBRE_FRANJA[f.v]}</Chip>)}
            </div>
            <p className="small muted mt4">Al apuntarla podrás elegir «Poco», «Normal» o «Mucho» según lo que comas ese día.</p>
          </div>
        </details>
      )}

      {apuntarEn ? (
        <>
          <button className="btn mt20" onClick={() => void guardarYApuntar()}><Ico n="check" b />Guardar y apuntar</button>
          <button className="btn ln sm mt8" onClick={() => void guardar()}>Solo guardar</button>
        </>
      ) : (
        <div className="btns mt20">
          {p.id != null && <button className="btn bad sm" onClick={() => void borrar()}>Borrar</button>}
          <button className="btn sm" onClick={() => void guardar()}>Guardar</button>
        </div>
      )}
    </Hoja>
  )
}
