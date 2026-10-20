// Hoja para elegir un ejercicio: cambiar, «si está ocupado» (alternativas B/C) o añadir (rutina o entreno en curso).
import { useMemo, useState } from 'react'
import { db } from '../../../datos/db'
import { buscar, catalogoCargado, ejercicio, nombreMaterial } from '../../../catalogo/catalogo'
import { tipoRegistro } from '../../../catalogo/clasificacion'
import type { Ejercicio } from '../../../catalogo/tipos'
import { alternativasDe, bloqueNuevo, patronGenerador } from '../../../dominio/generador'
import { desdeBloque, sustituir } from '../../../dominio/sesion'
import { sugerenciaPara } from '../../../datos/consultas'
import { Chip, cx, Hoja, Ico, Th, useUnaVez, LARGO } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { useGimnasio, useMarcas, usePerfil, useRutina, useSesionEnCurso } from '../../datos'
import { guardarRutina } from './EditarPlan'
import { musculosComunes, nombreEj } from './comun'

type Modo = 'cambiar' | 'alternativa' | 'anadir' | 'sesion-anadir' | 'sesion-cambiar'

export function HojaElegirEjercicio({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const g = useGimnasio()
  const marcas = useMarcas()
  const r = useRutina()
  const sesion = useSesionEnCurso()
  const modo = ruta.d?.modo as Modo
  const actual = ejercicio(ruta.d?.id as string | undefined)
  const [mismoPatron, setMismoPatron] = useState(!!actual)
  const [q, setQ] = useState('')
  const material = useMemo(() => new Set(g?.material ?? []), [g])
  const unaVez = useUnaVez()

  const lista = useMemo(() => {
    const c = catalogoCargado()
    if (!c) return []
    // Sin gimnasio no se filtra por material (si no, solo saldrían los de peso corporal).
    let l = c.ejercicios.filter(e => (!g || !e.material || material.has(e.material)) && e.categoria !== 'stretching')
    if (mismoPatron && actual) l = l.filter(e => patronGenerador(e) === patronGenerador(actual) && e.id !== actual.id)
    l = l.filter(e => !marcas.get(e.id)?.odiado && !marcas.get(e.id)?.duele)
    return buscar(q, l).sort((a, b) => Number(!!marcas.get(b.id)?.favorito) - Number(!!marcas.get(a.id)?.favorito) || a.nombre.localeCompare(b.nombre)).slice(0, 80)
  }, [q, mismoPatron, actual, material, marcas, g])

  const entrada = () => ({ perfil, gimnasio: g ?? null, marcas, ejercicios: catalogoCargado()?.ejercicios ?? [] })

  // Doble toque en un ejercicio: se añadía dos veces (al entreno o al plan).
  const elegir = unaVez(async (e: Ejercicio) => {
    if (modo === 'sesion-anadir' || modo === 'sesion-cambiar') {
      if (!sesion?.id) return
      const b = bloqueNuevo(e.id, entrada())
      const sug = await sugerenciaPara(e.id, b, g, sesion.id)
      if (modo === 'sesion-anadir') {
        const nueva = structuredClone(sesion)
        const ej = desdeBloque(b, { peso: sug.peso, reps: sug.reps })
        if (!nueva.ejercicios.some(x => x.estado === 'curso')) ej.estado = 'curso'
        nueva.ejercicios.push(ej)
        await db.sesiones.put(nueva)
      } else {
        const idx = Number(ruta.d?.idx ?? 0)
        await db.sesiones.put(sustituir(sesion, idx, e.id, 'cambio', { peso: sug.peso, reps: sug.reps }, tipoRegistro(e)))
      }
      nav.hoja(null)
      aviso(modo === 'sesion-anadir' ? `Añadido: ${nombreEj(e)}` : `Cambiado por ${nombreEj(e)}`)
      return
    }
    if (!r) return
    const nueva = structuredClone(r)
    const dia = nueva.dias.find(d => d.letra === ruta.d?.letra) ?? nueva.dias[0]!
    if (modo === 'anadir') {
      dia.bloques.push(bloqueNuevo(e.id, entrada()))
    } else {
      const b = dia.bloques.find(x => x.uid === ruta.d?.uid)
      if (!b) return
      if (modo === 'cambiar') {
        const nb = bloqueNuevo(e.id, entrada())
        Object.assign(b, { ejercicio: e.id, alternativas: alternativasDe(e.id, entrada()), registro: nb.registro })
      } else {
        b.alternativas = [e.id, ...b.alternativas.filter(a => a !== e.id)].slice(0, 2)
      }
    }
    await guardarRutina(nueva)
    nav.hoja(null)
    aviso(modo === 'anadir' ? `Añadido: ${nombreEj(e)}` : modo === 'cambiar' ? `Cambiado por ${nombreEj(e)}` : `Si está ocupado: ${nombreEj(e)}`)
  })

  const titulo = { cambiar: 'Cambiar ejercicio', alternativa: 'Si está ocupado', anadir: 'Añadir ejercicio', 'sesion-anadir': 'Añadir al entreno', 'sesion-cambiar': 'Cambiar ejercicio' }[modo]
  return (
    <Hoja titulo={titulo} sub={actual ? (modo === 'alternativa' ? `Qué hacer si ${nombreEj(actual)} está ocupado` : `En lugar de: ${nombreEj(actual)}`) : g ? 'Solo lo que hay en tu gimnasio' : 'Todo el catálogo (aún no tienes gimnasio)'} className="tall">
      <label className="search"><Ico n="magnifying-glass" /><input className="inp" type="search" maxLength={LARGO.buscar} placeholder="Buscar ejercicio o músculo" value={q} onChange={e => setQ(e.target.value)} /></label>
      {actual && (
        <div className="chips mt8">
          <Chip on={mismoPatron} onClick={() => setMismoPatron(true)}>Parecidos</Chip>
          <Chip on={!mismoPatron} onClick={() => setMismoPatron(false)}>Todos</Chip>
        </div>
      )}
      <div className="list mt12">
        {lista.map(e => (
          <button key={e.id} className="it" onClick={() => void elegir(e)}>
            <Th ej={e} size="s" />
            <span className="tx"><b>{nombreEj(e)}</b><small>{musculosComunes(e.principales, 2).join(' · ')} · {nombreMaterial(e.material)}</small></span>
            {marcas.get(e.id)?.favorito && <Ico n="star" className="goldc" />}
          </button>
        ))}
        {!lista.length && <p className={cx('pd', 'muted')}>{mismoPatron && actual ? 'No hay parecidos con ese nombre: prueba en «Todos».' : 'Nada con ese nombre en tu gimnasio.'}</p>}
      </div>
    </Hoja>
  )
}
