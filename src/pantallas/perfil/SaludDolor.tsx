// Salud con botones y dibujos: urgencias que bloquean la rutina, «¿Te duele algo?» (cuadrícula y tres toques por zona)
// y las condiciones como casillas. Se usan en el alta, en Perfil → Salud, en Generar y en «Me encuentro mal».
import { useCallback, useState } from 'react'
import type { CondicionSalud, Dolor, Perfil, Urgencia, ZonaDolor } from '../../datos/tipos'
import { imagenMusculo } from '../../catalogo/catalogo'
import { CONDICIONES, doloresDe, efectoDolor, URGENCIAS, ZONAS_DOLOR, zonaDolor } from '../../dominio/salud'
import { hoyISO } from '../../dominio/fechas'
import { Chip, cx, HojaSuelta, Ico } from '../../ui/componentes'
import { t, tk } from '../../i18n'

type PerfilSalud = Pick<Perfil, 'urgencias' | 'dolores' | 'zonasSensibles' | 'creado' | 'condicionesSalud'>
type Props = { p: PerfilSalud; cambia: (c: Partial<Perfil>) => void }

// Dónde va el punto en el icono de persona (fracciones del cuadro), para las articulaciones y molestias sin dibujo.
const PUNTOS: Partial<Record<ZonaDolor, [number, number][]>> = {
  cabeza: [[0.5, 0.2]], cuello: [[0.5, 0.335]], hombros: [[0.33, 0.37], [0.67, 0.37]], codos: [[0.28, 0.49], [0.72, 0.49]],
  munecas: [[0.245, 0.57], [0.755, 0.57]], manos: [[0.215, 0.635], [0.785, 0.635]], caderas: [[0.41, 0.6], [0.59, 0.6]],
  rodillas: [[0.405, 0.835], [0.595, 0.835]], tobillos: [[0.39, 0.915], [0.61, 0.915]], pies: [[0.35, 0.975], [0.65, 0.975]], estomago: [[0.5, 0.5]],
}
// El dibujo de RepDB de cada músculo (y de la lumbar).
const MUSCULO: Partial<Record<ZonaDolor, string>> = {
  lumbar: 'erector_spinae', pecho: 'pectoralis_major', espalda: 'latissimus_dorsi', brazo: 'biceps_brachii', abdomen: 'rectus_abdominis',
  gluteo: 'gluteus_maximus', muslo: 'quadriceps', isquio: 'hamstrings', gemelo: 'gastrocnemius',
}
// Icono de persona de Phosphor (MIT), el de la app, con el punto donde duele.
const PERSONA = 'M640 800c0 70.692-57.308 128-128 128s-128-57.308-128-128c0-70.692 57.308-128 128-128v0c70.692 0 128 57.308 128 128v0zM512 736c-35.346 0-64 28.654-64 64s28.654 64 64 64c35.346 0 64-28.654 64-64v0c0-35.346-28.654-64-64-64v0zM873.36 423.8l-180.68 204.88c-23.568 26.622-57.827 43.32-95.986 43.32-0.005 0-0.010 0-0.015 0h-169.359c-0.004 0-0.009 0-0.014 0-38.159 0-72.418-16.698-95.869-43.185l-0.117-0.135-180.68-204.88c-14.099-14.411-22.799-34.154-22.799-55.929 0-44.183 35.817-80 80-80 21.477 0 40.977 8.463 55.347 22.236l-0.028-0.027 65.2 52.32-66.16-251.52c-4.508-9.704-7.138-21.065-7.138-33.040 0-44.204 35.834-80.038 80.038-80.038 32.229 0 60.008 19.049 72.694 46.502l0.206 0.496 104 179.48 104-179.48c13.32-26.749 40.472-44.804 71.842-44.804 44.183 0 80 35.817 80 80 0 11.148-2.28 21.764-6.4 31.406l0.198-0.522-66 251.52 65.2-52.32c14.342-13.746 33.842-22.209 55.319-22.209 44.183 0 80 35.817 80 80 0 21.775-8.7 41.518-22.813 55.943l0.014-0.014zM827.32 356.72c-2.896-2.899-6.899-4.693-11.32-4.693s-8.424 1.793-11.32 4.692v0c-0.84 0.8-1.68 1.6-2.6 2.32l-142.080 113.92c-5.42 4.356-12.384 6.991-19.963 6.991-17.673 0-32-14.327-32-32 0-2.825 0.366-5.565 1.053-8.174l-0.050 0.223 91.52-348c0.534-2.080 1.191-3.877 2-5.588l-0.080 0.188c1.007-2.036 1.597-4.433 1.597-6.967 0-8.837-7.163-16-16-16-6.463 0-12.031 3.832-14.556 9.348l-0.041 0.1c-0.458 1.007-0.899 1.834-1.383 2.631l0.063-0.111-132.48 228.4c-5.643 9.601-15.921 15.943-27.68 15.943s-22.037-6.343-27.598-15.793l-0.082-0.15-132.32-228.2c-0.421-0.686-0.862-1.513-1.256-2.365l-0.064-0.155c-1.821-3.843-5.013-6.789-8.929-8.244l-0.111-0.036c-1.637-0.619-3.53-0.977-5.506-0.977-8.837 0-16 7.163-16 16 0 2.461 0.555 4.791 1.548 6.874l-0.041-0.097c0.729 1.523 1.386 3.32 1.872 5.185l0.048 0.215 91.4 347.8c0.637 2.386 1.003 5.126 1.003 7.951 0 17.673-14.327 32-32 32-7.579 0-14.544-2.635-20.026-7.039l0.062 0.048-142.080-113.92c-0.92-0.72-1.76-1.52-2.6-2.32-2.922-3.076-7.042-4.99-11.609-4.99-8.837 0-16 7.163-16 16 0 4.557 1.905 8.67 4.963 11.584l0.006 0.006c0.48 0.48 0.92 0.96 1.36 1.48l181.28 205.56c11.783 13.299 28.905 21.64 47.975 21.64 0.009 0 0.017 0 0.026 0h169.359c0.007 0 0.016 0 0.025 0 19.070 0 36.192-8.341 47.917-21.573l0.058-0.067 181.28-205.56c0.44-0.52 0.88-1 1.36-1.48 2.887-2.894 4.673-6.889 4.673-11.3s-1.785-8.406-4.673-11.3v0z'

