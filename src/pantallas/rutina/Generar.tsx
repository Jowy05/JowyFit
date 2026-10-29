// RUT-03 · Generar rutina (también la rutina definitiva tras la semana de prueba)
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { sesionesHechasDeRutina } from '../../datos/consultas'
import { activarRutina } from '../../datos/acciones/rutina'
import type { Rutina } from '../../datos/tipos'
import { catalogoCargado, ejercicio, nombreEjercicio } from '../../catalogo/catalogo'
import { ES_MAQUINA } from '../../catalogo/clasificacion'
import { cambiosRutina, generarRutina, nombreZona, rutinaDefinitiva, tiemposReales } from '../../dominio/generador'
import { Cab, FilaInterruptor, Ico, Pantalla, useUnaVez } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useAjustes, useGimnasio, useMarcas, usePerfil, usePerfilCargado, useRutina } from '../../datos/hooks'
import { guardarPerfil } from '../../datos/repos'
import { NOMBRE_NO_QUIERO } from '../../catalogo/grupos'
import { NOMBRE_PATRON } from '../../catalogo/clasificacion'
import { proponerModoMayor } from '../../dominio/modoMayor'
import { resumenSalud, rutinaBloqueada } from '../../dominio/salud'
import { hoyISO } from '../../dominio/fechas'
import { BloqueoUrgencia } from '../perfil/SaludDolor'
import { abrevDia, listaDias, tituloDia } from './comun'
import { filas, minutosDia } from '../../dominio/rutina'
import { capital } from '../../dominio/formato'
import { t, tk, tn } from '../../i18n'
import { tr } from '../../i18n/jsx'
import { NOMBRE_OBJETIVO } from '../../dominio/objetivos'

const GUSTOS = { maquinas: tk('Máquinas y poleas'), libre: tk('Peso libre'), mezcla: tk('Mezcla') }

