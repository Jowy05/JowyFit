// PRO-01 · Semana («¿Voy bien?»)
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { datosSemana } from '../../datos/consultas'
import { nombreEjercicio } from '../../catalogo/catalogo'
import { num, kg, capital } from '../../dominio/formato'
import { deISO, diaMes, diaSemana, hoyISO, lunesDe, MESES_CORTOS, numeroSemana, semanaDe, sumarDias } from '../../dominio/fechas'
import { consejoQuincenal, resumenSemana } from '../../dominio/resumen'
import { datosQuincena, estadoEntrenos, estadoPicoteo, lineasSemaforo, mediasSemanales, pendienteSemanal, puntosSpark, recordsEn, subidas, type EstadoTarjeta } from '../../dominio/tendencias'
import { cx, estilo, Ico, Pantalla, Vacio } from '../../ui/componentes'
import { useNav } from '../../app/nav'
import { useAjustes, usePerfil, useRutina } from '../../datos/hooks'
import { CabProgreso } from './comun'
import { t, tk, tn } from '../../i18n'
import { tr } from '../../i18n/jsx'

function rango(dias: string[]): string {
  const a = deISO(dias[0]!), b = deISO(dias[6]!)
  return a.getMonth() === b.getMonth()
    ? t('{desde}-{hasta} {mes}', { desde: a.getDate(), hasta: b.getDate(), mes: MESES_CORTOS[b.getMonth()]! })
    : `${diaMes(a.getDate(), a.getMonth())} - ${diaMes(b.getDate(), b.getMonth())}`
}

