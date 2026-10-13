// RUT-02 · Detalle de un día
import { useLiveQuery } from 'dexie-react-hooks'
import type { Bloque } from '../../../datos/tipos'
import { sugerenciasDia } from '../../../datos/consultas'
import { ejercicio, nombreMaterial, nombreMusculo } from '../../../catalogo/catalogo'
import { duracion, formatoHora } from '../../../dominio/fechas'
import { kg } from '../../../dominio/calculos'
import type { Sugerencia } from '../../../dominio/progresion'
import { Cab, cx, Ico, Pantalla, Th } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useGimnasio, usePerfil, useRutina } from '../../datos'
import { filas, minutos, nombreDia } from './comun'

export function DetalleDia({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const r = useRutina()
  const g = useGimnasio()
  const perfil = usePerfil()
  const dia = r?.dias.find(d => d.letra === ruta.d?.letra) ?? r?.dias[0]
  const sug = useLiveQuery(() => (dia ? sugerenciasDia(dia, g) : Promise.resolve(undefined)), [dia, g])
  if (!dia) return <Pantalla><Cab atras titulo="Día" /></Pantalla>
  const series = dia.bloques.reduce((t, b) => t + b.series, 0)
  let n = 0
  return (
    <Pantalla>
      <Cab atras crumb={`Mi plan · Día ${dia.letra}`} titulo={dia.nombre} sub={`${nombreDia(dia)} · ${formatoHora(perfil.horaEntreno)}${g ? ` · ${g.nombre}` : ''}`}
        derecha={<button className="ib" aria-label="Editar" onClick={() => nav.ir('rut-edit', { letra: dia.letra })}><Ico n="pencil-simple" /></button>} />
      <div className="pg">
        <div className="strip">
          <p><span className="lbl">Normal</span><b>~{minutos(dia)} min</b></p>
          <p><span className="lbl">Corta</span><b>~{minutos(dia, true)} min</b></p>
          <p><span className="lbl">Ejercicios</span><b>{dia.bloques.length}</b></p>
          <p><span className="lbl">Series</span><b>{series}</b></p>
        </div>
        {dia.bloques.some(b => b.fueraEnCorta) && <p className="small muted mt8"><Ico n="scissors" className="warnc" /> Marcado lo que se quita en la versión corta.</p>}
        {filas(dia.bloques).map(f => {
          if (Array.isArray(f)) {
            const i1 = ++n, i2 = ++n
            return (
              <div key={f[0].uid} className="ssg mt8">
                <p className="ss-head">Superserie {dia.letra}1 + {dia.letra}2 · descansa tras el par ({duracion(f[0].descanso)})</p>
                <Tarjeta b={f[0]} etiqueta={`${dia.letra}1`} s={sug?.get(f[0].ejercicio)} n={i1} />
                <div className="mt8"><Tarjeta b={f[1]} etiqueta={`${dia.letra}2`} s={sug?.get(f[1].ejercicio)} n={i2} /></div>
              </div>
            )
          }
          return <div key={f.uid} className="mt8"><Tarjeta b={f} etiqueta={String(++n)} s={sug?.get(f.ejercicio)} n={n} /></div>
        })}
        <div className="dock">
          <button className="btn xl" onClick={() => nav.hoja('sheet-ses1', { letra: dia.letra })}><Ico n="play" b />Empezar este entreno</button>
        </div>
      </div>
    </Pantalla>
  )
}

function corto(id: string): string {
  const e = ejercicio(id)
  if (!e) return '?'
  return e.material ? nombreMaterial(e.material).replace(/^Máquina (de )?/, '') : 'Peso corporal'
}

function Tarjeta({ b, etiqueta, s }: { b: Bloque; etiqueta: string; s?: Sugerencia; n: number }) {
  const nav = useNav()
  const e = ejercicio(b.ejercicio)
  return (
    <button className={cx('exc card', b.fueraEnCorta && 'cutc')} onClick={() => nav.ir('rut-ficha', { id: b.ejercicio })}>
      <span className="exc-h">
        <Th ej={e} size="m" />
        <span className="tx">
          <small className="lbl">{etiqueta} · {e?.principales.slice(0, 2).map(nombreMusculo).join(' · ').toLowerCase()}</small>
          <b>{e?.nombre}</b>
        </span>
        <span className={cx('nx', s?.accion === 'subir' && 'hot')}>
          <small>Próxima</small>
          <b>{s?.peso != null ? <>{kg(s.peso)} kg {s.accion === 'subir' && <Ico n="arrow-up" b />}</> : s?.accion === 'primera' ? 'Nuevo' : s?.reps ? `${s.reps} ${b.registro === 'tiempo' ? 's' : 'reps'}` : '—'}</b>
        </span>
      </span>
      <span className="strip sm">
        <span className="p"><span className="lbl">Series</span><b>{b.series}</b></span>
        <span className="p"><span className="lbl">{b.registro === 'tiempo' ? 'Segundos' : 'Reps'}</span><b>{b.repsMin}-{b.repsMax}</b></span>
        <span className="p"><span className="lbl">Esfuerzo</span><b>{b.rpe}</b></span>
        <span className="p"><span className="lbl">Desc.</span><b>{duracion(b.descanso)}</b></span>
      </span>
      {b.fueraEnCorta && <span className="small" style={{ display: 'block', marginTop: 8, color: 'var(--warn)' }}><Ico n="scissors" /> Fuera en la versión corta</span>}
      {b.alternativas.length > 0 && (
        <span className="alts">
          <span className="lbl">Alternativas</span>
          <span className="alt-row">
            {[b.ejercicio, ...b.alternativas].map((id, k) => (
              <span key={id} style={{ display: 'contents' }}>
                {k > 0 && <Ico n="arrow-right" />}
                <span className={cx('al', k === 0 && 'on')}><Th ej={ejercicio(id)} size="xs" /><span>{'ABC'[k]} · {corto(id)}</span></span>
              </span>
            ))}
          </span>
        </span>
      )}
    </button>
  )
}
