// Hoja para elegir un ejercicio: cambiar, «si está ocupado» (alternativas B/C) o añadir (rutina o entreno en curso).
import { useMemo, useState } from 'react'
import { guardarSesion } from '../../datos/acciones/entreno'
import { buscar, catalogoCargado, ejercicio, nombreMaterial } from '../../catalogo/catalogo'
import { tipoRegistro } from '../../catalogo/clasificacion'
import type { Ejercicio } from '../../catalogo/tipos'
import { alternativasDe, bloqueNuevo, patronGenerador } from '../../dominio/generador'
import { desdeBloque, sustituir } from '../../dominio/sesion'
import { sugerenciaPara } from '../../datos/consultas'
import { Chip, cx, Hoja, Ico, Th, useUnaVez, LARGO } from '../../ui/componentes'
import { useNav, type Ruta, type Rutas } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useGimnasio, useMarcas, usePerfil, useRutina, useSesionEnCurso } from '../../datos/hooks'
import { guardarRutina } from '../../datos/acciones/rutina'
import { musculosComunes } from './comun'
import { t, tk } from '../../i18n'

type Modo = Rutas['hoja-elegir-ejercicio']['modo']

const TITULO: Record<Modo, string> = { cambiar: tk('Cambiar ejercicio'), alternativa: tk('Si está ocupado'), anadir: tk('Añadir ejercicio'), 'sesion-anadir': tk('Añadir al entreno'), 'sesion-cambiar': tk('Cambiar ejercicio') }

export function HojaElegirEjercicio({ ruta }: { ruta: Ruta<'hoja-elegir-ejercicio'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const g = useGimnasio()
  const marcas = useMarcas()
  const r = useRutina()
  const sesion = useSesionEnCurso()
  const d = ruta.d
  const modo = d.modo
  const actual = ejercicio('id' in d ? d.id : undefined)
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

  // Un doble toque en un ejercicio no lo añade dos veces (al entreno o al plan).
  const elegir = unaVez(async (e: Ejercicio) => {
    if (d.modo === 'sesion-anadir' || d.modo === 'sesion-cambiar') {
      if (!sesion?.id) return
      const b = bloqueNuevo(e.id, entrada())
      const sug = await sugerenciaPara(e.id, b, g, sesion.id)
      if (d.modo === 'sesion-anadir') {
        const nueva = structuredClone(sesion)
        const ej = desdeBloque(b, { peso: sug.peso, reps: sug.reps })
        if (!nueva.ejercicios.some(x => x.estado === 'curso')) ej.estado = 'curso'
        nueva.ejercicios.push(ej)
        await guardarSesion(nueva)
      } else {
        await guardarSesion(sustituir(sesion, d.idx, e.id, 'cambio', { peso: sug.peso, reps: sug.reps }, tipoRegistro(e)))
      }
      nav.hoja(null)
      aviso(modo === 'sesion-anadir' ? t('Añadido: {nombre}', { nombre: e.nombre }) : t('Cambiado por {nombre}', { nombre: e.nombre }))
      return
    }
    if (!r) return
    const nueva = structuredClone(r)
    const dia = nueva.dias.find(x => x.letra === d.letra) ?? nueva.dias[0]!
    if (d.modo === 'anadir') {
      dia.bloques.push(bloqueNuevo(e.id, entrada()))
    } else {
      const b = dia.bloques.find(x => x.uid === d.uid)
      if (!b) return
      if (d.modo === 'cambiar') {
        const nb = bloqueNuevo(e.id, entrada())
        Object.assign(b, { ejercicio: e.id, alternativas: alternativasDe(e.id, entrada()), registro: nb.registro })
      } else {
        b.alternativas = [e.id, ...b.alternativas.filter(a => a !== e.id)].slice(0, 2)
      }
    }
    await guardarRutina(nueva)
    nav.hoja(null)
    aviso(modo === 'anadir' ? t('Añadido: {nombre}', { nombre: e.nombre }) : modo === 'cambiar' ? t('Cambiado por {nombre}', { nombre: e.nombre }) : t('Si está ocupado: {lista}', { lista: e.nombre }))
  })

  const titulo = t(TITULO[modo])
  return (
    <Hoja titulo={titulo} sub={actual ? (modo === 'alternativa' ? t('Qué hacer si {nombre} está ocupado', { nombre: actual.nombre }) : t('En lugar de: {nombre}', { nombre: actual.nombre })) : g ? t('Solo lo que hay en tu gimnasio') : t('Todo el catálogo (aún no tienes gimnasio)')} className="tall">
      <label className="search"><Ico n="magnifying-glass" /><input className="inp" type="search" maxLength={LARGO.buscar} placeholder={t('Buscar ejercicio o músculo')} value={q} onChange={e => setQ(e.target.value)} /></label>
      {actual && (
        <div className="chips mt8">
          <Chip on={mismoPatron} onClick={() => setMismoPatron(true)}>{t('Parecidos')}</Chip>
          <Chip on={!mismoPatron} onClick={() => setMismoPatron(false)}>{t('Todos')}</Chip>
        </div>
      )}
      <div className="list mt12">
        {lista.map(e => (
          <button key={e.id} className="it" onClick={() => void elegir(e)}>
            <Th ej={e} size="s" />
            <span className="tx"><b>{e.nombre}</b><small>{musculosComunes(e.principales, 2).join(' · ')} · {nombreMaterial(e.material)}</small></span>
            {marcas.get(e.id)?.favorito && <Ico n="star" className="goldc" />}
          </button>
        ))}
        {!lista.length && <p className={cx('pd', 'muted')}>{mismoPatron && actual ? t('No hay parecidos con ese nombre: prueba en «Todos».') : t('Nada con ese nombre en tu gimnasio.')}</p>}
      </div>
    </Hoja>
  )
}
