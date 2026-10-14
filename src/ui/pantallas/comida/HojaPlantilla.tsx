// COM-06 · Crear/editar una comida de «Mis comidas» (antes «plantilla»). Lo mínimo: nombre y cuánto es
// («Poco · Normal · Mucho», los mismos botones que al escribir lo que has comido); los números, en «Afinar».
import { useEffect, useState } from 'react'
import { db } from '../../../datos/db'
import type { Franja, Plantilla } from '../../../datos/tipos'
import { FRANJAS, NOMBRE_FRANJA, TAMANOS_NOTA, aspecto, notaPorTamano, tamanoDe, type TamanoNota } from '../../../dominio/comida'
import { hacerFoto } from '../../../plataforma'
import { Chip, cx, Hoja, Ico, Stepper, useUnaVez } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { useUrlBlob } from './comun'

/** Una comida nueva empieza en «Normal» para la comida del mediodía. */
const nueva = (): Plantilla => ({ nombre: '', ...notaPorTamano('normal', 'comida'), tipo: 'comida', usos: 0 })
/** Lo habitual de un picoteo o una bebida (para no dejar las 600 kcal de una comida). */
const DE_TIPO = { picoteo: { kcal: 200, proteina: 3 }, bebida: { kcal: 100, proteina: 0 } } as const

export function HojaPlantilla({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const id = typeof ruta.d?.id === 'number' ? ruta.d.id : undefined
  const [p, setP] = useState<Plantilla | null>(id == null ? nueva() : null)
  // Tamaño elegido con los botones; null si los números se han afinado a mano.
  const [tam, setTam] = useState<TamanoNota | null>(id == null ? 'normal' : null)
  const fotoUrl = useUrlBlob(p?.foto)
  // Una comida nueva no tiene id: con un doble toque en «Guardar» se creaban dos.
  const unaVez = useUnaVez()
  useEffect(() => {
    if (id != null) void db.plantillas.get(id).then(x => {
      setP(x ?? nueva())
      setTam(x ? tamanoDe(x.kcal, x.proteina, x.franja ?? 'comida') : 'normal')
    })
  }, [id])
  if (!p) return <Hoja titulo="Mis comidas"><p className="muted">Cargando…</p></Hoja>
  const cambia = (c: Partial<Plantilla>) => setP({ ...p, ...c })
  const a = aspecto(p.nombre || 'comida', p.tipo)
  const valores = (t: TamanoNota, franja: Franja | undefined) => notaPorTamano(t, franja ?? 'comida')

  const ponTamano = (t: TamanoNota) => { setTam(t); cambia(valores(t, p.franja)) }
  const afinar = (c: Partial<Plantilla>) => { setTam(null); cambia(c) }
  const ponTipo = (tipo: Plantilla['tipo']) => {
    if (tipo === 'comida') cambia({ tipo, ...(tam ? valores(tam, p.franja) : {}) })
    // Sin tocar los números, un picoteo o una bebida nuevos empiezan con valores de picoteo o bebida.
    else cambia({ tipo, ...(p.id == null && tam ? DE_TIPO[tipo] : {}) })
  }
  const ponFranja = (franja: Franja | undefined) => cambia({ franja, ...(tam && p.tipo === 'comida' ? valores(tam, franja) : {}) })

  const guardar = unaVez(async () => {
    if (!p.nombre.trim()) { aviso('Ponle un nombre'); return }
    const limpia: Plantilla = { ...p, nombre: p.nombre.trim(), cafeina: p.tipo === 'bebida' ? p.cafeina ?? 0 : p.cafeina || undefined }
    await db.plantillas.put(limpia)
    nav.hoja(null)
    // Crear no es apuntar: el aviso lo dice para que nadie crea que ya está en el Día.
    aviso(id == null ? `Creada «${limpia.nombre}» (aún sin apuntar)` : 'Cambios guardados')
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
    <Hoja titulo={id == null ? 'Crear comida nueva' : 'Editar'} sub={id == null ? 'Para apuntarla luego con un toque' : 'Mis comidas · se apunta con un toque'} className="tall">
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

      {p.tipo === 'comida' ? (
        <>
          <p className="lbl fl mt16">¿Cuánto sueles comer?</p>
          <div className="chips eq">
            {TAMANOS_NOTA.map(t => (
              <Chip key={t.v} className="big ux-com-tam" on={tam === t.v} onClick={() => ponTamano(t.v)}>
                <span>{t.t}<small className="mono">~{valores(t.v, p.franja).kcal} kcal</small></span>
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
        </>
      )}

      {p.tipo === 'bebida' && (
        <>
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

      <div className="btns mt20">
        {p.id != null && <button className="btn bad sm" onClick={() => void borrar()}>Borrar</button>}
        <button className="btn sm" onClick={() => void guardar()}>Guardar</button>
      </div>
    </Hoja>
  )
}