const signo = (n: number, d = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n), d)}`

type Estado = EstadoTarjeta | 'neutro'
const PALABRA: Record<EstadoTarjeta, string> = { ok: tk('bien'), warn: tk('casi'), bad: tk('a mejorar'), nada: tk('sin datos') }
/** Estado de cada tarjeta con icono y palabra (un icono solo no se entiende). */
function Icono({ e, trofeo, texto }: { e: Estado; trofeo?: boolean; texto?: string }) {
  if (trofeo) return <span className="tag gold est"><Ico n="trophy" b />{texto ?? t('récord')}</span>
  if (e === 'neutro') return null
  if (e === 'nada') return <span className="tag est">{texto ?? t(PALABRA.nada)}</span>
  const ico = e === 'ok' ? 'check-circle' : e === 'warn' ? 'minus-circle' : 'x-circle'
  return <span className={cx('tag est', e)}><Ico n={ico} b />{texto ?? t(PALABRA[e])}</span>
}

const COLOR = { verde: 'ok', ambar: 'warn', rojo: 'bad' } as const

export function Semana() {
  const nav = useNav()
  const perfil = usePerfil()
  const ajustes = useAjustes()
  const rutina = useRutina()
  const hoy = hoyISO()
  const [atras, setAtras] = useState(0) // semanas hacia atrás
  const lunes = sumarDias(lunesDe(hoy), -7 * atras)
  const dias = semanaDe(lunes)
  const domingo = dias[6]!
  const inicio = ajustes.inicio ?? perfil.creado.slice(0, 10)
  const nSemana = numeroSemana(inicio, lunes)
  const primeraSemana = lunesDe([inicio, perfil.creado.slice(0, 10)].sort()[0]!)

  const datos = useLiveQuery(async () => {
    const d = await datosSemana(lunes, perfil)
    return { ...d, mediciones: d.mediciones.filter(m => m.fecha.slice(0, 10) <= domingo) }
  }, [lunes, domingo, perfil])

  const cab = (
    <CabProgreso actual="semana" crumb={atras === 0 ? t('Revisión del domingo') : t('Semanas anteriores')} />
  )
  const selector = (
    <div className="daysel">
      <button className={cx('ib', lunes <= primeraSemana && 'dim')} aria-label={t('Semana anterior')} disabled={lunes <= primeraSemana} onClick={() => setAtras(a => a + 1)}><Ico n="caret-left" /></button>
      <div><b>{t('Semana {n}', { n: Math.max(1, nSemana) })}</b><small>{atras === 0 ? t('Esta semana · {rango}', { rango: rango(dias) }) : rango(dias)}</small></div>
      <button className={cx('ib', atras === 0 && 'dim')} aria-label={t('Semana siguiente')} disabled={atras === 0} onClick={() => setAtras(a => Math.max(0, a - 1))}><Ico n="caret-right" /></button>
    </div>
  )

  if (!datos) return <Pantalla>{cab}<div className="pg">{selector}</div></Pantalla>

  const { sesiones, mediciones, comidas, pasos, energia } = datos
  const fijos = rutina ? rutina.dias.filter(d => !d.opcional).length : perfil.diasFijos.length
  const subidasSemana = subidas(sesiones).filter(s => dias.includes(s.fecha))
  const esperados = atras === 0 ? perfil.diasFijos.filter(d => d <= diaSemana(deISO(hoy))).length : undefined
  const enCurso = atras === 0 && hoy < domingo
  const r = resumenSemana({
    hoy: atras === 0 ? hoy : domingo,
    sesiones, fijos, mediciones, comidas, pasos,
    objetivoProteina: energia.proteina,
    objetivoPasos: perfil.pasosObjetivo,
    recordsSemana: recordsEn(sesiones, dias),
    subidasSemana: new Set(subidasSemana.map(s => s.ejercicio)).size,
    esperados,
  })
  const hayDatos = sesiones.some(s => dias.includes(s.fecha)) || mediciones.some(m => dias.includes(m.fecha.slice(0, 10)))
    || comidas.some(c => dias.includes(c.fecha)) || pasos.some(p => dias.includes(p.fecha))

  if (!hayDatos) return (
    <Pantalla>
      {cab}
      <div className="pg">
        {selector}
        <Vacio icono="chart-line-up" titulo={atras === 0 ? t('Tu semana aún está vacía') : t('Sin datos esa semana')}
          texto={t('Cuando entrenes, te peses o apuntes comidas, aquí verás en 10 segundos si vas bien.')}
          accion={<><Ico n="ruler" b />{t('Registrar medidas')}</>} onAccion={() => nav.ir('registrar')} />
      </div>
    </Pantalla>
  )

  // Tendencia de peso: medias semanales de las últimas 6 semanas.
  const medias = mediasSemanales(mediciones, m => m.pesoKg).filter(p => p.fecha <= lunes).slice(-6)
  const pendiente = pendienteSemanal(medias)
  const spark = puntosSpark(medias.map(p => p.valor))
  const ultSpark = spark[spark.length - 1]

  const q = datosQuincena({ domingo, mediciones, comidas })
  const consejo = consejoQuincenal({ ...q, objetivoProteina: energia.proteina, objetivo: perfil.objetivo })
  const corte = consejo.search(/[:.] /)
  const consejoT = corte > 0 ? consejo.slice(0, corte) + '.' : consejo
  const consejoD = corte > 0 ? capital(consejo.slice(corte + 2)) : ''

  const color = COLOR[r.semaforo]
  const estiloSem = r.semaforo === 'verde' ? undefined : estilo({ borderColor: `var(--${color})`, background: `linear-gradient(90deg,var(--${color}-t),transparent 85%),var(--surface)` })
  const mejorSubida = subidasSemana.reduce<(typeof subidasSemana)[number] | null>((a, b) => (!a || b.ahora - b.antes > a.ahora - a.antes ? b : a), null)

  const midio = mediciones.some(m => m.perimetros?.cintura != null && dias.includes(m.fecha.slice(0, 10)))
  const eCintura: Estado = r.cintura.delta == null || !midio ? 'nada' : r.cintura.delta <= 0 ? 'ok' : 'warn'
  // Mismo criterio que el semáforo: a mitad de semana solo cuentan los entrenos que ya tocaban.
  const entr = estadoEntrenos(r.entrenos, r.fijos, esperados)
  const eEntrenos: Estado = entr.estado
  const eProteina: Estado = r.proteina.media == null ? 'nada' : r.proteina.media >= r.proteina.objetivo * 0.9 ? 'ok' : r.proteina.media >= r.proteina.objetivo * 0.75 ? 'warn' : 'bad'
  const ePasos: Estado = r.pasos.media == null ? 'nada' : r.pasos.diasCumplidos >= 5 ? 'ok' : r.pasos.diasCumplidos >= 3 ? 'warn' : 'bad'
  const ePicoteo: Estado = estadoPicoteo(r.picoteo.dias, r.picoteo.anterior, r.proteina.media != null)
  const lineas = lineasSemaforo({ frase: r.frase, semaforo: r.semaforo, entrenos: r.entrenos, fijos: r.fijos, esperados, enCurso, bien: r.partes.bien, mal: r.partes.mal })
  // Semana 1 sin entrenos anteriores: aún no puede haber récords (llegan al repetir ejercicios).
  const sinHistorial = !sesiones.some(s => s.estado === 'hecha' && s.fecha < lunes)
  const entrenoSemana = sesiones.some(s => s.estado === 'hecha' && dias.includes(s.fecha))
  const fuerzaPronto = sinHistorial && r.records === 0 && r.subidas === 0
  const eFuerza: Estado = r.records > 0 || r.subidas > 0 ? 'ok' : entrenoSemana ? 'neutro' : 'nada'

  return (
    <Pantalla>
      {cab}
      <div className="pg">
        {selector}

        <div className="sem card" style={estiloSem}>
          <div className="lights" aria-hidden="true">
            <i className={cx('r', r.semaforo === 'rojo' && 'on')} style={r.semaforo === 'rojo' ? { boxShadow: '0 0 12px #E5534B' } : undefined} />
            <i className={cx('a', r.semaforo === 'ambar' && 'on')} style={r.semaforo === 'ambar' ? { boxShadow: '0 0 12px #F2B233' } : undefined} />
            <i className={cx('g', r.semaforo === 'verde' && 'on')} />
          </div>
          <div className="grow">
            <p className="sem-t" style={r.semaforo === 'verde' ? undefined : { color: `var(--${color})` }}>
              <Ico n={r.semaforo === 'verde' ? 'check-circle' : r.semaforo === 'ambar' ? 'minus-circle' : 'x-circle'} b />{r.titulo}
            </p>
            {lineas.map((l, i) => <p key={i} className={cx('sem-d', i > 0 && 'mt4')}>{l}.</p>)}
          </div>
        </div>
        {enCurso && <p className="small muted mt8"><Ico n="clock" /> {t('Semana en curso: el resumen definitivo, el domingo.')}</p>}

        <div className="grid2 mt12">
          <button className="card kpi st" onClick={() => nav.reemplazar('cuerpo')}>
            <span className="row jb"><span className="lbl">{t('Cintura')}</span><Icono e={eCintura} texto={eCintura === 'ok' ? t('bien') : eCintura === 'warn' ? t('sube') : undefined} /></span>
            <p className="k">{r.cintura.actual != null ? num(r.cintura.actual) : '—'}<small>cm</small></p>
            <p className="d">{!midio ? (r.cintura.actual != null ? t('sin medir esta semana') : t('mídete la cintura')) : r.cintura.delta != null ? tr('{cambio} esta semana', { cambio: <b className={cx(r.cintura.delta <= 0 && 'up')}>{signo(r.cintura.delta)}</b> }) : r.cintura.actual != null ? t('sin cambios medidos') : t('mídete la cintura')}</p>
          </button>
          <button className="card kpi st" onClick={() => nav.reemplazar('fuerza')}>
            <span className="row jb"><span className="lbl">{t('Fuerza')}</span>{!fuerzaPronto && <Icono e={eFuerza} trofeo={r.records > 0} />}</span>
            {fuerzaPronto ? (
              <>
                <p className="k pronto">{t('Aún pronto')}</p>
                <p className="d">{t('Los récords llegan cuando repites ejercicios')}</p>
              </>
            ) : (
              <>
                <p className="k">{r.records}<small>{tn(r.records, 'récord', 'récords')}</small></p>
                <p className="d">{mejorSubida ? t('+{kg} kg en {ejercicio}', { kg: kg(mejorSubida.ahora - mejorSubida.antes), ejercicio: nombreEjercicio(mejorSubida.ejercicio).toLowerCase() }) : r.subidas ? t('{n} subidas de peso', { n: r.subidas }) : t('sin subidas de peso')}</p>
              </>
            )}
          </button>
          <div className="card kpi st">
            <span className="row jb"><span className="lbl">{t('Entrenos')}</span><Icono e={eEntrenos} texto={eEntrenos === 'ok' ? (r.entrenos >= r.fijos ? t('hechos') : enCurso ? t('al día') : undefined) : undefined} /></span>
            <p className="k">{r.entrenos}<small>{t('de {n}', { n: r.fijos })}</small>{r.extra > 0 && <small>{t('+ {n} extra', { n: r.extra })}</small>}</p>
            <div className="pips mt8">
              {Array.from({ length: r.fijos }, (_, i) => <i key={i} className={cx(i < r.entrenos && 'on')} />)}
              {Array.from({ length: r.extra }, (_, i) => <i key={`x${i}`} className="ex" />)}
            </div>
          </div>
          <button className="card kpi st" onClick={() => nav.pestana('com')}>
            <span className="row jb"><span className="lbl">{t('Proteína')}</span><Icono e={eProteina} texto={eProteina === 'bad' ? t('baja') : undefined} /></span>
            <p className="k">{r.proteina.media != null ? Math.round(r.proteina.media) : '—'}<small>{t('g/día')}</small></p>
            <p className="d">{r.proteina.media != null ? t('objetivo {n} g', { n: r.proteina.objetivo }) : t('apunta tus comidas')}</p>
          </button>
          <button className="card kpi st" onClick={() => nav.ir('pasos')}>
            <span className="row jb"><span className="lbl">{t('Pasos')}</span><Icono e={ePasos} /></span>
            <p className="k">{r.pasos.media != null ? num(r.pasos.media, 0) : '—'}<small>{t('media')}</small></p>
            <p className="d">{r.pasos.media != null ? t('{n} de 7 días', { n: r.pasos.diasCumplidos }) : t('apunta tus pasos')}</p>
          </button>
          <button className="card kpi st" onClick={() => nav.pestana('com')}>
            <span className="row jb"><span className="lbl">{t('Picoteo')}</span><Icono e={ePicoteo} /></span>
            <p className="k">{r.proteina.media == null ? '—' : <>{r.picoteo.dias}<small>{tn(r.picoteo.dias, 'día', 'días')}</small></>}</p>
            <p className="d">{r.proteina.media == null ? t('apunta tus comidas') : t('semana pasada: {n}', { n: r.picoteo.anterior })}</p>
          </button>
          <button className="card kpi st span2 row" onClick={() => nav.reemplazar('cuerpo')}>
            <span className="grow">
              <span className="lbl">{t('Peso · tendencia')}</span>
              <p className="d">
                {medias.length >= 2
                  ? <>{num(medias[0]!.valor)} → <b className="mono">{num(medias[medias.length - 1]!.valor)} kg</b>{pendiente != null && ` · ${t('{n} kg/semana', { n: signo(pendiente) })}`}</>
                  : medias.length === 1 ? <><b className="mono">{num(medias[0]!.valor)} kg</b> · {t('pésate más semanas para ver la tendencia')}</> : t('Aún no hay pesajes')}
              </p>
            </span>
            {spark.length >= 2 && ultSpark && (
              <svg className="spark" viewBox="0 0 120 40" aria-hidden="true">
                <polyline points={spark.map(p => `${p.x},${p.y}`).join(' ')} className="sp-l" />
                <circle cx={ultSpark.x} cy={ultSpark.y} r="3.5" className="sp-d" />
              </svg>
            )}
          </button>
        </div>

        <div className="sec">
          <div className="card pd advice">
            <span className="row jb"><span className="lbl">{t('Consejo de la quincena')}</span><span className="tag blue">{t('Cada 2 semanas')}</span></span>
            <b className="adj-t">{consejoT}</b>
            {consejoD && <p className="small muted">{consejoD}</p>}
          </div>
        </div>
      </div>
    </Pantalla>
  )
}
