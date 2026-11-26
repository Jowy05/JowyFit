// AJU-01 · Secciones de Entreno y Comida dentro de Ajustes.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { guardarAjustes, leerPerfil } from '../../datos/repos'
import { objetivosEnergia } from '../../datos/consultas'
import type { Ajustes as TAjustes, Franja } from '../../datos/tipos'
import { duracion } from '../../dominio/fechas'
import { falloFranjas, FRANJAS, FRANJAS_HORAS, nombreFranja } from '../../dominio/comida'
import { num } from '../../dominio/formato'
import { capacidades } from '../../plataforma'
import { Elegir, FilaInterruptor, Ico, Stepper } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useAjustes, useGimnasio, usePerfil } from '../../datos/hooks'
import { t } from '../../i18n'

/** Ajustes de entreno y rutina: avisos durante la sesión, descansos, exclusiones y gimnasios. */
export function EntrenoAjustes() {
  const nav = useNav()
  const a = useAjustes()
  const p = usePerfil()
  const gym = useGimnasio()
  const cap = capacidades()
  const guardar = (c: Partial<TAjustes>) => { void guardarAjustes(c) }

  return (
    <>
      <p className="grp-t">{t('Durante el entreno')}</p>
      <div className="list">
        {/* Sin vibración (iPhone): no se ofrece; al acabar el descanso destella la pantalla. */}
        {cap.vibracion && <FilaInterruptor titulo={t('Vibrar al acabar el descanso')} on={a.vibrar} onCambio={v => guardar({ vibrar: v })} />}
        <FilaInterruptor titulo={t('Sonido al acabar el descanso')} on={a.sonido} onCambio={v => guardar({ sonido: v })} />
        <FilaInterruptor titulo={t('Pantalla siempre encendida')} d={t('Durante el entreno')} on={a.pantallaEncendida} onCambio={v => guardar({ pantallaEncendida: v })} />
        <FilaInterruptor titulo={t('Calentamiento sugerido')} d={t('Unas series ligeras antes de las pesadas')} on={a.calentamiento} onCambio={v => guardar({ calentamiento: v })} />
        <FilaInterruptor titulo={t('Avisos de seguridad')} d={t('En banca y sentadilla con barra')} on={a.avisosSeguridad} onCambio={v => guardar({ avisosSeguridad: v })} />
        <FilaInterruptor titulo={t('Ayuda del esfuerzo')} d={t('En el entreno, qué significa cada número de «¿Cuánto te ha costado?»')} on={a.ayudaEsfuerzo !== false} onCambio={v => guardar({ ayudaEsfuerzo: v })} />
      </div>

      <p className="grp-t">{t('Rutina y gimnasio')}</p>
      <div className="list">
        <div className="it col">
          <span className="tx"><b>{t('Descanso entre series')}</b><small>{t('Ejercicios grandes {grandes} · pequeños {pequenos} · se usa al crear la rutina', { grandes: duracion(a.descansoCompuesto), pequenos: duracion(a.descansoAislamiento) })}</small></span>
          <div className="grid2">
            <div><span className="lbl fl">{t('Grandes')}</span><Stepper className="sm" valor={a.descansoCompuesto} paso={15} min={30} max={600} sufijo="s" etiqueta={t('Descanso de compuestos')} onCambio={v => guardar({ descansoCompuesto: v })} /></div>
            <div><span className="lbl fl">{t('Pequeños')}</span><Stepper className="sm" valor={a.descansoAislamiento} paso={15} min={15} max={600} sufijo="s" etiqueta={t('Descanso de aislamiento')} onCambio={v => guardar({ descansoAislamiento: v })} /></div>
          </div>
          <small className="small muted">{t('Grandes: sentadilla, press, remo… Pequeños: bíceps, gemelos…')}</small>
        </div>
        <button className="it" onClick={() => nav.hoja('hoja-no-quiero')}>
          <span className="ico"><Ico n="prohibit" /></span>
          <span className="tx"><b>{t('Lo que no quieres hacer')}</b><small>{p.noQuiero?.length ? t('{n} fuera de tu rutina', { n: p.noQuiero.length }) : t('Nada: puede salir de todo')}</small></span>
          <Ico n="caret-right" className="car" />
        </button>
        <button className="it" onClick={() => nav.ir('gimnasios', undefined, 'rut')}>
          <span className="ico"><Ico n="map-pin" /></span>
          <span className="tx"><b>{t('Gimnasios')}</b><small>{gym ? t('{nombre} · activo', { nombre: gym.nombre }) : t('Ninguno todavía')}</small></span>
          <Ico n="caret-right" className="car" />
        </button>
        <button className="it" onClick={() => nav.ir('seccion-perfil', { s: 'preferencias' })}>
          <span className="ico"><Ico n="sliders-horizontal" /></span>
          <span className="tx"><b>{t('Preferencias de entreno')}</b><small>{t('Máquinas o libre, repeticiones, dos seguidos y abdominales')}</small></span>
          <Ico n="caret-right" className="car" />
        </button>
      </div>
    </>
  )
}