export function Generar({ ruta }: { ruta: Ruta<'generar-rutina'> }) {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const g = useGimnasio()
  const marcas = useMarcas()
  const actual = useRutina()
  const ajustes = useAjustes()
  const definitiva = !!ruta.d?.definitiva
  const [variante, setVariante] = useState(0)
  const [evitar, setEvitar] = useState<Set<string>>(new Set())
  const calib = useLiveQuery(async () => (definitiva && actual?.id ? sesionesHechasDeRutina(actual.id) : []), [definitiva, actual?.id]) ?? []
  const evitados = [...marcas.values()].filter(m => m.odiado || m.duele)
  // Semana de prueba: la primera rutina siempre; al rehacerla, se mantiene si la actual aún estaba en prueba. Se puede cambiar.
  const [conPrueba, setConPrueba] = useState<boolean | null>(null)
  const prueba = !definitiva && (conPrueba ?? (!actual || actual.calibracion))
  // Al generar: primero la propuesta del modo mayor (si toca) y después «¿Qué no quieres hacer?» (la primera vez).
  const cargado = usePerfilCargado()
  useEffect(() => {
    if (!cargado || definitiva || rutinaBloqueada(cargado)) return
    if (proponerModoMayor(cargado, hoyISO())) nav.hoja('hoja-modo-mayor')
    else if (cargado.noQuiero === undefined) nav.hoja('hoja-no-quiero')
  }, [cargado?.modoMayor, cargado?.noQuiero === undefined, definitiva])
  const [sinCubrirVisto, setSinCubrirVisto] = useState(false)

  // actual?.id va en las dependencias: la rutina activa llega después del primer cálculo.
  const propuesta = useMemo<Omit<Rutina, 'id'> | null>(() => {
    const c = catalogoCargado()
    if (!c) return null
    const tiempos = definitiva ? tiemposReales(calib) : undefined
    // La definitiva sale de la rutina de prueba (con lo que cambiaste a mano), ajustada a tus tiempos reales.
    if (definitiva && actual) return rutinaDefinitiva(actual, { perfil, tiempos, compuesto: id => ejercicio(id)?.mecanica === 'compound' })
    return generarRutina({ perfil, gimnasio: g ?? null, marcas, ejercicios: c.ejercicios, calibracion: prueba, evitar, tiempos, descansos: { compuesto: ajustes.descansoCompuesto, aislamiento: ajustes.descansoAislamiento } })
  }, [perfil, g?.id, g?.material.length, marcas.size, variante, definitiva, calib.length, actual?.id, prueba, ajustes.descansoCompuesto, ajustes.descansoAislamiento])
  const cambios = definitiva && actual && propuesta ? cambiosRutina(actual, propuesta, nombreEjercicio, tituloDia) : []

  // Un doble toque no guarda dos rutinas.
  const unaVez = useUnaVez()
  const guardarPropuesta = async (): Promise<boolean> => {
    if (!propuesta) return false
    try {
      await activarRutina(propuesta)
    } catch {
      aviso(t('No se ha podido guardar la rutina. Inténtalo otra vez'))
      return false
    }
    aviso(definitiva ? t('Rutina definitiva guardada') : t('Rutina guardada'))
    nav.raiz('rut')
    return true
  }
  const usar = unaVez(guardarPropuesta)
  const ajustar = unaVez(async () => { if (await guardarPropuesta()) nav.ir('editar-plan', undefined, 'rut') })
  const otra = () => {
    if (!propuesta) return
    setEvitar(new Set(propuesta.dias.flatMap(d => d.bloques.map(b => b.ejercicio))))
    setVariante(v => (v + 1) % 3)
    aviso(t('Variante {n} de 3 lista', { n: ((variante + 1) % 3) + 1 }))
  }
  const enMaquina = propuesta ? propuesta.dias.flatMap(d => d.bloques).filter(b => { const e = ejercicio(b.ejercicio); return e && ES_MAQUINA(e) }).length : 0
  const total = propuesta ? propuesta.dias.flatMap(d => d.bloques).length : 0

  if (rutinaBloqueada(perfil)) return (
    <Pantalla><BloqueoUrgencia onEquivocado={() => void guardarPerfil({ urgencias: [] })} /></Pantalla>
  )
  const objetivos = [perfil.objetivo, ...(perfil.objetivosExtra ?? [])].map(o => t(NOMBRE_OBJETIVO[o]))
  const sinCubrir = !sinCubrirVisto ? propuesta?.sinCubrir ?? [] : []

  return (
    <Pantalla>
      <Cab atras crumb={t('Mi plan')} titulo={definitiva ? t('Tu rutina definitiva') : actual ? t('Rutina nueva') : t('Crear tu rutina')} sub={definitiva ? t('Ajustada a tus tiempos reales de la semana de prueba.') : actual ? t('Mírala con calma: tu rutina actual no cambia hasta que pulses «Usar esta rutina».') : t('Revisa tus datos, mira la propuesta y decide.')} />
      <div className="pg">
        <div className="sec">
          <div className="sec-h"><h2><span className="stepn">1</span>{t('Tus datos')}</h2><span className="lbl">{t('Toca para cambiar')}</span></div>
          <div className="spec-box"><div className="spec ed">
            <p onClick={() => nav.ir('seccion-perfil', { s: 'horario' })}><span>{t('Días')}</span><b className="ux-rut-wrap">{capital(listaDias(perfil.diasFijos)) || '—'}<Ico n="pencil-simple" className="pen" /></b></p>
            <p onClick={() => nav.ir('seccion-perfil', { s: 'horario' })}><span>{t('Día extra')}</span><b>{capital(listaDias(perfil.diasOpcionales)) || t('Ninguno')}<Ico n="pencil-simple" className="pen" /></b></p>
            <p onClick={() => nav.ir('seccion-perfil', { s: 'horario' })}><span>{t('Tiempo')}</span><b>{t('{min} min · con prisa {corta}', { min: perfil.minutosNormal, corta: perfil.minutosCorta })}<Ico n="pencil-simple" className="pen" /></b></p>
            <p onClick={() => nav.ir('gimnasios')}><span>{t('Gimnasio')}</span><b>{g ? `${g.nombre} · ${g.material.length}` : t('Sin gimnasio')}<Ico n="pencil-simple" className="pen" /></b></p>
            <p onClick={() => nav.ir('seccion-perfil', { s: 'objetivos' })}><span>{t('Objetivo')}</span><b className="ux-rut-wrap">{objetivos.join(' · ')}<Ico n="pencil-simple" className="pen" /></b></p>
            <p onClick={() => nav.ir('seccion-perfil', { s: 'objetivos' })}><span>{t('Reforzar')}</span><b>{perfil.zonasPrioridad.map(nombreZona).join(' · ') || t('Equilibrado')}<Ico n="pencil-simple" className="pen" /></b></p>
            <p onClick={() => nav.ir('seccion-perfil', { s: 'preferencias' })}><span>{t('Gustos')}</span><b>{t(GUSTOS[perfil.preferencia])}<Ico n="pencil-simple" className="pen" /></b></p>
            <p onClick={() => nav.ir('seccion-perfil', { s: 'salud' })}><span>{t('Molestias')}</span><b className="ux-rut-wrap">{resumenSalud(perfil) || t('Ninguna')}<Ico n="pencil-simple" className="pen" /></b></p>
            <p onClick={() => nav.hoja('hoja-no-quiero')}><span>{t('No quieres')}</span><b className="ux-rut-wrap">{perfil.noQuiero?.length ? perfil.noQuiero.map(g => t(NOMBRE_NO_QUIERO[g])).join(' · ') : t('Nada')}<Ico n="pencil-simple" className="pen" /></b></p>
            <p onClick={() => nav.ir('biblioteca', { filtro: 'evitados' })}><span>{t('Evitar')}</span><b>{evitados.length ? tn(evitados.length, '{n} ejercicio', '{n} ejercicios') : t('Nada')}<Ico n="pencil-simple" className="pen" /></b></p>
          </div></div>
        </div>

        {sinCubrir.length > 0 && (
          <div className="note warn mt12">
            <Ico n="warning-circle" />
            <span>
              {t('Sin {grupos} no queda ningún ejercicio para: {huecos}.', { grupos: (perfil.noQuiero ?? []).map(g => t(NOMBRE_NO_QUIERO[g]).toLowerCase()).join(', '), huecos: sinCubrir.map(h => t(NOMBRE_PATRON[h as keyof typeof NOMBRE_PATRON] ?? h).toLowerCase()).join(', ') })}
              <span className="btns mt8">
                {(perfil.noQuiero ?? []).map(g => <button key={g} className="btn sm" onClick={() => void guardarPerfil({ noQuiero: (perfil.noQuiero ?? []).filter(x => x !== g) })}>{t('Volver a poner {grupo}', { grupo: t(NOMBRE_NO_QUIERO[g]).toLowerCase() })}</button>)}
                <button className="btn gry sm" onClick={() => setSinCubrirVisto(true)}>{t('Seguir sin él')}</button>
              </span>
            </span>
          </div>
        )}
        {propuesta && (
          <div className="sec">
            <div className="sec-h"><h2><span className="stepn">2</span>{t('Propuesta')}</h2><span className="tag blue">{t('Variante {n} de 3', { n: variante + 1 })}</span></div>
            <div className="card prev">
              {propuesta.dias.map(d => (
                <div key={d.letra} className="prev-d">
                  <span className={d.dia != null ? 'dl ux-rut-dl' : 'dl'}>{abrevDia(d)}</span>
                  <p>
                    {filas(d.bloques).map((f, k) => <span key={k}>{k > 0 && ' · '}{Array.isArray(f) ? <><em>{t('Dos seguidos')}</em> {nombreEjercicio(f[0].ejercicio)} + {nombreEjercicio(f[1].ejercicio)}</> : nombreEjercicio(f.ejercicio)}</span>)}
                    <span className="muted"> · ~{minutosDia(d)} min</span>
                  </p>
                </div>
              ))}
            </div>
            {definitiva && (
              <div className="why mt12">
                <p className="lbl">{t('Qué cambia')}</p>
                {cambios.length ? cambios.map(x => <p key={x}><Ico n="arrow-right" /><span>{x}</span></p>) : <p><Ico n="check-circle" /><span>{t('Nada que quitar: te da tiempo a todo.')}</span></p>}
              </div>
            )}
            <div className="why mt12">
              <p className="lbl">{t('Por qué')}</p>
              {propuesta.porque.map(x => <p key={x}><Ico n="check-circle" /><span>{x}</span></p>)}
              {perfil.preferencia === 'maquinas' && <p><Ico n="check-circle" /><span>{tr('Prefieres máquinas → {cuantos}', { cuantos: <b>{t('{n} de {total} en máquina o polea', { n: enMaquina, total })}</b> })}</span></p>}
            </div>
            {propuesta.dias.some(d => d.bloques.some(b => b.superserie)) && <p className="small muted mt8">{t('{nombre}: haces uno y luego el otro, {explica}; descansas al acabar los dos.', { nombre: t('Dos seguidos'), explica: t('sin descanso entre los dos') })}</p>}
            <p className="note ok mt16"><Ico n="shield-check" /><span>{actual && !definitiva ? <>{tr('Si pulsas «Usar esta rutina», <b>sustituye a la que tienes ahora</b>.', { b: x => <b>{x}</b> })} </> : null}{tr('<b>Tu historial y tus récords se conservan siempre.</b> Solo cambia el plan.', { b: x => <b>{x}</b> })}</span></p>
          </div>
        )}
        {!definitiva && (
          <div className="list mt12">
            <FilaInterruptor ico="gauge" titulo={t('Empezar con una semana de prueba')} d={t('3 entrenos con pesos cómodos; luego te propongo la rutina definitiva con tus tiempos reales.')} on={prueba} onCambio={v => setConPrueba(v)} />
          </div>
        )}
        <div className="dock col">
          <button className="btn" onClick={() => void usar()}>{t('Usar esta rutina')}</button>
          <div className="btns">
            {!definitiva && <button className="btn gry sm" onClick={otra}>{t('Otra variante')}</button>}
            <button className="btn ln sm" onClick={() => void ajustar()}>{t('Ajustar a mano')}</button>
          </div>
        </div>
      </div>
    </Pantalla>
  )
}
