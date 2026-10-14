// SES-01 · Antes de empezar
import { useState } from 'react'
import { db } from '../../../datos/db'
import { guardarPerfil } from '../../../datos/repos'
import type { DiaRutina, Perfil, Transporte } from '../../../datos/tipos'
import { DIAS, formatoHora, horaActual, minutosDe } from '../../../dominio/fechas'
import { duracionDia } from '../../../dominio/generador'
import { programar } from '../../../plataforma'
import { cx, Hoja, Ico, Interruptor, useUnaVez } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useGimnasio, usePerfilCargado, useRutina, useSesionEnCurso } from '../../datos'
import { abrirEntreno, iniciarEntreno } from './iniciar'

export function HojaEmpezar({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const r = useRutina()
  const perfil = usePerfilCargado()
  const enCurso = useSesionEnCurso()
  // Esperar a tener perfil, rutina y sesión: si no, la hora límite y el transporte salen los de por defecto
  // y durante un instante se ve «Sin rutina».
  if (r === undefined || !perfil || enCurso === undefined) return <Hoja titulo="Empezar"><p className="muted">Cargando…</p></Hoja>
  if (enCurso) return (
    <Hoja titulo="Ya estás entrenando">
      <p className="muted">Tienes «{enCurso.nombre}» en curso.</p>
      <button className="btn xl mt16" onClick={() => { nav.hoja(null); abrirEntreno(nav) }}><Ico n="play" b />Continuar</button>
    </Hoja>
  )
  const dia = r?.dias.find(d => d.letra === ruta.d?.letra) ?? r?.dias[0]
  if (!dia) return (
    <Hoja titulo="Sin rutina">
      <p className="muted">Aún no tienes rutina. La creamos con tus días, tu tiempo y tu gimnasio.</p>
      <button className="btn mt16" onClick={() => { nav.hoja(null); nav.ir('rut-gen', undefined, 'rut') }}>Crear mi rutina</button>
    </Hoja>
  )
  return <FormEmpezar dia={dia} perfil={perfil} corta={ruta.d?.version === 'corta'} />
}

function FormEmpezar({ dia, perfil, corta: empezarCorta }: { dia: DiaRutina; perfil: Perfil; corta: boolean }) {
  const nav = useNav()
  const g = useGimnasio()
  const unaVez = useUnaVez()
  const quedan = minutosDe(perfil.horaLimite[perfil.transporte]) - minutosDe(horaActual())
  const [modo, setModo] = useState<'normal' | 'corta' | 'hora'>(empezarCorta ? 'corta' : quedan > 0 && quedan < 180 ? 'hora' : 'normal')
  const [transporte, setTransporte] = useState<Transporte>(perfil.transporte)
  const [hora, setHora] = useState(perfil.horaLimite[perfil.transporte])
  const [calentar, setCalentar] = useState(false)
  const normal = Math.round(duracionDia(dia.bloques) / 60)
  const corta = Math.round(duracionDia(dia.bloques, true) / 60)
  const series = dia.bloques.reduce((t, b) => t + b.series, 0)
  const disponibles = Math.max(0, minutosDe(hora) - minutosDe(horaActual()))
  const quitados = dia.bloques.filter(b => b.fueraEnCorta).length
  // Un doble toque en «Empezar» crearía dos entrenos en curso.
  const empezar = unaVez(async () => {
    const version = modo === 'corta' || (modo === 'hora' && disponibles > 0 && disponibles < normal - 3) ? 'corta' : 'normal'
    if (modo === 'hora') await guardarPerfil({ transporte, horaLimite: { ...perfil.horaLimite, [transporte]: hora } })
    const id = await iniciarEntreno({ letra: dia.letra, version, horaLimite: modo === 'hora' ? hora : undefined })
    if (calentar) {
      const s = await db.sesiones.get(id)
      if (s) {
        const hasta = Date.now() + 300_000
        await db.sesiones.put({ ...s, descansoHasta: hasta, descansoTotal: 300 })
        // Igual que el descanso entre series: aviso aunque el móvil esté bloqueado (id 9001).
        void programar([{ id: 9001, titulo: 'Calentamiento terminado', texto: 'A por la primera serie', cuando: new Date(hasta) }], [9001])
      }
    }
    nav.hoja(null)
    nav.completa('entreno')
  })
  return (
    <Hoja titulo={dia.nombre} sub={`${dia.bloques.length} ejercicios · ${series} series`}>
      <span className="lbl" style={{ display: 'block', marginTop: -10, marginBottom: 12 }}>Día {dia.letra}{dia.dia != null ? ` · ${DIAS[dia.dia]}` : ''}</span>
      <p className="lbl fl">¿Cuánto tiempo tienes?</p>
      <div className="opts">
        <button className={cx('opt-c', modo === 'normal' && 'on')} onClick={() => setModo('normal')}><span className="rad" /><span className="tx"><b>Normal</b><small>Las {series} series</small></span><span className="end">~{normal} min</span></button>
        <button className={cx('opt-c', modo === 'corta' && 'on')} onClick={() => setModo('corta')}><span className="rad" /><span className="tx"><b>Corta</b><small>{quitados ? `Sin ${quitados} ejercicio${quitados === 1 ? '' : 's'} del final` : 'Igual que la normal'}</small></span><span className="end">~{corta} min</span></button>
        <div className={cx('opt-c', modo === 'hora' && 'on')} onClick={() => setModo('hora')} role="button">
          <span className="rad" />
          <span className="tx">
            <b>Me tengo que ir a las <input className="mono goc" type="time" value={hora} onChange={e => { if (!e.target.value) return; setHora(e.target.value); setModo('hora') }} style={{ border: 0, background: 'transparent', font: 'inherit', color: 'var(--go)', width: 92 }} aria-label="Hora límite" /></b>
            <small>
              <button className={cx('lnk')} style={{ margin: 0, padding: 0 }} onClick={ev => { ev.stopPropagation(); const t = transporte === 'coche' ? 'andando' : 'coche'; setTransporte(t); setHora(perfil.horaLimite[t]) }}>
                {transporte === 'coche' ? 'Vas en coche' : 'Vas andando'} · cambiar
              </button> · ajustamos sobre la marcha
            </small>
          </span>
          <span className="end">{disponibles ? `${disponibles} min` : formatoHora(hora)}</span>
        </div>
      </div>
      <div className="list mt12">
        <button className="it" onClick={() => { nav.hoja(null); nav.ir('rut-gym', undefined, 'rut') }}>
          <span className="ico"><Ico n="map-pin" /></span>
          <span className="tx"><b>{g?.nombre ?? 'Sin gimnasio'}</b>{g?.notas && <small>{g.notas}</small>}</span>
          <span className="lnk">Cambiar</span>
        </button>
        <div className="it">
          <span className="ico"><Ico n="timer" /></span>
          <span className="tx"><b>Calentamiento general</b><small>Temporizador de 5 min · opcional</small></span>
          <Interruptor on={calentar} onCambio={setCalentar} etiqueta="Calentamiento general" />
        </div>
      </div>
      <button className="btn xl mt16" onClick={() => void empezar()}><Ico n="play" b />Empezar</button>
    </Hoja>
  )
}
