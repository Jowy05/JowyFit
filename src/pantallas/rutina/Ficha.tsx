// RUT-06 · Ficha de ejercicio: todo lo de RepDB + tu progreso, tus ajustes y tus marcas.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../datos/db'
import { marcar } from '../../datos/repos'
import { historialDe, sugerenciaPara } from '../../datos/consultas'
import { catalogoCargado, ejercicio, etiqueta, imagen, imagenMaterial, imagenMusculo, nombreMaterial, nombreMusculo, relacionados } from '../../catalogo/catalogo'
import { ETIQUETAS_ES, NOMBRE_PATRON, patron, tipoRegistro } from '../../catalogo/clasificacion'
import { epley, kg, num } from '../../dominio/calculos'
import { duracion, fechaCorta, hoyISO } from '../../dominio/fechas'
import { bloqueNuevo } from '../../dominio/generador'
import { desdeBloque } from '../../dominio/sesion'
import { mejorMarca, volumen } from '../../dominio/progresion'
import { Cab, Chip, cx, Ico, Pantalla, TextoGuardado, Th, useUnaVez } from '../../ui/componentes'
import { Barras, Linea } from '../../ui/graficas'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useGimnasio, useMarcas, usePerfil, useRutina, useSesionEnCurso } from '../../datos/hooks'
import { guardarRutina } from './EditarPlan'
import { propio } from '../../dominio/claves'
import { musculoComun, musculosComunes, nombreVisible, tituloDia, zonaComun } from './comun'
import { t, tc, tk, tn } from '../../i18n'
import { tr } from '../../i18n/jsx'

const REGISTRO_TXT = { peso: tk('kg y repeticiones'), mancuerna: tk('kg de cada mancuerna'), asistido: tk('kg de ayuda'), corporal: tk('repeticiones'), tiempo: tk('segundos'), cardio: tk('minutos') }

