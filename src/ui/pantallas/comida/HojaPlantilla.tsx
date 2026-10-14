// COM-06 · Guardar en «Mis comidas» (antes «plantilla»): lo mínimo es nombre, foto opcional, kcal y proteína.
// Los tamaños y el momento habitual quedan plegados en «Más opciones».
import { useEffect, useState } from 'react'
import { db } from '../../../datos/db'
import type { Plantilla } from '../../../datos/tipos'
import { FACTOR_RACION, FRANJAS, NOMBRE_FRANJA, NOMBRE_RACION, aspecto } from '../../../dominio/comida'
import { hacerFoto } from '../../../plataforma'
import { Chip, cx, Hoja, Ico, Stepper, useUnaVez } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { useUrlBlob } from './comun'

const nueva = (): Plantilla => ({ nombre: '', kcal: 500, proteina: 25, tipo: 'comida', usos: 0 })

export function HojaPlantilla({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const id = typeof ruta.d?.id === 'number' ? ruta.d.id : undefined
  const [p, setP] = useState<Plantilla | null>(id == null ? nueva() : null)
  const fotoUrl = useUrlBlob(p?.foto)
  // Una plantilla nueva no tiene id: con un doble toque en «Guardar» se creaban dos.
  const unaVez = useUnaVez()
  useEffect(() => { if (id != null) void db.plantillas.get(id).then(x => setP(x ?? nueva())) }, [id])
  if (!p) return <Hoja titulo="Mis comidas"><p className="muted">Cargando…</p></Hoja>
  const cambia = (c: Partial<Plantilla>) => setP({ ...p, ...c })
  const a = aspecto(p.nombre || 'comida', p.tipo)

  const guardar = unaVez(async () => {
    if (!p.nombre.trim()) { aviso('Ponle un nombre'); return }
    const limpia: Plantilla = { ...p, nombre: p.nombre.trim(), cafeina: p.tipo === 'bebida' ? p.cafeina ?? 0 : p.cafeina || undefined }
    await db.plantillas.put(limpia)
    nav.hoja(null)
    aviso(id == null ? 'Guardado en Mis comidas' : 'Cambios guardados')
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
    <Hoja titulo={id == null ? 'Guardar en Mis comidas' : 'Editar'} sub={id == null ? 'Para apuntarla luego con un toque' : 'Mis comidas · se apunta con un toque'} className="tall">
      <div className="row">
        <button className={cx('fp xl', !fotoUrl && a.fp)} aria-label="Foto (opcional)" onClick={() => void foto()} style={fotoUrl ? { background: '#fff' } : undefined}>
          {fotoUrl ? <img src={fotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Ico n="camera" b />}
        </button>
        <div className="grow">
          <span className="lbl fl">Nombre</span>
          <input className="inp" value={p.nombre} onChange={e => cambia({ nombre: e.target.value })} placeholder="Arroz al curry (Mercadona)" aria-label="Nombre de la comida" />
          <small className="small muted">Foto opcional: toca la cámara.</small>
        </div>
      </div>

      <p className="lbl fl mt16">{p.tipo === 'comida' ? 'Lo que trae una ración normal' : 'Lo que trae'}</p>
      <div className="grid2">
        <Stepper className="sm" valor={p.kcal} onCambio={v => cambia({ kcal: v })} paso={10} min={0} sufijo="kcal" etiqueta="kcal" />
        <Stepper className="sm" valor={p.proteina} onCambio={v => cambia({ proteina: v })} paso={1} min={0} sufijo="g prot." etiqueta="Proteína" />
      </div>
      <p className="small muted mt4">Aproximado vale. Si no lo sabes, mira la etiqueta o deja lo que viene.</p>

      <p className="lbl fl mt16">Qué es</p>
      <div className="chips eq">
        <Chip on={p.tipo === 'comida'} onClick={() => cambia({ tipo: 'comida' })}>Comida</Chip>
        <Chip on={p.tipo === 'picoteo'} onClick={() => cambia({ tipo: 'picoteo' })}>Picoteo</Chip>
        <Chip on={p.tipo === 'bebida'} onClick={() => cambia({ tipo: 'bebida' })}>Bebida</Chip>
      </div>

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
            <p className="lbl fl">Tamaños · se calculan solos</p>
            <div className="strip">
              {(['P', 'N', 'G'] as const).map(r => (
                <p key={r} className={cx(r === 'N' && 'hl')}><span className="lbl">{NOMBRE_RACION[r]}</span><b>{Math.round(p.kcal * FACTOR_RACION[r])}</b></p>
              ))}
            </div>
            <p className="small muted mt4">kcal de cada tamaño al apuntarla.</p>
            <p className="lbl fl mt16">Cuándo la sueles tomar (opcional)</p>
            <div className="chips eq">
              {FRANJAS.map(f => <Chip key={f.v} on={p.franja === f.v} onClick={() => cambia({ franja: p.franja === f.v ? undefined : f.v })}>{NOMBRE_FRANJA[f.v]}</Chip>)}
            </div>
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
