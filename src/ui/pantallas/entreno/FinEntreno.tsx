// SES-10 · Fin del entreno
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { historialEn, sesionesHechas } from '../../../datos/consultas'
import { ejercicio, nombreEjercicio } from '../../../catalogo/catalogo'
import { resumen, terminada } from '../../../dominio/sesion'
import { DIAS, deISO, diaSemana, duracion, fechaLarga, formatoHora, horaDe, hoyISO, sumarDias } from '../../../dominio/fechas'
import { estadoSemana } from '../../../dominio/semana'
import { kg } from '../../../dominio/calculos'
import { cancelar } from '../../../plataforma'
import { Cab, Chip, Ico, Pantalla, Th, useUnaVez } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { useAjustes, useGimnasio, usePerfil, useRutina } from '../../datos'
import { duracionDia } from '../../../dominio/generador'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function FinEntreno({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const g = useGimnasio()
  const perfil = usePerfil()
  const ajustes = useAjustes()
  const r = useRutina()
  const s = useLiveQuery(() => db.sesiones.get(Number(ruta.d?.id)), [ruta.d?.id])
  const [fin] = useState(Date.now())
  const [molestia, setMolestia] = useState('')
  const [hayMolestia, setHayMolestia] = useState(false)
  const [nota, setNota] = useState('')
  const unaVez = useUnaVez()
  const subidas = useLiveQuery(async () => {
    if (!s) return []
    const out: { id: string; antes: number; ahora: number }[] = []
    const todas = await sesionesHechas() // una sola lectura para todos los ejercicios
    for (const e of s.ejercicios) {
      const hoy = Math.max(0, ...e.series.filter(x => x.hecha && !x.calentamiento && x.peso != null).map(x => x.peso!))
      if (!hoy) continue
      const prev = historialEn(todas, e.ejercicio, s.id)[0]
      const antes = prev ? Math.max(0, ...prev.series.filter(x => !x.calentamiento && x.peso != null).map(x => x.peso!)) : 0
      if (antes && hoy > antes) out.push({ id: e.ejercicio, antes, ahora: hoy })
    }
    return out
  }, [s?.id]) ?? []
  const calibCompleta = useLiveQuery(async () => {
    if (!r?.calibracion || !s) return false
    const hechas = (await db.sesiones.where('estado').equals('hecha').toArray()).filter(x => x.rutinaId === r.id && x.letra !== 'L').length + (s.letra !== 'L' ? 1 : 0)
    return hechas >= r.dias.filter(d => !d.opcional).length
  }, [r?.id, s?.id])

  if (!s) return <Pantalla full><div className="cargando">…</div></Pantalla>
  const res = resumen({ ...s, fin })
  const logros = s.ejercicios.flatMap(e => e.series.filter(x => x.record).map(x => ({ e, x })))
  const hoy = hoyISO()
  const sem = r ? [...estadoSemana(r, [], hoy, ajustes.recolocadas), ...estadoSemana(r, [], sumarDias(hoy, 7), ajustes.recolocadas)] : []
  const prox = sem.find(d => d.fecha > hoy && d.estado === 'plan')

  // Un doble toque en «Guardar» abría dos veces la rutina definitiva (o volvía dos veces a Inicio).
  const guardar = unaVez(async () => {
    const mins = Math.round(res.segundos / 60)
    await db.sesiones.put({
      ...s, estado: 'hecha', fin, descansoHasta: undefined,
      // El tiempo, los descansos y lo que estaba ocupado ya los mide la app: solo se pregunta lo que no sabe.
      respuestas: { minutosReales: mins, molestia: hayMolestia ? molestia || 'sí' : undefined, nota: nota || undefined },
    })
    void cancelar([9001])
    nav.completa(null)
    if (calibCompleta) { nav.ir('rut-gen', { definitiva: true }, 'rut'); aviso('Semana de prueba terminada') }
    else { nav.raiz('ini'); aviso(`Guardado. ${cap(DIAS[(new Date().getDay() + 6) % 7]!)} ✓`) }
  })

  return (
    <Pantalla full>
      <Cab className="fin-hd" crumb={<span className="tag ok"><Ico n="flag-checkered" b />Entreno terminado</span>} titulo={s.nombre} sub={`${cap(fechaLarga(s.fecha))}${g ? ` · ${g.nombre}` : ''}`}
        derecha={!terminada(s) ? <button className="ib" aria-label="Volver al entreno" onClick={() => nav.completa('entreno')}><Ico n="x" /></button> : undefined} />
      <div className="pg">
        <div className="spec-box"><div className="spec c2">
          {/* Solo lo que importa; sustituidos y saltados, solo si los hay (el horario y el volumen están en Progreso). */}
          <p><span>Duración</span><b>{duracion(res.segundos)}</b></p>
          <p><span>Ejercicios hechos</span><b className="okc">{res.hechos < res.ejercicios ? `${res.hechos} de ${res.ejercicios}` : res.hechos}</b></p>
          <p><span>Series</span><b>{res.series}</b></p>
          {res.sustituidos > 0 && <p><span>Cambiados por otro</span><b>{res.sustituidos}</b></p>}
          {res.saltados > 0 && <p><span>Saltados</span><b>{res.saltados}</b></p>}
        </div></div>

        {logros.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>Logros</h2><span className="lbl">{logros.length} desbloqueado{logros.length === 1 ? '' : 's'}</span></div>
            <div className="achs">
              {logros.map(({ e, x }, i) => (
                <div key={i} className="ach">
                  <span className="tro"><Ico n={i === 0 ? 'trophy' : 'medal'} b /></span>
                  <span className="tx"><small className="au">Desbloqueado{x.ts ? ` · ${horaDe(x.ts)}` : ''}</small><b>Récord en {nombreEjercicio(e.ejercicio).toLowerCase()}</b><small className="mono">{kg(x.peso)} kg × {x.reps}</small></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {subidas.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>Subidas de peso</h2></div>
            <div className="list">
              {subidas.map(u => (
                <div key={u.id} className="it">
                  <Th ej={ejercicio(u.id)} size="s" />
                  <span className="tx"><b>{nombreEjercicio(u.id)}</b><small className="mono">{kg(u.antes)} → {kg(u.ahora)} kg</small></span>
                  <span className="end up">+{kg(u.ahora - u.antes)} kg</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {calibCompleta && <p className="note ok mt16"><Ico n="gauge" /><span><b>Semana de prueba terminada.</b> Al guardar verás tu rutina definitiva, ajustada a lo que tardas de verdad.</span></p>}

        {prox?.dia && (
          <div className="sec">
            <div className="card pd row">
              <span className="ico"><Ico n="calendar-blank" /></span>
              <span className="tx"><span className="lbl">Próxima sesión</span><b>{cap(DIAS[diaSemana(deISO(prox.fecha))]!)} · {formatoHora(perfil.horaEntreno)} · {prox.dia.nombre}</b><small>~{Math.round(duracionDia(prox.dia.bloques) / 60)} min</small></span>
            </div>
          </div>
        )}

        <div className="sec">
          <div className="sec-h"><h2>Antes de guardar</h2><span className="lbl">opcional</span></div>
          <div className="qq">
            <p className="lbl">¿Alguna molestia?</p>
            <div className="chips">
              <Chip on={!hayMolestia} onClick={() => setHayMolestia(false)}>Ninguna</Chip>
              <Chip on={hayMolestia} onClick={() => setHayMolestia(true)}>Sí, te digo dónde</Chip>
            </div>
            {hayMolestia && <input className="inp" value={molestia} onChange={e => setMolestia(e.target.value)} placeholder="Hombro derecho en el press…" />}
            <p className="lbl">Nota</p>
            <textarea className="inp" value={nota} onChange={e => setNota(e.target.value)} placeholder="Algo que quieras recordar" aria-label="Nota del entreno" />
          </div>
        </div>
        {/* Hasta saber si se completa la calibración no se guarda: si no, no se abriría la rutina definitiva. */}
        <div className="dock"><button className="btn xl" disabled={calibCompleta === undefined} onClick={() => void guardar()}>Guardar</button></div>
      </div>
    </Pantalla>
  )
}
