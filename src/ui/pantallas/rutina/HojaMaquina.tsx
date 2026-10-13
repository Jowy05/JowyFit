// RUT-09 · Máquina propia (para lo que no está en el catálogo)
import { useEffect, useState } from 'react'
import { db } from '../../../datos/db'
import type { MaquinaPropia } from '../../../datos/tipos'
import { catalogoCargado, nombreMaterial } from '../../../catalogo/catalogo'
import { hacerFoto } from '../../../plataforma'
import { Chip, Hoja, Ico } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'

const PARECIDAS = ['seated_row_machine', 'lat_pulldown_machine', 'chest_press_machine', 'leg_press', 'shoulder_press_machine', 'leg_curl', 'cable', 'smith_machine', 'hack_squat', 'hip_thrust_machine']

export function HojaMaquina({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const gymId = Number(ruta.d?.gym)
  const [m, setM] = useState<MaquinaPropia>({ id: String(ruta.d?.id ?? `m${Date.now().toString(36)}`), nombre: '', parecida: null, notas: '' })
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    void db.gimnasios.get(gymId).then(g => { const p = g?.propias.find(x => x.id === ruta.d?.id); if (p) setM(p) })
  }, [gymId, ruta.d?.id])
  useEffect(() => { if (!m.foto) return; const u = URL.createObjectURL(m.foto); setUrl(u); return () => URL.revokeObjectURL(u) }, [m.foto])
  const suma = m.parecida ? (catalogoCargado()?.ejercicios ?? []).filter(e => e.material === m.parecida).length : 0
  const guardar = async () => {
    if (!m.nombre.trim()) { aviso('Ponle un nombre'); return }
    const g = await db.gimnasios.get(gymId)
    if (!g) return
    const propias = [...g.propias.filter(x => x.id !== m.id), m]
    const material = m.parecida && !g.material.includes(m.parecida) ? [...g.material, m.parecida] : g.material
    await db.gimnasios.put({ ...g, propias, material })
    nav.hoja(null)
    aviso('Máquina propia guardada')
  }
  return (
    <Hoja titulo="Máquina propia" sub="Para lo que no está en el catálogo" className="tall">
      <button className="photo-ph" onClick={async () => { const f = await hacerFoto(900); if (f) setM(x => ({ ...x, foto: f })) }} style={url ? { padding: 0, overflow: 'hidden' } : undefined}>
        {url ? <img src={url} alt="" className="photo-real" /> : <><Ico n="camera" /><span>Hacer foto</span></>}
      </button>
      <span className="lbl fl mt16">Nombre</span>
      <input className="inp" value={m.nombre} onChange={e => setM(x => ({ ...x, nombre: e.target.value }))} placeholder="Remo T con apoyo" aria-label="Nombre de la máquina" />
      <span className="lbl fl mt16">¿A qué se parece?</span>
      <p className="small muted">Así sabemos qué ejercicios permite.</p>
      <div className="chips mt8">
        {PARECIDAS.map(k => <Chip key={k} on={m.parecida === k} onClick={() => setM(x => ({ ...x, parecida: k }))}>{nombreMaterial(k).replace(/^Máquina (de )?/, '')}</Chip>)}
        <Chip on={m.parecida === null} onClick={() => setM(x => ({ ...x, parecida: null }))}>Otra</Chip>
      </div>
      <span className="lbl fl mt16">Notas</span>
      <textarea className="inp" value={m.notas ?? ''} onChange={e => setM(x => ({ ...x, notas: e.target.value }))} placeholder="Dónde está, discos máximos…" aria-label="Notas de la máquina" />
      {suma > 0 && <div className="note mt12"><Ico n="info" /><span>Permite <b className="mono">{suma}</b> ejercicio{suma === 1 ? '' : 's'} del catálogo.</span></div>}
      <button className="btn mt16" onClick={guardar}>Guardar</button>
    </Hoja>
  )
}
