// SES-10 · Fin del entreno
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { letrasHechasDeRutina, leerSesion, sesionesHechas } from '../../datos/consultas'
import { historialEn } from '../../dominio/progresion'
import { ejercicio, nombreEjercicio } from '../../catalogo/catalogo'
import { resumen } from '../../dominio/sesion'
import { DIAS, deISO, diaSemana, duracion, fechaLarga, formatoHora, horaDe, hoyISO } from '../../dominio/fechas'
import { entrenosPrevistos } from '../../dominio/semana'
import { capital, kg } from '../../dominio/formato'
import { terminarEntreno } from '../../datos/acciones/entreno'
import { Cab, Chip, Ico, Pantalla, Th, useUnaVez, LARGO } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useAjustes, useGimnasio, usePerfil, useRutina } from '../../datos/hooks'
import { duracionDia } from '../../dominio/generador'
import { t, tn } from '../../i18n'
import { tr } from '../../i18n/jsx'
import { nombreEntreno } from '../../dominio/nombres'


export function FinEntreno({ ruta }: { ruta: Ruta<'fin-entreno'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const g = useGimnasio()
  const perfil = usePerfil()
  const ajustes = useAjustes()
  const r = useRutina()
  const s = useLiveQuery(() => leerSesion(ruta.d.id), [ruta.d.id])
  // Hora de fin: ahora, salvo que la última serie quede muy lejos (la app se cerró en el resumen o se guarda
  // al día siguiente): entonces, poco después de la última serie, para que la duración no salga en horas.
  const [abierto] = useState(Date.now())
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
    // Cada entreno de la rutina hecho al menos una vez (hacer dos veces el mismo no la cierra).
    const letras = await letrasHechasDeRutina(r.id)
    letras.add(s.letra)
    return r.dias.filter(d => !d.opcional).every(d => letras.has(d.letra))
  }, [r?.id, s?.id])

  if (!s) return <Pantalla full><div className="cargando">…</div></Pantalla>
  const ultimaSerie = Math.max(0, ...s.ejercicios.flatMap(e => e.series.map(x => x.ts ?? 0)))
  const fin = ultimaSerie && abierto - ultimaSerie > 30 * 60_000 ? ultimaSerie + 2 * 60_000 : abierto
  const res = resumen({ ...s, fin })
  const logros = s.ejercicios.flatMap(e => e.series.filter(x => x.record).map(x => ({ e, x })))
  const hoy = hoyISO()
  const prox = entrenosPrevistos(r, hoy, ajustes.recolocadas)[0]

  // Un doble toque en «Guardar» no abre dos veces la rutina definitiva ni vuelve dos veces a Inicio.
  const guardar = unaVez(async () => {
    const mins = Math.round(res.segundos / 60)
    // El tiempo, los descansos y lo que estaba ocupado ya los mide la app: solo se pregunta lo que no sabe.
    await terminarEntreno(s, fin, { minutosReales: mins, molestia: hayMolestia ? molestia || 'sí' : undefined, nota: nota || undefined })
    nav.completa(null)
    if (calibCompleta) { nav.ir('generar-rutina', { definitiva: true }, 'rut'); aviso(t('Semana de prueba terminada')) }
    else { nav.raiz('ini'); aviso(t('Guardado. {dia} ✓', { dia: capital(DIAS[(new Date().getDay() + 6) % 7]!) })) }
  })

  return (
    <Pantalla full>
      <Cab className="fin-hd" crumb={<span className="tag ok"><Ico n="flag-checkered" b />{t('Entreno terminado')}</span>} titulo={nombreEntreno(s)} sub={`${capital(fechaLarga(s.fecha))}${g ? ` · ${g.nombre}` : ''}`}
        derecha={<button className="ib" aria-label={t('Volver al entreno')} onClick={() => nav.completa('entreno')}><Ico n="x" /></button>} />
      <div className="pg">
        <div className="spec-box"><div className="spec c2">
          {/* Solo lo que importa; sustituidos y saltados, solo si los hay (el horario y el volumen están en Progreso). */}
          <p><span>{t('Duración')}</span><b>{duracion(res.segundos)}</b></p>
          <p><span>{t('Ejercicios hechos')}</span><b className="okc">{res.hechos < res.ejercicios ? t('{n} de {total}', { n: res.hechos, total: res.ejercicios }) : res.hechos}</b></p>
          <p><span>{t('Series')}</span><b>{res.series}</b></p>
          {res.sustituidos > 0 && <p><span>{t('Cambiados por otro')}</span><b>{res.sustituidos}</b></p>}
          {res.saltados > 0 && <p><span>{t('Saltados')}</span><b>{res.saltados}</b></p>}
        </div></div>

        {logros.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>{t('Logros')}</h2><span className="lbl">{tn(logros.length, '{n} desbloqueado', '{n} desbloqueados')}</span></div>
            <div className="achs">
              {logros.map(({ e, x }, i) => (
                <div key={i} className="ach">
                  <span className="tro"><Ico n={i === 0 ? 'trophy' : 'medal'} b /></span>
                  <span className="tx"><small className="au">{t('Desbloqueado')}{x.ts ? ` · ${horaDe(x.ts)}` : ''}</small><b>{t('Récord en {ejercicio}', { ejercicio: nombreEjercicio(e.ejercicio).toLowerCase() })}</b><small className="mono">{kg(x.peso)} kg × {x.reps}</small></span>
                </div>
              ))}
            </div>
          </div>
        )}

        {subidas.length > 0 && (
          <div className="sec">
            <div className="sec-h"><h2>{t('Subidas de peso')}</h2></div>
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

        {calibCompleta && <p className="note ok mt16"><Ico n="gauge" /><span>{tr('<b>Semana de prueba terminada.</b> Al guardar verás tu rutina definitiva, ajustada a lo que tardas de verdad.', { b: x => <b>{x}</b> })}</span></p>}

        {prox?.dia && (
          <div className="sec">
            <div className="card pd row">
              <span className="ico"><Ico n="calendar-blank" /></span>
              <span className="tx"><span className="lbl">{t('Próxima sesión')}</span><b>{capital(DIAS[diaSemana(deISO(prox.fecha))]!)} · {formatoHora(perfil.horaEntreno)} · {nombreEntreno(prox.dia)}</b><small>~{Math.round(duracionDia(prox.dia.bloques) / 60)} min</small></span>
            </div>
          </div>
        )}

        <div className="sec">
          <div className="sec-h"><h2>{t('Antes de guardar')}</h2><span className="lbl">{t('opcional')}</span></div>
          <div className="qq">
            <p className="lbl">{t('¿Alguna molestia?')}</p>
            <div className="chips">
              <Chip on={!hayMolestia} onClick={() => setHayMolestia(false)}>{t('Ninguna')}</Chip>
              <Chip on={hayMolestia} onClick={() => setHayMolestia(true)}>{t('Sí, te digo dónde')}</Chip>
            </div>
            {hayMolestia && <input className="inp" maxLength={LARGO.frase} value={molestia} onChange={e => setMolestia(e.target.value)} placeholder={t('Hombro derecho en el press…')} />}
            <p className="lbl">{t('Nota')}</p>
            <textarea className="inp" maxLength={LARGO.nota} value={nota} onChange={e => setNota(e.target.value)} placeholder={t('Algo que quieras recordar')} aria-label={t('Nota del entreno')} />
          </div>
        </div>
        {/* Hasta saber si se completa la calibración no se guarda: si no, no se abriría la rutina definitiva. */}
        <div className="dock"><button className="btn xl" disabled={calibCompleta === undefined} onClick={() => void guardar()}>{t('Guardar')}</button></div>
      </div>
    </Pantalla>
  )
}
