// RUT-06 · Ficha de ejercicio: todo lo de RepDB + tu progreso, tus ajustes y tus marcas.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../../datos/db'
import { marcar } from '../../../datos/repos'
import { historialDe, sugerenciaPara } from '../../../datos/consultas'
import { catalogoCargado, ejercicio, etiqueta, imagen, imagenMaterial, imagenMusculo, nombreMaterial, nombreMusculo, relacionados } from '../../../catalogo/catalogo'
import { ETIQUETAS_ES, NOMBRE_PATRON, patron, tipoRegistro } from '../../../catalogo/clasificacion'
import { epley, kg, num } from '../../../dominio/calculos'
import { duracion, fechaCorta, hoyISO } from '../../../dominio/fechas'
import { bloqueNuevo } from '../../../dominio/generador'
import { desdeBloque } from '../../../dominio/sesion'
import { mejorMarca, volumen } from '../../../dominio/progresion'
import { Cab, Chip, cx, Ico, Pantalla, Th } from '../../comp'
import { Barras, Linea } from '../../graficas'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { useGimnasio, useMarcas, usePerfil, useRutina, useSesionEnCurso } from '../../datos'
import { guardarRutina } from './EditarPlan'

const REGISTRO_TXT = { peso: 'kg + reps', mancuerna: 'kg por mancuerna + reps', asistido: 'asistencia + reps', corporal: 'reps', tiempo: 'segundos', cardio: 'minutos' }