export function DibujoZona({ zona }: { zona: ZonaDolor }) {
  const musculo = MUSCULO[zona]
  const img = musculo ? imagenMusculo(musculo) : undefined
  if (img) return <img src={img} alt="" loading="lazy" />
  const puntos = PUNTOS[zona]
  if (puntos) return (
    <span className="g2-ic">
      <svg className="g2-body" viewBox="0 0 1024 1024" aria-hidden="true">
        <path transform="matrix(1 0 0 -1 0 960)" d={PERSONA} />
        {puntos.map(([x, y], i) => <circle key={i} cx={x * 1024} cy={y * 1024} r={62} />)}
      </svg>
    </span>
  )
  return <span className="g2-ic"><Ico n={zonaDolor(zona)?.ico ?? 'warning-circle'} /></span>
}

/** Las preguntas de urgencia, con botón «No, ninguna». */
export function Urgencias({ valor, onCambio }: { valor: Urgencia[]; onCambio: (u: Urgencia[]) => void }) {
  const alternar = (u: Urgencia) => onCambio(valor.includes(u) ? valor.filter(x => x !== u) : [...valor, u])
  return (
    <>
      <div className="g2-big mt12">
        {URGENCIAS.map(u => {
          const on = valor.includes(u.v)
          return (
            <button key={u.v} className={cx('g2-bb', on && 'on')} role="checkbox" aria-checked={on} onClick={() => alternar(u.v)}>
              <Ico n={u.v === 'pecho' ? 'heartbeat' : u.v === 'mareo' ? 'spiral' : u.v === 'aire' ? 'wind' : 'heart-half'} />
              <span className="tx grow"><b>{t(u.t)}</b>{u.d && <small>{t(u.d)}</small>}</span>
              <span className="box"><Ico n="check" b /></span>
            </button>
          )
        })}
      </div>
      <p className="note warn mt12"><Ico n="phone" /><span>{t('Si te pasa ahora mismo y es fuerte, llama al 112.')}</span></p>
    </>
  )
}