/** Ajustes de comida y nutrición: calorías, objetivo diario, cafeína, horarios y suplementos. */
export function ComidaAjustes() {
  const nav = useNav()
  const aviso = useAviso()
  const a = useAjustes()
  const p = usePerfil()
  const guardar = (c: Partial<TAjustes>) => { void guardarAjustes(c) }
  const auto = useLiveQuery(async () => {
    const perfil = await leerPerfil()
    return perfil ? objetivosEnergia(perfil) : undefined
  }, [])

  const manual = a.kcalManual != null || a.proteinaManual != null
  const ponerManual = (m: 'auto' | 'manual') => {
    if (m === 'auto') { guardar({ kcalManual: null, proteinaManual: null }); aviso(t('Objetivo automático')); return }
    guardar({ kcalManual: a.kcalManual ?? auto?.kcal ?? 2000, proteinaManual: a.proteinaManual ?? auto?.proteina ?? 140 })
  }

  return (
    <>
      <p className="grp-t">{t('Calorías y objetivo')}</p>
      <div className="list">
        <FilaInterruptor titulo={t('Mostrar calorías')} d={t('La proteína se ve siempre')} on={a.mostrarKcal} onCambio={v => guardar({ mostrarKcal: v })} />
        <div className="it col">
          <span className="tx"><b>{t('Objetivo del día')}</b><small>{manual ? t('Lo pones tú') : auto ? t('Automático: {kcal} kcal · {proteina} g de proteína', { kcal: num(auto.kcal, 0), proteina: auto.proteina }) : t('Lo calcula la app con tu peso y tu actividad')}</small></span>
          <Elegir eq className="w100" opciones={[{ v: 'auto' as const, t: t('Automático') }, { v: 'manual' as const, t: t('Lo pongo yo') }]} valor={manual ? 'manual' : 'auto'} onCambio={ponerManual} />
          {manual && (
            <>
              <div className="grid2">
                <div><span className="lbl fl">{t('Calorías')}</span><Stepper className="sm" valor={a.kcalManual} paso={50} min={1000} max={5000} etiqueta={t('Kcal al día')} onCambio={v => guardar({ kcalManual: v })} /></div>
                <div><span className="lbl fl">{t('Proteína')}</span><Stepper className="sm" valor={a.proteinaManual} paso={5} min={40} max={300} sufijo="g" etiqueta={t('Proteína al día')} onCambio={v => guardar({ proteinaManual: v })} /></div>
              </div>
              <button className="btn ln sm" onClick={() => ponerManual('auto')}><Ico n="arrow-counter-clockwise" b />{t('Volver a automático')}</button>
            </>
          )}
        </div>
      </div>

      <p className="grp-t">{t('Cafeína y horarios')}</p>
      <div className="list">
        <div className="it col">
          <span className="tx"><b>{t('Límite de cafeína')}</b><small>{t('Cuánta al día y desde qué hora te avisamos')}</small></span>
          <div className="grid2">
            <div><span className="lbl fl">{t('Máximo al día')}</span><Stepper className="sm" valor={a.cafeinaLimite} paso={50} min={0} max={1000} sufijo="mg" etiqueta={t('Límite de cafeína')} onCambio={v => guardar({ cafeinaLimite: v })} /></div>
            <label><span className="lbl fl">{t('Hora tope')}</span><input className="inp" type="time" value={a.cafeinaHoraTope} onChange={e => { if (e.target.value) guardar({ cafeinaHoraTope: e.target.value }) }} /></label>
          </div>
          <small className="small muted">{t('Un café son unos 80 mg.')}</small>
        </div>
        <FilaFranjas horas={a.franjasHoras ?? FRANJAS_HORAS} onCambio={h => guardar({ franjasHoras: h })} />
      </div>

      <p className="grp-t">{t('Suplementos')}</p>
      <div className="list">
        <button className="it" onClick={() => nav.ir('seccion-perfil', { s: 'alimentacion' })}>
          <span className="ico"><Ico n="pill" /></span>
          <span className="tx"><b>{t('Suplementos que tomas')}</b><small>{p.suplementos.length ? p.suplementos.map(x => t(x)).join(' · ') : t('Sin suplementos')}</small></span>
          <Ico n="caret-right" className="car" />
        </button>
      </div>
    </>
  )
}

