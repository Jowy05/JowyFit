// COM-06 · Crear/editar una comida de «Mis comidas» (antes «plantilla»). Se escribe lo que trae el plato entero
// (o la bolsa entera, si es picoteo) y debajo se ve cuánto es «Poco · Normal · Mucho» al apuntarla:
// plato → ⅓ · el plato · plato y medio; picoteo → ⅓ · la mitad · todo.
// Siempre se puede apuntar a la vez que se guarda, y borrar si ya existía.
import { useEffect, useState } from 'react'
import { db } from '../../../datos/db'
import type { Franja, Plantilla } from '../../../datos/tipos'
import { FRANJAS, NOMBRE_FRANJA, NOMBRE_RACION, PISTA_RACION, aspecto, conRacion, franjaPorHora, tipoRacion } from '../../../dominio/comida'
import { horaActual, hoyISO } from '../../../dominio/fechas'
import { hacerFoto } from '../../../plataforma'
import { Chip, cx, Hoja, Ico, Stepper, useUnaVez } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { LineaMacros, apuntarPlantilla, useUrlBlob } from './comun'

/** Lo que trae por defecto cada tipo, para quien no sabe los números: un plato normal, una bolsa de picoteo, una lata. */
const POR_DEFECTO = { comida: { kcal: 600, proteina: 25 }, picoteo: { kcal: 300, proteina: 4 }, bebida: { kcal: 100, proteina: 0 } } as const
const nueva = (): Plantilla => ({ nombre: '', ...POR_DEFECTO.comida, tipo: 'comida', usos: 0 })
/** Qué se escribe arriba de los números, según el tipo. */
const QUE_TRAE = { comida: 'Lo que trae el plato', picoteo: 'Lo que trae entero (la bolsa, el paquete…)', bebida: 'Lo que trae (la lata, el vaso…)' } as const

export function HojaPlantilla({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const id = typeof ruta.d?.id === 'number' ? ruta.d.id : undefined
  // Desde Añadir llegan el día y la franja; si no, se apunta hoy.
  const fechaRuta = typeof ruta.d?.fecha === 'string' ? ruta.d.fecha : null
  const franjaRuta = ruta.d?.franja as Franja | undefined
  const [p, setP] = useState<Plantilla | null>(id == null ? nueva() : null)
  // Si aún no se han tocado los números, al cambiar de tipo se ponen los de ese tipo.
  const [tocados, setTocados] = useState(id != null)
  const fotoUrl = useUrlBlob(p?.foto)
  // Una comida nueva no tiene id: con un doble toque en «Guardar» se creaban dos.
  const unaVez = useUnaVez()
  useEffect(() => {
    if (id != null) void db.plantillas.get(id).then(x => setP(x ?? nueva()))
  }, [id])
  if (!p) return <Hoja titulo="Mis comidas"><p className="muted">Cargando…</p></Hoja>
  const cambia = (c: Partial<Plantilla>) => setP({ ...p, ...c })
  const numeros = (c: Partial<Plantilla>) => { setTocados(true); cambia(c) }
  const a = aspecto(p.nombre || 'comida', p.tipo)
  const ponTipo = (tipo: Plantilla['tipo']) => cambia({ tipo, ...(tocados ? {} : POR_DEFECTO[tipo]) })
  const tr = tipoRacion(p.tipo)

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
    if (!x) return
    const nuevoId = await db.plantillas.put(x)
    const fecha = fechaRuta ?? hoyISO()
    // Como en Añadir: la comida va a la franja elegida (o la suya); el picoteo y la bebida de hoy, a la de la hora.
    const franja = fecha !== hoyISO() ? franjaRuta
      : x.tipo === 'comida' ? franjaRuta ?? x.franja ?? franjaPorHora(horaActual())
      : franjaPorHora(horaActual())
    const deshacer = await apuntarPlantilla({ ...x, id: nuevoId }, 'N', fecha, franja)
    nav.hoja(null)
    // Deshacer quita lo apuntado; la comida sigue en Mis comidas.
    aviso(`Apuntado: ${x.nombre}`, deshacer)
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
    <Hoja titulo={id == null ? 'Crear comida nueva' : 'Editar'} sub={id == null ? 'Queda en Mis comidas para apuntarla con un toque' : 'Mis comidas · se apunta con un toque'} className="tall">
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

      <p className="lbl fl mt16">{QUE_TRAE[p.tipo]}</p>
      <div className="grid2">
        <Stepper className="sm" valor={p.kcal} onCambio={v => numeros({ kcal: v })} paso={10} min={0} sufijo="kcal" etiqueta="kcal" />
        <Stepper className="sm" valor={p.proteina} onCambio={v => numeros({ proteina: v })} paso={1} min={0} sufijo="g prot." etiqueta="Proteína" />
      </div>
      {p.tipo === 'bebida' && (
        <div className="mt8"><Stepper className="sm" valor={p.cafeina ?? 0} onCambio={v => cambia({ cafeina: v })} paso={10} min={0} sufijo="mg cafeína" etiqueta="Cafeína" /></div>
      )}
      <LineaMacros m={p} className="mt4" />
      <p className="small muted mt4">
        Toca un número para escribirlo. {p.tipo === 'comida' ? 'Si no lo sabes, deja lo que viene: es un plato normal.' : p.tipo === 'bebida' ? 'Una lata de energética lleva unos 160 mg de cafeína; un café, unos 80 mg.' : 'Mira la etiqueta del paquete, o deja lo que viene.'}
      </p>

      {/* Cómo queda al apuntarla: los mismos tres botones que verás en Añadir, con estos números. */}
      <p className="lbl fl mt16">Al apuntarla</p>
      <div className="ux-com-prev" aria-label="Cuánto es cada ración">
        {(['P', 'N', 'G'] as const).map(r => (
          <span key={r}><b>{NOMBRE_RACION[r]}</b><span className="mono">{conRacion(p, r, p.tipo).kcal} kcal</span><small>{PISTA_RACION[tr][r]}</small></span>
        ))}
      </div>

      {p.tipo === 'comida' && (
        <details className="fold mt16">
          <summary>Más opciones (opcional)<Ico n="caret-down" /></summary>
          <div className="in">
            <p className="lbl fl">Cuándo la sueles tomar (opcional)</p>
            <div className="chips eq">
              {FRANJAS.map(f => <Chip key={f.v} on={p.franja === f.v} onClick={() => cambia({ franja: p.franja === f.v ? undefined : f.v })}>{NOMBRE_FRANJA[f.v]}</Chip>)}
            </div>
          </div>
        </details>
      )}

      {id == null ? (
        <>
          <button className="btn mt20" onClick={() => void guardarYApuntar()}><Ico n="check" b />Guardar y apuntar</button>
          <button className="btn ln sm mt8" onClick={() => void guardar()}>Solo guardar</button>
        </>
      ) : (
        <>
          <button className="btn mt20" onClick={() => void guardar()}><Ico n="check" b />Guardar cambios</button>
          <button className="btn ln sm mt8" onClick={() => void guardarYApuntar()}><Ico n="plus" b />Guardar y apuntar ahora</button>
          <button className="btn bad sm mt8" onClick={() => void borrar()}><Ico n="trash" /> Borrar de Mis comidas</button>
        </>
      )}
    </Hoja>
  )
}