export function Ficha({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const e = ejercicio(String(ruta.d?.id ?? ''))
  const marcas = useMarcas()
  const r = useRutina()
  const g = useGimnasio()
  const perfil = usePerfil()
  const sesion = useSesionEnCurso()
  const [pose, setPose] = useState(0)
  const [graf, setGraf] = useState<'peso' | 'rm' | 'vol'>('peso')
  const [editar, setEditar] = useState(false)
  const [alPlan, setAlPlan] = useState(false)
  const m = e ? marcas.get(e.id) : undefined
  const enPlan = r?.dias.flatMap(d => d.bloques.map(b => ({ d, b }))).find(x => x.b.ejercicio === e?.id)
  const hist = useLiveQuery(() => (e ? historialDe(e.id) : Promise.resolve([])), [e?.id]) ?? []
  const obj = enPlan?.b ?? { repsMin: 8, repsMax: 12, rpe: 8 }
  const sug = useLiveQuery(() => (e ? sugerenciaPara(e.id, obj, g) : Promise.resolve(undefined)), [e?.id, g, enPlan?.b.uid])

  useEffect(() => {
    if (!e || e.poses.length < 2) return
    const t = setInterval(() => setPose(p => (p + 1) % e.poses.length), 1800)
    return () => clearInterval(t)
  }, [e])

  if (!e) return <Pantalla><Cab atras titulo="Ejercicio" /><div className="pg"><p className="muted">No encontrado.</p></div></Pantalla>

  const todas = hist.flatMap(h => h.series)
  const record = mejorMarca(todas)
  const primero = hist.length ? mejorMarca(hist[hist.length - 1]!.series) : null
  const cron = [...hist].reverse()
  const puntos = cron.map(h => {
    const tr = h.series.filter(s => !s.calentamiento && s.peso != null)
    const mx = tr.length ? Math.max(...tr.map(s => s.peso!)) : 0
    const rm = Math.max(0, ...tr.map(s => epley(s.peso!, s.reps ?? 0)))
    return { x: fechaCorta(h.fecha).replace(' ', '/'), peso: mx, rm, vol: volumen(h.series) }
  })
  const reg = tipoRegistro(e)
  const alternativas = [...(enPlan?.b.alternativas ?? []).map(id => ({ id, t: '' })), ...relacionados(e, catalogoCargado()?.ejercicios ?? [], 8).map(x => ({ id: x.id, t: 'Otra' }))]
    .filter((x, i, a) => a.findIndex(y => y.id === x.id) === i).slice(0, 8)
  const peligro = (e.id === 'bench-press' || e.id === 'squat' || e.id.includes('barbell-bench') || e.id === 'incline-bench-press') && perfil.alFallo !== undefined

  const alEntreno = async () => {
    if (!sesion?.id) { aviso('Empieza un entreno y podrás añadirlo'); return }
    const b = bloqueNuevo(e.id, { perfil, ejercicios: catalogoCargado()?.ejercicios ?? [], gimnasio: g ?? null, marcas })
    const s = structuredClone(sesion)
    const ej = desdeBloque(b, { peso: sug?.peso ?? null, reps: sug?.reps ?? b.repsMin })
    if (!s.ejercicios.some(x => x.estado === 'curso')) ej.estado = 'curso'
    s.ejercicios.push(ej)
    await db.sesiones.put(s)
    aviso('Añadido al entreno de hoy')
  }
  const anadirAlDia = async (letra: string) => {
    if (!r) return
    const nueva = structuredClone(r)
    nueva.dias.find(d => d.letra === letra)!.bloques.push(bloqueNuevo(e.id, { perfil, ejercicios: catalogoCargado()?.ejercicios ?? [], gimnasio: g ?? null, marcas }))
    await guardarRutina(nueva)
    setAlPlan(false)
    aviso(`Añadido al plan: día ${letra}`)
  }

  return (
    <Pantalla>
      <div className="gal has-img">
        <button className="gal-back" onClick={nav.atras} aria-label="Atrás"><Ico n="caret-left" b /></button>
        <span className="gal-cnt tag">RepDB · {pose + 1} / {e.poses.length}</span>
        {e.poses.map((p, i) => (
          <figure key={p} className={cx('gal-it', i === pose && 'on')} onClick={() => setPose((pose + 1) % e.poses.length)}>
            <img src={imagen(e, p)} alt={p === 'start' ? 'Posición inicial' : p === 'peak' ? 'Posición final' : e.nombre} />
            <figcaption style={{ textShadow: '0 1px 3px rgba(0,0,0,.4)', color: '#16202B' }}>
              {e.poses.length > 1 && <span className="dots">{e.poses.map((_, k) => <i key={k} className={cx(k === i && 'on')} />)}</span>}
              {p === 'start' ? 'Posición inicial' : p === 'peak' ? 'Posición final' : ''}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="pg">
        <p className="lbl">{etiqueta('body_part', e.zona)} · {etiqueta('mechanic', e.mecanica).toLowerCase()} · {nombreMaterial(e.material).toLowerCase()}</p>
        <h1 className="ficha-t">{e.nombre}</h1>
        {e.descripcion && <p className="muted mt4">{e.descripcion}</p>}
        <div className="chips mt8">
          {e.principales.map(x => <span key={x} className="tag go">Principal · {nombreMusculo(x)}</span>)}
          {e.secundarios.slice(0, 4).map(x => <span key={x} className="tag">{nombreMusculo(x)}</span>)}
        </div>

        <div className="sec">
          <div className="sec-h"><h2>Músculos que trabaja</h2></div>
          <div className="chips">
            {[...e.principales.map(x => ({ x, p: true })), ...e.secundarios.map(x => ({ x, p: false }))].map(({ x, p }) => (
              <span key={x} className="pill-mus">
                {imagenMusculo(x) ? <img className="mus-img" src={imagenMusculo(x)} alt="" loading="lazy" /> : <span className="ico"><Ico n="person-simple" /></span>}
                <span><b>{nombreMusculo(x)}</b><small>{p ? 'Principal' : 'Secundario'}</small></span>
              </span>
            ))}
          </div>
        </div>

        <div className="sec">
          <div className="sec-h"><h2>Ficha técnica</h2></div>
          <div className="spec-box"><div className="spec c2">
            <p><span>Material</span><b>{nombreMaterial(e.material)}</b></p>
            <p><span>Dificultad</span><b>{etiqueta('difficulty', e.dificultad)}</b></p>
            <p><span>Tipo</span><b>{etiqueta('mechanic', e.mecanica)}</b></p>
            <p><span>Fuerza</span><b>{etiqueta('force_type', e.fuerza)}</b></p>
            <p><span>Categoría</span><b>{etiqueta('category', e.categoria)}</b></p>
            <p><span>Movimiento</span><b>{NOMBRE_PATRON[patron(e)]}</b></p>
            <p><span>Registro</span><b>{REGISTRO_TXT[reg]}</b></p>
            <p><span>Unilateral</span><b>{e.unilateral ? 'Sí' : 'No'}</b></p>
            {e.met != null && <p><span>MET</span><b>{num(e.met)}</b></p>}
            {e.objetivos.length > 0 && <p><span>Objetivos</span><b>{e.objetivos.map(o => etiqueta('goals', o)).join(', ')}</b></p>}
            {enPlan && <>
              <p><span>En tu plan</span><b>Día {enPlan.d.letra}</b></p>
              <p><span>Objetivo</span><b>{enPlan.b.series} × {enPlan.b.repsMin}-{enPlan.b.repsMax}</b></p>
              <p><span>Esfuerzo</span><b>{enPlan.b.rpe}</b></p>
              <p><span>Descanso</span><b>{duracion(enPlan.b.descanso)}</b></p>
            </>}
          </div></div>
          {e.material && imagenMaterial(e.material) && (
            <div className="it card mt8"><span className="mus-img" style={{ background: '#fff' }}><img src={imagenMaterial(e.material)} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} /></span><span className="tx"><b>{nombreMaterial(e.material)}</b><small>Material necesario</small></span></div>
          )}
          {e.etiquetas.length > 0 && <div className="chips mt8">{e.etiquetas.map(t => <span key={t} className="tag blue">{ETIQUETAS_ES[t] ?? t}</span>)}</div>}
        </div>

        <div className="sec">
          <div className="sec-h"><h2>Mi progreso</h2><span className="lbl">{hist.length} sesi{hist.length === 1 ? 'ón' : 'ones'}</span></div>
          {record ? (
            <div className="ach">
              <span className="tro"><Ico n="trophy" b /></span>
              <span className="tx"><small className="au">Récord</small><b className="mono">{kg(record.peso)} kg × {record.reps}</b><small>1RM estimado {num(record.e1rm, 0)} kg</small></span>
              {primero && record.peso > primero.peso && <span className="end">+{kg(record.peso - primero.peso)} kg<br />desde el inicio</span>}
            </div>
          ) : <p className="note plain"><Ico n="info" /><span>{reg === 'corporal' || reg === 'tiempo' ? 'Aquí verás tus mejores marcas cuando lo hagas.' : 'Aún no lo has hecho. La primera vez, elige un peso cómodo (esfuerzo 6-7).'}</span></p>}
          {puntos.length > 0 && (
            <div className="card pd mt8">
              <div className="chips eq">
                <Chip on={graf === 'peso'} onClick={() => setGraf('peso')}>Peso máx.</Chip>
                <Chip on={graf === 'rm'} onClick={() => setGraf('rm')}>1RM est.</Chip>
                <Chip on={graf === 'vol'} onClick={() => setGraf('vol')}>Volumen</Chip>
              </div>
              <div className="mt12">
                {graf === 'vol' ? <Barras puntos={puntos.map(p => ({ x: p.x, y: p.vol }))} /> : <Linea puntos={puntos.map(p => ({ x: p.x, y: graf === 'peso' ? p.peso : p.rm }))} />}
              </div>
              {sug && sug.peso != null && <p className="nextload"><Ico n="trend-up" b /><span>Próxima carga sugerida: <b className="mono">{kg(sug.peso)} kg × {sug.reps}</b> · {sug.texto.toLowerCase()}</span></p>}
            </div>
          )}
          {hist.length > 0 && (
            <div className="spec-box mt8">
              <div className="spec-h mt8"><span className="lbl">Historial por sesión</span><span className="lbl">Esf.</span></div>
              <div className="spec hist">
                {hist.slice(0, 8).map(h => {
                  const tr = h.series.filter(s => !s.calentamiento)
                  const rpe = Math.max(0, ...tr.map(s => s.rpe ?? 0))
                  return (
                    <p key={`${h.sesionId}-${h.inicio}`}>
                      <span>{h.fecha === hoyISO() ? 'Hoy' : fechaCorta(h.fecha)}</span>
                      <b>{tr.map(s => (s.peso != null ? `${kg(s.peso)}×${s.reps ?? s.segundos}` : `${s.reps ?? s.segundos}${reg === 'tiempo' ? 's' : ''}`)).join(' · ')} {tr.some(s => s.record) && <Ico n="trophy" b className="goldc" />}</b>
                      <em>{rpe || '—'}</em>
                    </p>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="sec">
          <div className="sec-h"><h2>Mis ajustes y notas</h2><button className="lnk" onClick={() => setEditar(v => !v)}><Ico n="pencil-simple" />{editar ? 'Listo' : 'Editar'}</button></div>
          {editar ? (
            <div className="fields">
              <label><span className="lbl fl">Ajustes de máquina</span><input className="inp" defaultValue={m?.ajustes ?? ''} placeholder="Asiento 4 · respaldo 2 · agarre neutro" onBlur={ev => void marcar(e.id, { ajustes: ev.target.value })} /></label>
              <label><span className="lbl fl">Notas de técnica</span><textarea className="inp" defaultValue={m?.notas ?? ''} placeholder="Escápulas atrás antes de bajar…" onBlur={ev => void marcar(e.id, { notas: ev.target.value })} /></label>
            </div>
          ) : m?.ajustes || m?.notas ? (
            <div className="spec-box">
              {m.ajustes && <div className="spec flat"><p><span>Ajustes</span><b style={{ whiteSpace: 'normal' }}>{m.ajustes}</b></p></div>}
              {m.notas && <p className="mynote"><Ico n="note-pencil" />«{m.notas}»</p>}
            </div>
          ) : <p className="small muted">Apunta aquí la altura del asiento, el agarre o lo que te sirva.</p>}
        </div>

        {e.instrucciones.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>Instrucciones</h2></div>
            <ol className="steps">{e.instrucciones.map((t, i) => <li key={i}>{t}</li>)}</ol>
            {peligro && <p className="note warn mt8"><Ico n="first-aid" /><span>Si entrenas solo: no vayas al fallo y usa las barras de seguridad.</span></p>}
          </div>
        )}
        {e.consejos.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>Consejos</h2></div>
            <div className="why">{e.consejos.map((t, i) => <p key={i}><Ico n="check-circle" /><span>{t}</span></p>)}</div>
          </div>
        )}

        {alternativas.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>Alternativas y relacionados</h2><span className="lbl">Mismo músculo</span></div>
            <div className="hscroll">
              {alternativas.map((a, i) => {
                const x = ejercicio(a.id)
                if (!x) return null
                const letra = enPlan && i < (enPlan.b.alternativas.length) ? 'BC'[i] : null
                return (
                  <button key={a.id} className="mini-ad" onClick={() => nav.ir('rut-ficha', { id: a.id })}>
                    <Th ej={x} size="l" />
                    <span className={cx('tag', letra && 'blue')}>{letra ?? 'Otra'}</span>
                    <b>{x.nombre}</b>
                    <small>{nombreMaterial(x.material)}</small>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="sec">
          <div className="chips eq">
            <Chip on={!!m?.favorito} onClick={() => void marcar(e.id, { favorito: !m?.favorito })}><Ico n="star" b />Favorito</Chip>
            <Chip on={!!m?.odiado} onClick={() => void marcar(e.id, { odiado: !m?.odiado })}><Ico n="prohibit" b />No me gusta</Chip>
            <Chip on={!!m?.duele} onClick={() => void marcar(e.id, { duele: !m?.duele })}><Ico n="warning" b />Me duele</Chip>
          </div>
          {(m?.odiado || m?.duele) && <p className="small muted mt8">No te lo propondremos en la rutina ni como alternativa.</p>}
          {alPlan && r ? (
            <div className="chips mt8">{r.dias.map(d => <Chip key={d.letra} onClick={() => void anadirAlDia(d.letra)}>Día {d.letra}</Chip>)}<Chip onClick={() => setAlPlan(false)}>Cancelar</Chip></div>
          ) : (
            <div className="btns mt8">
              <button className="btn gry sm" onClick={() => (r ? setAlPlan(true) : aviso('Primero crea tu rutina'))}>Al plan</button>
              <button className="btn sm" onClick={alEntreno}>Al entreno de hoy</button>
            </div>
          )}
        </div>
        <p className="credit">Exercise data by <a href="https://repdb.co" style={{ color: 'inherit' }}>RepDB (repdb.co)</a></p>
      </div>
    </Pantalla>
  )
}