/**
 * Franjas horarias: a qué hora empieza cada comida (así se elige sola al apuntar). Cada una, después de la anterior.
 * Se comprueba al salir del campo, no al teclear: en el PC «12:00» pasa por «01:00» mientras se escribe,
 * y así también se pueden mover varias horas en cualquier orden.
 */
function FilaFranjas({ horas, onCambio }: { horas: Record<Franja, string>; onCambio: (h: Record<Franja, string>) => void }) {
  const [borrador, setBorrador] = useState<Record<Franja, string>>({ ...horas })
  const [fallo, setFallo] = useState('')
  const [vistas, setVistas] = useState(horas)
  if (FRANJAS.some(f => vistas[f.v] !== horas[f.v])) {
    const nuevo = { ...borrador }
    for (const f of FRANJAS) if (borrador[f.v] === vistas[f.v]) nuevo[f.v] = horas[f.v]
    setVistas(horas); setBorrador(nuevo)
    if (!falloFranjas(nuevo)) setFallo('')
  }

  const deSiempre = FRANJAS.every(f => borrador[f.v] === FRANJAS_HORAS[f.v])
  const comprobar = () => {
    const f = falloFranjas(borrador)
    setFallo(f)
    if (!f && FRANJAS.some(x => borrador[x.v] !== horas[x.v])) onCambio({ ...borrador })
  }
  const volver = () => { setBorrador({ ...FRANJAS_HORAS }); setFallo(''); onCambio({ ...FRANJAS_HORAS }) }
  return (
    <div className="it col">
      <span className="tx"><b>{t('Franjas horarias')}</b><small>{t('A qué hora empieza cada comida: así se elige sola al apuntar')}</small></span>
      <div className="grid2">
        {FRANJAS.map(f => (
          <label key={f.v}><span className="lbl fl">{nombreFranja(f.v)}</span>
            <input className="inp" type="time" value={borrador[f.v]} aria-label={t('Hora de {que}', { que: nombreFranja(f.v).toLowerCase() })}
              aria-invalid={fallo ? true : undefined} aria-describedby="fallo-franjas"
              onChange={e => { const v = e.target.value; setBorrador(b => ({ ...b, [f.v]: v })) }} onBlur={comprobar} />
          </label>
        ))}
      </div>
      <span className="fallo-campo" id="fallo-franjas" aria-live="polite">{fallo}</span>
      {!deSiempre && <button className="btn ln sm" onClick={volver}><Ico n="arrow-counter-clockwise" b />{t('Volver a las de siempre')}</button>}
    </div>
  )
}