/** «Hoy no entrenes»: con una urgencia marcada no hay rutina hasta que se desmarque. `onVale`: para cerrar (en una hoja). */
export function BloqueoUrgencia({ onEquivocado, onVale }: { onEquivocado: () => void; onVale?: () => void }) {
  return (
    <div className="g2-stop">
      <span className="empty-ic bad"><Ico n="first-aid" /></span>
      <h1>{t('Hoy no entrenes')}</h1>
      <p className="big">{t('Si te pasa ahora y es fuerte, llama al 112.')}</p>
      <p className="muted mt8">{t('No te propondremos rutina hasta que lo desmarques en Perfil → Salud, cuando tu médico te dé el visto bueno.')}</p>
      <div className="foot">
        <a className="btn badf" href="tel:112"><Ico n="phone" b />{t('Llamar al 112')}</a>
        {onVale && <button className="btn" onClick={onVale}>{t('Entendido')}</button>}
        <button className="btn gry" onClick={onEquivocado}>{t('Me he equivocado')}</button>
      </div>
    </div>
  )
}

const PESTANAS = [{ v: 'art', t: tk('Articulaciones') }, { v: 'mus', t: tk('Músculos') }, { v: 'otr', t: tk('Otras molestias') }] as const

/** «¿Te duele algo?»: la cuadrícula de dibujos; al tocar una zona, sus tres preguntas. */
export function Dolores({ p, cambia }: Props) {
  const [pestana, setPestana] = useState<'art' | 'mus' | 'otr'>('art')
  const [abierta, setAbierta] = useState<ZonaDolor | null>(null)
  const cerrar = useCallback(() => setAbierta(null), [])
  const dolores = doloresDe(p)
  const guardar = (d: Dolor | null, zona: ZonaDolor) => {
    const resto = dolores.filter(x => x.zona !== zona)
    // Las zonas sensibles de antes pasan a ser molestias: se vacían para no contarlas dos veces.
    cambia({ dolores: d ? [...resto, d] : resto, zonasSensibles: [] })
    setAbierta(null)
  }
  return (
    <>
      <div className="segc mt8" role="tablist">
        {PESTANAS.map(x => <button key={x.v} role="tab" aria-selected={pestana === x.v} className={cx(pestana === x.v && 'on')} onClick={() => setPestana(x.v)}>{t(x.t)}</button>)}
      </div>
      <div className="g2-grid mt12">
        {ZONAS_DOLOR.filter(z => z.grupo === pestana).map(z => {
          const d = dolores.find(x => x.zona === z.v)
          return (
            <button key={z.v} className={cx('mq', d && 'on')} aria-haspopup="dialog" aria-label={d ? `${t(z.t)}: ${t(CUANTO_TXT[d.cuanto])}` : t(z.t)} onClick={() => setAbierta(z.v)}>
              <span className="th"><DibujoZona zona={z.v} /></span>
              <span className="ck"><Ico n="check" b /></span>
              <b>{t(z.t)}</b>
              {d && <small>{t(CUANTO_TXT[d.cuanto])}</small>}
            </button>
          )
        })}
      </div>
      {abierta && <EditorDolor zona={abierta} actual={dolores.find(x => x.zona === abierta)} onGuardar={d => guardar(d, abierta)} onCerrar={cerrar} />}
    </>
  )
}

