// Crear o editar un ejercicio propio (lo que no está en la lista). Solo el nombre es obligatorio: lo demás viene marcado.
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { guardarPropio } from '../../datos/acciones/propios'
import { leerPropio } from '../../datos/consultas'
import type { EjercicioPropio } from '../../datos/tipos'
import { catalogoCargado } from '../../catalogo/catalogo'
import { GRUPOS, idPropio, MATERIALES, parecido, REGISTROS, registroSugerido } from '../../catalogo/propios'
import { hoyISO } from '../../dominio/fechas'
import { elegirFoto, hacerFoto } from '../../plataforma'
import { cx, Elegir, Hoja, Ico, Interruptor, LARGO, useUnaVez, useUrlBlob } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { t } from '../../i18n'

const ICONO_REGISTRO: Record<EjercicioPropio['registro'], string> = { peso: 'barbell', corporal: 'repeat', tiempo: 'timer', cardio: 'person-simple-run' }

const nuevo = (nombre = ''): EjercicioPropio => ({
  id: idPropio(), nombre, grupo: 'completo', material: 'otro', registro: registroSugerido(nombre, 'otro'), rutinaAuto: false, creado: hoyISO(),
})

export function HojaPropio({ ruta }: { ruta: Ruta<'hoja-propio'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const unaVez = useUnaVez()
  const d = ruta.d
  // undefined: cargando · null: no existe (o se está creando uno nuevo).
  const guardado = useLiveQuery(async () => (d?.id ? (await leerPropio(d.id)) ?? null : null), [d?.id])
  const [p, setP] = useState<EjercicioPropio>(() => nuevo(d?.nombre))
  // Al crear, cómo se apunta sigue al nombre y al material hasta que el usuario lo elige él.
  const [registroTocado, setRegistroTocado] = useState(!!d?.id)
  // Al editar, «Foto y notas» empieza abierto si tiene algo; después lo abre y cierra el usuario.
  const [plegableAbierto, setPlegableAbierto] = useState(false)
  useEffect(() => {
    if (!guardado) return
    setP(guardado)
    setPlegableAbierto(!!guardado.foto || !!guardado.notas)
  }, [guardado])
  const fotoUrl = useUrlBlob(p.foto)

  const cambiar = (c: Partial<EjercicioPropio>) => setP(x => {
    const y = { ...x, ...c }
    return registroTocado ? y : { ...y, registro: registroSugerido(y.nombre, y.material) }
  })
  const otro = useMemo(() => parecido(p.nombre, catalogoCargado()?.ejercicios ?? [], p.id), [p.nombre, p.id])

  const guardar = unaVez(async () => {
    // Editando, hasta que llega el guardado se guardaría uno nuevo con otro id.
    if (d?.id && !guardado) return
    if (!p.nombre.trim()) { aviso(t('Ponle un nombre')); return }
    await guardarPropio(p)
    const nombre = p.nombre.trim()
    if (d?.vuelta) { nav.hoja('hoja-elegir-ejercicio', { ...d.vuelta, q: nombre }); aviso(t('Guardado: {nombre}. Tócalo para añadirlo.', { nombre })); return }
    nav.hoja(null)
    if (d?.id) aviso(t('Cambios guardados'))
    else aviso(t('Guardado: {nombre}', { nombre }), () => nav.ir('ficha', { id: p.id }), t('Ver'))
  })
  const ponerFoto = async (de: typeof hacerFoto) => { const f = await de(900); if (f) setP(x => ({ ...x, foto: f })) }
  const conMancuernas = p.registro === 'peso' && p.material === 'mancuernas'

  if (d?.id && guardado === null) return <Hoja titulo={t('Editar ejercicio')}><p className="muted">{t('No encontrado.')}</p></Hoja>
  return (
    <Hoja titulo={d?.id ? t('Editar ejercicio') : t('Crear ejercicio')} sub={t('Solo el nombre es obligatorio.')} className="tall">
      <label className="pr-campo" style={{ display: 'block', marginTop: 0 }}>
        <span className="lbl">{t('Nombre')}</span>
        <input className="inp pr-nombre" maxLength={LARGO.nombre} value={p.nombre} placeholder={t('Ej.: Remo con goma elástica')} autoComplete="off"
          onChange={e => cambiar({ nombre: e.target.value })} />
      </label>
      {otro && (
        <p className="note warn pr-parecido"><Ico n="info" /><span>{t('Se parece a «{nombre}», que ya está.', { nombre: otro.nombre })}
          <button className="lnk" onClick={() => { nav.hoja(null); nav.ir('ficha', { id: otro.id }) }}>{t('Ver ese')}</button></span></p>
      )}

      <div className="pr-campo"><span className="lbl">{t('¿Qué trabaja?')}</span>
        <Elegir opciones={GRUPOS.map(g => ({ v: g.v, t: t(g.t) }))} valor={p.grupo} onCambio={grupo => cambiar({ grupo })} /></div>
      <div className="pr-campo"><span className="lbl">{t('¿Con qué?')}</span>
        <Elegir opciones={MATERIALES.map(m => ({ v: m.v, t: t(m.t) }))} valor={p.material} onCambio={material => cambiar({ material })} /></div>

      <div className="pr-campo"><span className="lbl">{t('¿Cómo lo apuntas?')}</span>
        <div className="pr-regs" role="radiogroup" aria-label={t('¿Cómo lo apuntas?')}>
          {REGISTROS.map(r => (
            <button key={r.v} type="button" role="radio" aria-checked={p.registro === r.v} className={cx('pr-reg', p.registro === r.v && 'on')}
              onClick={() => { setRegistroTocado(true); setP(x => ({ ...x, registro: r.v })) }}>
              <Ico n={ICONO_REGISTRO[r.v]} /><span><b>{t(r.t)}</b><small>{t(r.ejemplo)}</small></span>
            </button>
          ))}
        </div>
        {conMancuernas && <p className="pr-hint"><Ico n="info" /><span>{t('Con mancuernas apuntas los kg de cada una.')}</span></p>}
      </div>

      <details className="fold mt16" open={plegableAbierto} onToggle={e => setPlegableAbierto(e.currentTarget.open)}>
        <summary><Ico n="camera" className="blue" />{t('Foto y notas')} <span className="muted" style={{ fontWeight: 400 }}>{t('(si quieres)')}</span><Ico n="caret-down" /></summary>
        <div className="in">
          {fotoUrl ? (
            <div className="pr-fotoprev">
              <span className="th m pr-foto"><img src={fotoUrl} alt="" /></span>
              <span className="tx"><b>{t('Foto puesta')}</b><small>{t('Sale en la lista y en su ficha.')}</small></span>
              <button type="button" className="lnk" onClick={() => setP(x => ({ ...x, foto: undefined }))}>{t('Quitar')}</button>
            </div>
          ) : (
            <div className="pr-fotos">
              <button type="button" className="btn ln sm" onClick={() => void ponerFoto(hacerFoto)}><Ico n="camera" />{t('Hacer foto')}</button>
              <button type="button" className="btn ln sm" onClick={() => void ponerFoto(elegirFoto)}><Ico n="image" />{t('De la galería')}</button>
            </div>
          )}
          <label className="pr-campo" style={{ display: 'block' }}><span className="lbl">{t('Notas para acordarte')}</span>
            <textarea className="inp" maxLength={LARGO.nota} value={p.notas ?? ''} placeholder={t('Goma verde atada a la espaldera, a la altura del pecho.')} onChange={e => setP(x => ({ ...x, notas: e.target.value }))} /></label>
          <div className="pr-sw card mt12">
            <span className="tx"><b>{t('La rutina automática puede proponerlo')}</b><small>{p.rutinaAuto ? t('Encendido: puede ponerlo en tu rutina como uno más de su grupo.') : t('Apagado: solo sale donde tú lo pongas.')}</small></span>
            <Interruptor on={p.rutinaAuto} onCambio={rutinaAuto => setP(x => ({ ...x, rutinaAuto }))} etiqueta={t('La rutina automática puede proponerlo')} />
          </div>
        </div>
      </details>

      <div className="pr-pie"><button className="btn" onClick={() => void guardar()}><Ico n="check" b />{d?.id ? t('Guardar cambios') : t('Guardar ejercicio')}</button></div>
    </Hoja>
  )
}
