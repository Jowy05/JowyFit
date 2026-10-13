// SES-10 · Fin del entreno
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { historialDe } from '../../../datos/consultas'
import { ejercicio, nombreMaterial } from '../../../catalogo/catalogo'
import { resumen, terminada } from '../../../dominio/sesion'
import { DIAS, deISO, diaSemana, duracion, fechaLarga, formatoHora, horaDe, hoyISO, sumarDias } from '../../../dominio/fechas'
import { estadoSemana } from '../../../dominio/semana'
import { kg } from '../../../dominio/calculos'
import { cancelar } from '../../../plataforma'
import { Cab, Chip, Ico, Pantalla, Th } from '../../comp'
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
  const [minutos, setMinutos] = useState<'igual' | 'mas' | 'menos'>('igual')
  const [descansos, setDescansos] = useState<'cortos' | 'bien' | 'largos'>('bien')
  const [molestia, setMolestia] = useState('')
  const [hayMolestia, setHayMolestia] = useState(false)
  const [ocupado, setOcupado] = useState<string[]>([])
  const [nota, setNota] = useState('')
  const subidas = useLiveQuery(async () => {
    if (!s) return []
    const out: { id: string; antes: number; ahora: number }[] = []
    for (const e of s.ejercicios) {
      const hoy = Math.max(0, ...e.series.filter(x => x.hecha && !x.calentamiento && x.peso != null).map(x => x.peso!))
      if (!hoy) continue
      const prev = (await historialDe(e.ejercicio, s.id))[0]
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
  const materiales = [...new Set(s.ejercicios.map(e => ejercicio(e.planificado)?.material).filter((m): m is string => !!m))].slice(0, 6)

  const guardar = async () => {
    const mins = Math.round(res.segundos / 60)
    await db.sesiones.put({
      ...s, estado: 'hecha', fin, descansoHasta: undefined,
      respuestas: { minutosReales: minutos === 'igual' ? mins : minutos === 'mas' ? mins + 10 : Math.max(5, mins - 10), descansos, molestia: hayMolestia ? molestia || 'sí' : undefined, ocupado: ocupado.join(', ') || undefined, nota: nota || undefined },
    })
    void cancelar([9001])
    nav.completa(null)
    if (calibCompleta) { nav.ir('rut-gen', { definitiva: true }, 'rut'); aviso('Semana de calibración completada') }
    else { nav.raiz('ini'); aviso(`Guardado. ${cap(DIAS[(new Date().getDay() + 6) % 7]!)} ✓`) }
  }

  return (
    <Pantalla full>
      <Cab className="fin-hd" crumb={<span className="tag ok"><Ico n="flag-checkered" b />Entreno terminado</span>} titulo={s.nombre} sub={`${cap(fechaLarga(s.fecha))}${g ? ` · ${g.nombre}` : ''}`}
        derecha={!terminada(s) ? <button className="ib" aria-label="Volver al entreno" onClick={() => nav.completa('entreno')}><Ico n="x" /></button> : undefined} />
      <div className="pg">
        <div className="spec-box"><div className="spec c2">
          <p><span>Duración</span><b>{duracion(res.segundos)}</b></p>
          <p><span>Horario</span><b>{horaDe(s.inicio)} → {horaDe(fin)}</b></p>
          <p><span>Ejercicios</span><b>{res.ejercicios}</b></p>
          <p><span>Hechos</span><b className="okc">{res.hechos}</b></p>
          <p><span>Sustituidos</span><b>{res.sustituidos}</b></p>
          <p><span>Saltados</span><b>{res.saltados}</b></p>
          <p><span>Series</span><b>{res.series}</b></p>
          <p><span>Volumen</span><b>{res.volumen.toLocaleString('es-ES')} kg</b></p>
        </div></div>

        {logros.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>Logros</h2><span className="lbl">{logros.length} desbloqueado{logros.length === 1 ? '' : 's'}</span></div>
            <div className="achs">
              {logros.map(({ e, x }, i) => (
                <div key={i} className="ach">
                  <span className="tro"><Ico n={i === 0 ? 'trophy' : 'medal'} b /></span>
                  <span className="tx"><small className="au">Desbloqueado{x.ts ? ` · ${horaDe(x.ts)}` : ''}</small><b>Récord en {ejercicio(e.ejercicio)?.nombre.toLowerCase()}</b><small className="mono">{kg(x.peso)} kg × {x.reps}</small></span>
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
                  <span className="tx"><b>{ejercicio(u.id)?.nombre}</b><small className="mono">{kg(u.antes)} → {kg(u.ahora)} kg</small></span>
                  <span className="end up">+{kg(u.ahora - u.antes)} kg</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {calibCompleta && <p className="note ok mt16"><Ico n="gauge" /><span><b>Semana de calibración completada.</b> Al guardar verás tu rutina definitiva, ajustada a tus tiempos reales.</span></p>}

        {prox?.dia && (
          <div className="sec">
            <div className="card pd row">
              <span className="ico"><Ico n="calendar-blank" /></span>
              <span className="tx"><span className="lbl">Próxima sesión</span><b>{cap(DIAS[diaSemana(deISO(prox.fecha))]!)} · {formatoHora(perfil.horaEntreno)} · {prox.dia.nombre}</b><small>~{Math.round(duracionDia(prox.dia.bloques) / 60)} min</small></span>
            </div>
          </div>
        )}

        <div className="sec">
          <div className="sec-h"><h2>Preguntas rápidas</h2><span className="lbl">10 s</span></div>
          <div className="qq">
            <p className="lbl">¿Cuánto has tardado de verdad?</p>
            <div className="chips">
              <Chip on={minutos === 'igual'} onClick={() => setMinutos('igual')}>{Math.round(res.segundos / 60)} min</Chip>
              <Chip on={minutos === 'mas'} onClick={() => setMinutos('mas')}>Algo más</Chip>
              <Chip on={minutos === 'menos'} onClick={() => setMinutos('menos')}>Algo menos</Chip>
            </div>
            <p className="lbl">Descansos</p>
            <div className="chips">
              {(['cortos', 'bien', 'largos'] as const).map(d => <Chip key={d} on={descansos === d} onClick={() => setDescansos(d)}>{cap(d)}</Chip>)}
            </div>
            <p className="lbl">¿Alguna molestia?</p>
            <div className="chips">
              <Chip on={!hayMolestia} onClick={() => setHayMolestia(false)}>Ninguna</Chip>
              <Chip on={hayMolestia} onClick={() => setHayMolestia(true)}>Sí, te digo dónde</Chip>
            </div>
            {hayMolestia && <input className="inp" value={molestia} onChange={e => setMolestia(e.target.value)} placeholder="Hombro derecho en el press…" />}
            <p className="lbl">¿Qué estaba ocupado?</p>
            <div className="chips">
              <Chip on={!ocupado.length} onClick={() => setOcupado([])}>Nada</Chip>
              {materiales.map(m => <Chip key={m} ck on={ocupado.includes(nombreMaterial(m))} onClick={() => setOcupado(o => (o.includes(nombreMaterial(m)) ? o.filter(x => x !== nombreMaterial(m)) : [...o, nombreMaterial(m)]))}>{nombreMaterial(m)}</Chip>)}
            </div>
            <p className="lbl">Nota</p>
            <textarea className="inp" value={nota} onChange={e => setNota(e.target.value)} placeholder="Algo que quieras recordar" aria-label="Nota del entreno" />
          </div>
        </div>
        <div className="dock"><button className="btn xl" onClick={() => void guardar()}>Guardar</button></div>
      </div>
    </Pantalla>
  )
}
