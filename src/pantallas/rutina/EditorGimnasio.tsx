// RUT-08 · Editor de gimnasio
import { useEffect, useState } from 'react'
import { leerGimnasio } from '../../datos/consultas'
import { guardarGimnasio } from '../../datos/acciones/rutina'
import type { Gimnasio } from '../../datos/tipos'
import { Cab, Ico, Pantalla, useUnaVez, Vacio, LARGO } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useGimnasios } from '../../datos/hooks'
import { CatalogoMaterial, ejerciciosDisponibles, PesosGimnasio } from './CatalogoMaterial'
import { t, tn } from '../../i18n'
import { tr } from '../../i18n/jsx'

export function EditorGimnasio({ ruta }: { ruta: Ruta<'rut-gym-edit'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const lista = useGimnasios()
  const id = Number(ruta.d.id ?? lista[0]?.id)
  // undefined = cargando · null = no existe (o no hay ningún gimnasio todavía).
  const [g, setG] = useState<Gimnasio | null | undefined>(undefined)
  useEffect(() => {
    // Sin id válido (p. ej. sin gimnasios) Dexie rechaza la consulta y la pantalla se quedaría en blanco.
    if (!Number.isFinite(id)) return
    void leerGimnasio(id).then(x => setG(x ?? null), () => setG(null))
  }, [id])
  // Las máquinas propias se guardan desde su hoja, que también marca el material al que se parecen:
  // se recargan al volver, o «Guardar» aquí lo perdería.
  const propias = lista.find(x => x.id === id)?.propias
  useEffect(() => {
    if (!propias) return
    const parecidas = propias.map(p => p.parecida).filter((m): m is string => !!m)
    setG(x => (x ? { ...x, propias, material: [...new Set([...x.material, ...parecidas])] } : x))
  }, [propias])
  const unaVez = useUnaVez()
  if (g === undefined && (Number.isFinite(id) || lista.length)) return <Pantalla><Cab atras crumb={t('Gimnasios')} titulo={t('Editor de gimnasio')} /></Pantalla>
  if (!g) return (
    <Pantalla>
      <Cab atras crumb={t('Gimnasios')} titulo={t('Editor de gimnasio')} />
      <div className="pg"><Vacio icono="map-pin" titulo={t('Este gimnasio no existe')} texto={t('Crea uno en Gimnasios.')} accion={t('Ir a Gimnasios')} onAccion={() => nav.reemplazar('rut-gym')} /></div>
    </Pantalla>
  )
  const cambia = (c: Partial<Gimnasio>) => setG(x => (x ? { ...x, ...c } : x))
  // Un doble toque no hace dos «atrás».
  const guardar = unaVez(async () => {
    await guardarGimnasio(g)
    aviso(t('Gimnasio guardado'))
    nav.atras()
  })
  const borrar = () => nav.hoja('sheet-confirmar', { titulo: t('¿Borrar «{nombre}»?', { nombre: g.nombre }), texto: t('Se borra el gimnasio y su material. Tus entrenos no se tocan.'), si: t('Borrar'), peligro: true, accion: 'borrar-gimnasio', id: g.id })
  return (
    <Pantalla>
      <Cab atras crumb={t('Gimnasios')} titulo={t('Editor de gimnasio')} />
      <div className="pg">
        <span className="lbl fl">{t('Nombre')}</span>
        <input className="inp" maxLength={LARGO.nombre} value={g.nombre} onChange={e => cambia({ nombre: e.target.value })} aria-label={t('Nombre del gimnasio')} />
        <span className="lbl fl mt12">{t('Notas')}</span>
        <textarea className="inp" maxLength={LARGO.nota} value={g.notas} onChange={e => cambia({ notas: e.target.value })} placeholder={t('A qué hora hay poca gente, qué suele estar ocupado…')} aria-label={t('Notas')} />
        <div className="sec">
          <div className="sec-h"><h2>{t('Máquinas y material')}</h2><span className="lbl">{tn(g.material.length, '{n} marcada', '{n} marcadas')}</span></div>
          <CatalogoMaterial material={g.material} onCambio={m => cambia({ material: m })} />
        </div>
        {g.propias.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>{t('Máquinas propias')}</h2></div>
            <div className="list">
              {g.propias.map(p => (
                <button key={p.id} className="it" onClick={() => nav.hoja('sheet-maq', { gym: g.id, id: p.id })}>
                  <span className="ico"><Ico n="armchair" /></span>
                  <span className="tx"><b>{p.nombre}</b>{p.notas && <small>{p.notas}</small>}</span>
                  <Ico n="caret-right" className="car" />
                </button>
              ))}
            </div>
          </div>
        )}
        <PesosGimnasio g={g} onCambio={cambia} />
        <button className="btn ln sm mt20" onClick={async () => { await guardarGimnasio(g); nav.hoja('sheet-maq', { gym: g.id }) }}><Ico n="plus" b />{t('Añadir una máquina que no sale')}</button>
        {lista.length > 1 && <button className="btn bad sm mt8" onClick={borrar}><Ico n="trash" />{t('Borrar gimnasio')}</button>}
        <div className="dock">
          <div className="result card">
            <p><Ico n="check-circle" b className="okc" />{tr('Con este gimnasio tienes {n} ejercicios disponibles', { n: <b className="mono">{ejerciciosDisponibles(g.material)}</b> })}</p>
            <button className="btn sm" onClick={() => void guardar()}>{t('Guardar')}</button>
          </div>
        </div>
      </div>
    </Pantalla>
  )
}