const CUANTO_TXT = { poco: tk('Poco'), regular: tk('Regular'), mucho: tk('Mucho') } as const
const CUANDO_TXT = { siempre: tk('Siempre'), fuerza: tk('Al hacer fuerza'), aveces: tk('A veces') } as const
const DESDE_TXT = { dias: tk('Días'), semanas: tk('Semanas'), meses: tk('Meses o más') } as const

/**
 * Los tres toques de una zona (cuánto, cuándo, desde cuándo) y qué hará la rutina. Va sobre el marco de la app (no
 * dentro de la pantalla, que se desplaza): si no, la hoja se iba con el scroll.
 */
function EditorDolor({ zona, actual, onGuardar, onCerrar }: { zona: ZonaDolor; actual?: Dolor; onGuardar: (d: Dolor | null) => void; onCerrar: () => void }) {
  const [d, setD] = useState<Dolor>(actual ?? { zona, cuanto: 'poco', cuando: 'aveces', desde: 'dias', inicio: hoyISO() })
  const efecto = efectoDolor(d)
  const z = zonaDolor(zona)
  const pregunta = <K extends 'cuanto' | 'cuando' | 'desde'>(k: K, titulo: string, ops: Record<Dolor[K], string>) => (
    <div className="g2-q">
      <span className="lbl">{titulo}</span>
      <div className="chips eq">{(Object.keys(ops) as Dolor[K][]).map(v => <Chip key={v} on={d[k] === v} onClick={() => setD(x => ({ ...x, [k]: v }))}>{t(ops[v])}</Chip>)}</div>
    </div>
  )
  const nombre = z ? t(z.t) : zona
  return (
    <HojaSuelta etiqueta={nombre} onCerrar={onCerrar}
      cabecera={<div className="grow g2-zh"><span className="th"><DibujoZona zona={zona} /></span><div><h2>{nombre}</h2><p className="sub">{t('Tres toques y listo')}</p></div></div>}>
      {pregunta('cuanto', t('¿Cuánto te duele?'), CUANTO_TXT)}
      {pregunta('cuando', t('¿Cuándo?'), CUANDO_TXT)}
      {pregunta('desde', t('¿Desde cuándo?'), DESDE_TXT)}
      <div className="sec">
        <span className="lbl">{t('Qué hará tu rutina')}</span>
        <p className={cx('note mt8', efecto.tono)}><Ico n={efecto.tono === 'bad' ? 'warning' : 'info'} /><span>{efecto.texto}</span></p>
      </div>
      <div className="btns mt16">
        {actual && <button className="btn gry sm" onClick={() => onGuardar(null)}>{t('Ya no me duele')}</button>}
        <button className="btn sm" onClick={() => onGuardar(d)}>{t('Guardar')}</button>
      </div>
    </HojaSuelta>
  )
}

/** «¿Tienes algo de esto?»: casillas que dicen qué cambia al marcarlas. */
export function Condiciones({ p, cambia }: Props) {
  const marcadas = p.condicionesSalud ?? []
  const alternar = (c: CondicionSalud) => cambia({ condicionesSalud: marcadas.includes(c) ? marcadas.filter(x => x !== c) : [...marcadas, c] })
  return (
    <>
      <div className="list g2-cas mt8">
        {CONDICIONES.map(c => {
          const on = marcadas.includes(c.v)
          return (
            <button key={c.v} className={cx('it', on && 'on')} role="checkbox" aria-checked={on} onClick={() => alternar(c.v)}>
              <span className={cx('casilla', on && 'on')}><Ico n="check" b /></span>
              <span className="tx"><b>{t(c.t)}</b><small className="efecto">{t(c.d)}</small></span>
            </button>
          )
        })}
      </div>
      {marcadas.includes('embarazo') && <p className="note warn mt8"><Ico n="warning" /><span>{t('Antes de seguir, consúltalo con tu médico o tu matrona. Hasta entonces, no hay plan normal.')}</span></p>}
      <p className="small muted mt8">{t('Esto no es consejo médico. Si tienes una lesión o una condición, consulta a un profesional.')}</p>
    </>
  )
}