export function Ficha({ ruta }: { ruta: Ruta<'rut-ficha'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const e = ejercicio(ruta.d.id)
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
  // Doble toque en «Al entreno de hoy» o en un día del plan: el ejercicio se añadía dos veces.
  const unaVez = useUnaVez()

  useEffect(() => {
    if (!e || e.poses.length < 2) return
    const reloj = setInterval(() => setPose(p => (p + 1) % e.poses.length), 1800)
    return () => clearInterval(reloj)
  }, [e])

  if (!e) return <Pantalla><Cab atras titulo={t('Ejercicio')} /><div className="pg"><p className="muted">{t('No encontrado.')}</p></div></Pantalla>

  const todas = hist.flatMap(h => h.series)
  const record = mejorMarca(todas)
  const primero = hist.length ? mejorMarca(hist[hist.length - 1]!.series) : null
  const cron = [...hist].reverse()
  const puntos = cron.map(h => {
    const validas = h.series.filter(s => !s.calentamiento && s.peso != null)
    const mx = validas.length ? Math.max(...validas.map(s => s.peso!)) : 0
    const rm = Math.max(0, ...validas.map(s => epley(s.peso!, s.reps ?? 0)))
    return { x: fechaCorta(h.fecha).replace(' ', '/'), peso: mx, rm, vol: volumen(h.series) }
  })
  const reg = tipoRegistro(e)
  const alternativas = [...(enPlan?.b.alternativas ?? []).map(id => ({ id, t: '' })), ...relacionados(e, catalogoCargado()?.ejercicios ?? [], 8).map(x => ({ id: x.id, t: 'Otra' }))]
    .filter((x, i, a) => a.findIndex(y => y.id === x.id) === i).slice(0, 8)
  const prin = musculosComunes(e.principales)
  const secu = musculosComunes(e.secundarios).filter(x => !prin.includes(x))
  const peligro = (e.id === 'bench-press' || e.id === 'squat' || e.id.includes('barbell-bench') || e.id === 'incline-bench-press')

  const alEntreno = unaVez(async () => {
    if (!sesion?.id) { aviso(t('Empieza un entreno y podrás añadirlo')); return }
    const b = bloqueNuevo(e.id, { perfil, ejercicios: catalogoCargado()?.ejercicios ?? [], gimnasio: g ?? null, marcas })
    const s = structuredClone(sesion)
    const ej = desdeBloque(b, { peso: sug?.peso ?? null, reps: sug?.reps ?? b.repsMin })
    if (!s.ejercicios.some(x => x.estado === 'curso')) ej.estado = 'curso'
    s.ejercicios.push(ej)
    await db.sesiones.put(s)
    aviso(t('Añadido al entreno de hoy'))
  })
  const anadirAlDia = unaVez(async (letra: string) => {
    if (!r) return
    const nueva = structuredClone(r)
    nueva.dias.find(d => d.letra === letra)!.bloques.push(bloqueNuevo(e.id, { perfil, ejercicios: catalogoCargado()?.ejercicios ?? [], gimnasio: g ?? null, marcas }))
    await guardarRutina(nueva)
    setAlPlan(false)
    aviso(t('Añadido a tu plan: {dia}', { dia: tituloDia(nueva.dias.find(d => d.letra === letra)!).toLowerCase() }))
  })

  return (
    <Pantalla>
      <div className="gal has-img">
        <button className="gal-back" onClick={nav.atras} aria-label={t('Atrás')}><Ico n="caret-left" b /></button>
        <span className="gal-cnt tag">RepDB · {pose + 1} / {e.poses.length}</span>
        {e.poses.map((p, i) => (
          <figure key={p} className={cx('gal-it', i === pose && 'on')} onClick={() => setPose((pose + 1) % e.poses.length)}>
            <img src={imagen(e, p)} alt={p === 'start' ? t('Posición inicial') : p === 'peak' ? t('Posición final') : nombreVisible(e.nombre)} />
            <figcaption style={{ textShadow: '0 1px 3px rgba(0,0,0,.4)', color: '#16202B' }}>
              {e.poses.length > 1 && <span className="dots">{e.poses.map((_, k) => <i key={k} className={cx(k === i && 'on')} />)}</span>}
              {p === 'start' ? t('Posición inicial') : p === 'peak' ? t('Posición final') : ''}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="pg">
        <p className="lbl">{zonaComun(e.zona)} · {nombreMaterial(e.material).toLowerCase()}</p>
        <h1 className="ficha-t">{nombreVisible(e.nombre)}</h1>
        {e.descripcion && <p className="muted mt4">{e.descripcion}</p>}

        {e.instrucciones.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>{t('Instrucciones')}</h2></div>
            <ol className="steps">{e.instrucciones.map((x, i) => <li key={i}>{x}</li>)}</ol>
            {peligro && <p className="note warn mt8"><Ico n="first-aid" /><span>{t('Si entrenas solo: no llegues a no poder más y usa las barras de seguridad.')}</span></p>}
          </div>
        )}

        <div className="sec">
          <div className="sec-h"><h2>{t('Músculos que trabaja')}</h2></div>
          <p className="ux-rut-trabaja">{secu.length > 0
            ? tr('Sobre todo {prin}; también {secu}.', { prin: <b>{prin.join(', ').toLowerCase()}</b>, secu: secu.join(', ').toLowerCase() })
            : tr('Sobre todo {prin}.', { prin: <b>{prin.join(', ').toLowerCase()}</b> })}</p>
          <div className="chips mt8">
            {[...e.principales.map(x => ({ x, p: true })), ...e.secundarios.map(x => ({ x, p: false }))].map(({ x, p }) => (
              <span key={x} className="pill-mus">
                {imagenMusculo(x) ? <img className="mus-img" src={imagenMusculo(x)} alt="" loading="lazy" /> : <span className="ico"><Ico n="person-simple" /></span>}
                <span><b>{musculoComun(x)}</b><small>{nombreMusculo(x)} · {p ? t('principal') : t('secundario')}</small></span>
              </span>
            ))}
          </div>
          {e.material && imagenMaterial(e.material) && (
            <div className="it card mt8"><span className="mus-img" style={{ background: '#fff' }}><img src={imagenMaterial(e.material)} alt="" style={{ width: 44, height: 44, objectFit: 'contain' }} /></span><span className="tx"><b>{nombreMaterial(e.material)}</b><small>{t('Lo que necesitas')}</small></span></div>
          )}
        </div>

        <div className="sec">
          <div className="sec-h"><h2>{t('Mi progreso')}</h2><span className="lbl">{tn(hist.length, '{n} vez', '{n} veces')}</span></div>
          {enPlan && <p className="note ux-rut-plan"><Ico n="calendar-check" /><span><b>{t('En tu plan:')}</b> {enPlan.b.registro === 'tiempo'
            ? t('{dia} · {series} series de {min} a {max} segundos · descanso {tiempo}', { dia: tituloDia(enPlan.d), series: enPlan.b.series, min: enPlan.b.repsMin, max: enPlan.b.repsMax, tiempo: duracion(enPlan.b.descanso) })
            : t('{dia} · {series} series de {min} a {max} · descanso {tiempo}', { dia: tituloDia(enPlan.d), series: enPlan.b.series, min: enPlan.b.repsMin, max: enPlan.b.repsMax, tiempo: duracion(enPlan.b.descanso) })}</span></p>}
          {record ? (
            <div className="ach">
              <span className="tro"><Ico n="trophy" b /></span>
              <span className="tx"><small className="au">{t('Tu mejor serie')}</small><b className="mono">{kg(record.peso)} kg × {record.reps}</b><small>{t('Podrías con unos {n} kg una sola vez', { n: num(record.e1rm, 0) })}</small></span>
              {primero && record.peso > primero.peso && <span className="end">+{kg(record.peso - primero.peso)} kg<br />{t('desde el inicio')}</span>}
            </div>
          ) : <p className="note plain"><Ico n="info" /><span>{reg === 'corporal' || reg === 'tiempo' ? t('Aquí verás tus mejores marcas cuando lo hagas.') : t('Aún no lo has hecho. La primera vez, elige un peso cómodo: que te sobren 3 o 4 repeticiones.')}</span></p>}
          {puntos.length > 0 && (
            <div className="card pd mt8">
              <div className="chips eq">
                <Chip on={graf === 'peso'} onClick={() => setGraf('peso')}>{t('Peso')}</Chip>
                <Chip on={graf === 'rm'} onClick={() => setGraf('rm')}>{t('Máx. estimado')}</Chip>
                <Chip on={graf === 'vol'} onClick={() => setGraf('vol')}>{t('Kilos totales')}</Chip>
              </div>
              <div className="mt12">
                {graf === 'vol' ? <Barras puntos={puntos.map(p => ({ x: p.x, y: p.vol }))} /> : <Linea puntos={puntos.map(p => ({ x: p.x, y: graf === 'peso' ? p.peso : p.rm }))} />}
              </div>
              {sug && sug.peso != null && <p className="nextload"><Ico n="trend-up" b /><span>{tr('La próxima vez: {carga} · {texto}', { carga: <b className="mono">{kg(sug.peso)} kg × {sug.reps}</b>, texto: sug.texto.toLowerCase() })}</span></p>}
            </div>
          )}
          {hist.length > 0 && (
            <details className="fold mt8">
              <summary><Ico n="list-numbers" className="blue" />{t('Ver cada día que lo hiciste')}<Ico n="caret-down" /></summary>
              <div className="in">
                <div className="spec-h mt8"><span className="lbl">{t('Día · kg × repeticiones')}</span><span className="lbl">{t('Esfuerzo')}</span></div>
                <div className="spec hist">
                  {hist.slice(0, 8).map(h => {
                    const validas = h.series.filter(s => !s.calentamiento)
                    const rpe = Math.max(0, ...validas.map(s => s.rpe ?? 0))
                    return (
                      <p key={`${h.sesionId}-${h.inicio}`}>
                        <span>{h.fecha === hoyISO() ? t('Hoy') : fechaCorta(h.fecha)}</span>
                        <b>{validas.map(s => (s.peso != null ? `${kg(s.peso)}×${s.reps ?? s.segundos}` : `${s.reps ?? s.segundos}${reg === 'tiempo' ? 's' : ''}`)).join(' · ')} {validas.some(s => s.record) && <Ico n="trophy" b className="goldc" />}</b>
                        <em>{rpe || '—'}</em>
                      </p>
                    )
                  })}
                </div>
              </div>
            </details>
          )}
        </div>

        <div className="sec">
          <div className="sec-h"><h2>{t('Mis ajustes y notas')}</h2><button className="lnk" onClick={() => setEditar(v => !v)}><Ico n="pencil-simple" />{editar ? t('Listo') : t('Escribir')}</button></div>
          {editar ? (
            <div className="fields">
              <label><span className="lbl fl">{t('Ajustes de máquina')}</span><TextoGuardado valor={m?.ajustes ?? ''} placeholder={t('Asiento 4 · respaldo 2 · agarre neutro')} etiqueta={t('Ajustes de máquina')} onGuardar={v => void marcar(e.id, { ajustes: v })} /></label>
              <label><span className="lbl fl">{t('Notas para acordarte')}</span><TextoGuardado area valor={m?.notas ?? ''} placeholder={t('Escápulas atrás antes de bajar…')} etiqueta={t('Notas para acordarte')} onGuardar={v => void marcar(e.id, { notas: v })} /></label>
            </div>
          ) : m?.ajustes || m?.notas ? (
            <div className="spec-box">
              {m.ajustes && <div className="spec flat"><p><span>{tc('máquina', 'Ajustes')}</span><b style={{ whiteSpace: 'normal' }}>{m.ajustes}</b></p></div>}
              {m.notas && <p className="mynote"><Ico n="note-pencil" />«{m.notas}»</p>}
            </div>
          ) : <p className="small muted">{t('Apunta aquí la altura del asiento, el agarre o lo que te sirva.')}</p>}
        </div>

        {e.consejos.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>{t('Consejos')}</h2></div>
            <div className="why">{e.consejos.map((x, i) => <p key={i}><Ico n="check-circle" /><span>{x}</span></p>)}</div>
          </div>
        )}

        {alternativas.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>{t('Parecidos')}</h2><span className="lbl">{t('Mismo músculo')}</span></div>
            <div className="hscroll">
              {alternativas.map((a, i) => {
                const x = ejercicio(a.id)
                if (!x) return null
                const deTuPlan = !!enPlan && i < enPlan.b.alternativas.length
                return (
                  <button key={a.id} className="mini-ad" onClick={() => nav.ir('rut-ficha', { id: a.id })}>
                    <Th ej={x} size="l" />
                    <span className={cx('tag', deTuPlan && 'blue')}>{deTuPlan ? t('Si está ocupado') : t('Parecido')}</span>
                    <b>{nombreVisible(x.nombre)}</b>
                    <small>{nombreMaterial(x.material)}</small>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="sec">
          <div className="sec-h"><h2>{t('¿Qué te parece?')}</h2></div>
          <div className="chips eq">
            <Chip on={!!m?.favorito} onClick={() => void marcar(e.id, { favorito: !m?.favorito })}><Ico n="star" b />{t('Favorito')}</Chip>
            <Chip on={!!m?.odiado} onClick={() => void marcar(e.id, { odiado: !m?.odiado })}><Ico n="prohibit" b />{t('No me gusta')}</Chip>
            <Chip on={!!m?.duele} onClick={() => void marcar(e.id, { duele: !m?.duele })}><Ico n="warning" b />{t('Me duele')}</Chip>
          </div>
          {(m?.odiado || m?.duele) && <p className="small muted mt8">{t('No te lo propondremos en la rutina ni para cuando algo esté ocupado.')}</p>}
          {alPlan && r ? (
            <>
              <p className="small muted mt12">{t('¿A qué día lo añado?')}</p>
              <div className="chips mt8">{r.dias.map(d => <Chip key={d.letra} onClick={() => void anadirAlDia(d.letra)}>{tituloDia(d)}</Chip>)}<Chip onClick={() => setAlPlan(false)}>{t('Cancelar')}</Chip></div>
            </>
          ) : (
            <div className="btns mt12">
              <button className="btn gry sm" onClick={() => (r ? setAlPlan(true) : aviso(t('Primero crea tu rutina')))}><Ico n="plus" b />{t('Añadir a mi plan')}</button>
              {sesion?.id != null && <button className="btn sm" onClick={() => void alEntreno()}>{t('Al entreno de ahora')}</button>}
            </div>
          )}
        </div>

        {/* Datos raros del catálogo: plegados. */}
        <details className="fold mt20">
          <summary><Ico n="info" className="blue" />{t('Ficha técnica')}<Ico n="caret-down" /></summary>
          <div className="in">
            <div className="spec c2">
              <p><span>{t('Material')}</span><b>{nombreMaterial(e.material)}</b></p>
              <p><span>{t('Dificultad')}</span><b>{etiqueta('difficulty', e.dificultad)}</b></p>
              <p><span>{t('Tipo')}</span><b>{etiqueta('mechanic', e.mecanica)}</b></p>
              <p><span>{tc('tipo de fuerza', 'Fuerza')}</span><b>{etiqueta('force_type', e.fuerza)}</b></p>
              <p><span>{t('Categoría')}</span><b>{etiqueta('category', e.categoria)}</b></p>
              <p><span>{t('Movimiento')}</span><b>{t(NOMBRE_PATRON[patron(e)])}</b></p>
              <p><span>{t('Se apunta en')}</span><b>{t(REGISTRO_TXT[reg])}</b></p>
              <p><span>{t('Un lado cada vez')}</span><b>{e.unilateral ? t('Sí') : t('No')}</b></p>
              {e.met != null && <p><span>{t('MET (gasto)')}</span><b>{num(e.met)}</b></p>}
              {e.objetivos.length > 0 && <p><span>{t('Objetivos')}</span><b style={{ whiteSpace: 'normal' }}>{e.objetivos.map(o => etiqueta('goals', o)).join(', ')}</b></p>}
              {enPlan && <>
                <p><span>{t('En tu plan')}</span><b>{t('Día {letra}', { letra: enPlan.d.letra })}</b></p>
                <p><span>{t('Esfuerzo')}</span><b>{enPlan.b.rpe}/10</b></p>
              </>}
            </div>
            {e.etiquetas.length > 0 && <div className="chips mt8">{e.etiquetas.map(x => { const k = propio(ETIQUETAS_ES, x); return <span key={x} className="tag blue">{k ? t(k) : x}</span> })}</div>}
          </div>
        </details>
        <p className="credit">Exercise data by <a href="https://repdb.co" style={{ color: 'inherit' }}>RepDB (repdb.co)</a></p>
      </div>
    </Pantalla>
  )
}
