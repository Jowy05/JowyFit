// ALT · Alta de usuario (primera vez). Pasos cortos; casi todo se puede saltar y cambiar después.
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { db } from '../../../datos/db'
import { gimnasioNuevo, guardarAjustes, guardarPerfil, perfilPorDefecto } from '../../../datos/repos'
import { importar } from '../../../datos/copias'
import type { Dia, Gimnasio, Medicion, Perfil, Zona } from '../../../datos/tipos'
import { catalogoCargado } from '../../../catalogo/catalogo'
import { generarRutina, duracionDia } from '../../../dominio/generador'
import { DIAS, DIAS_CORTOS, hoyISO } from '../../../dominio/fechas'
import { elegirArchivo } from '../../../plataforma'
import { cx, Elegir, Ico, Interruptor, Stepper } from '../../comp'
import { useAviso } from '../../aviso'
import { CatalogoMaterial, ejerciciosDisponibles, PesosGimnasio } from '../rutina/CatalogoMaterial'

const TOTAL = 10

export function Alta() {
  const aviso = useAviso()
  const [paso, setPaso] = useState(1)
  const [p, setP] = useState<Perfil>(perfilPorDefecto())
  const [cuerpo, setCuerpo] = useState({ peso: 75, cintura: 90, cuello: 38, cadera: 0, pecho: 0, brazo: 0, brazoContraido: 0, muslo: 0 })
  const [gym, setGym] = useState<Gimnasio>(gimnasioNuevo())
  const [resumen, setResumen] = useState<{ estructura: string; dias: string[] } | null>(null)
  const cambia = (c: Partial<Perfil>) => setP(x => ({ ...x, ...c }))
  const sig = () => setPaso(n => Math.min(TOTAL, n + 1))
  const atras = () => setPaso(n => Math.max(1, n - 1))

  const importarCopia = async () => {
    const f = await elegirArchivo()
    if (!f) return
    try {
      const tipo = await importar(f.bytes)
      if (tipo === 'copia') { aviso('Copia restaurada'); return } // la app se recarga sola al ver el perfil
      const guardado = await db.perfil.get('yo')
      if (guardado) setP({ ...guardado, altaCompleta: false })
      const ult = (await db.mediciones.toArray()).sort((a, b) => b.fecha.localeCompare(a.fecha))
      const peso = ult.find(m => m.pesoKg != null)?.pesoKg
      const per = ult.find(m => m.perimetros?.cintura)?.perimetros
      setCuerpo(c => ({ ...c, peso: peso ?? c.peso, cintura: per?.cintura ?? c.cintura, cuello: per?.cuello ?? c.cuello, cadera: per?.cadera ?? 0, pecho: per?.pecho ?? 0, brazo: per?.brazo ?? 0, brazoContraido: per?.brazoContraido ?? 0, muslo: per?.muslo ?? 0 }))
      aviso('Datos importados: revísalos y sigue')
      setPaso(2)
    } catch (e) {
      aviso(`No se pudo importar: ${String((e as Error).message ?? e)}`)
    }
  }

  const terminar = useCallback(async () => {
    const hoy = hoyISO()
    const gymId = await db.gimnasios.add({ ...gym, creado: new Date().toISOString() })
    const perfil = await guardarPerfil({ ...p, altaCompleta: false })
    const yaHay = (await db.mediciones.count()) > 0
    if (!yaHay) {
      const per = Object.fromEntries(Object.entries({ cintura: cuerpo.cintura, cuello: cuerpo.cuello, cadera: cuerpo.cadera, pecho: cuerpo.pecho, brazo: cuerpo.brazo, brazoContraido: cuerpo.brazoContraido, muslo: cuerpo.muslo }).filter(([, v]) => v > 0))
      const m: Medicion = { fecha: `${hoy}T${new Date().toTimeString().slice(0, 5)}`, origen: 'manual', pesoKg: cuerpo.peso, perimetros: per }
      await db.mediciones.add(m)
    }
    const c = catalogoCargado()
    const rutina = generarRutina({ perfil, gimnasio: { ...gym, id: gymId }, marcas: new Map(), ejercicios: c?.ejercicios ?? [], calibracion: true })
    await db.rutinas.add(rutina)
    await guardarAjustes({ gimnasioActivo: gymId, inicio: hoy })
    setResumen({
      estructura: `${rutina.estructura} · ~${p.minutosNormal} min`,
      dias: rutina.dias.map(d => `${d.letra === 'S' ? 'Opcional' : d.letra} · ${d.dia != null ? DIAS[d.dia] : ''}|${d.bloques.length} ejercicios · ~${Math.round(duracionDia(d.bloques) / 60)} min`),
    })
  }, [gym, p, cuerpo])

  const fin = async () => { await guardarPerfil({ altaCompleta: true }) }

  if (paso === 1) return (
    <section className="screen" data-full="">
      <div className="alt">
        <div className="alt-hero">
          <div className="brand"><span className="brand-ic"><Ico n="barbell" b /></span><span>JOWYFIT</span></div>
          <h1 className="alt-h">Tu fuerza y tu comida, en una ficha clara.</h1>
          <p className="alt-p">Ves qué toca hoy y con qué peso, apuntas cada serie en segundos y el domingo sabes si vas bien.</p>
        </div>
        <div className="alt-body">
          <div className="spec-box"><div className="spec flat">
            <p><span><Ico n="arrows-clockwise" className="blue" /> Rutina</span><b>automática</b></p>
            <p><span><Ico n="timer" className="blue" /> Apuntar una serie</span><b>&lt; 5 s</b></p>
            <p><span><Ico n="wifi-slash" className="blue" /> Internet</span><b>no hace falta</b></p>
            <p><span><Ico n="user-circle" className="blue" /> Cuentas</span><b>ninguna</b></p>
          </div></div>
          <p className="note plain mt16"><Ico n="lock-simple" /><span><b>Tus datos se quedan en este móvil.</b> Nada se sube a ningún sitio.</span></p>
        </div>
        <div className="alt-foot col">
          <button className="btn xl" onClick={sig}>Empezar <Ico n="arrow-right" b /></button>
          <button className="btn ln sm" onClick={importarCopia}>Tengo una copia: importar</button>
        </div>
      </div>
    </section>
  )

  if (paso === TOTAL) return (
    <Paso n={TOTAL} titulo={resumen ? 'Tu rutina está lista' : 'Creando tu rutina…'} sinAtras pie={resumen ? <button className="btn xl" onClick={fin}>Ir a Inicio <Ico n="arrow-right" b /></button> : null}>
      {!resumen ? <Generando onListo={terminar} p={p} /> : (
        <>
          <div className="bar thick go mt12"><i style={{ width: '100%' }} /></div>
          <div className="card ready mt16" style={{ animation: 'none' }}>
            <div className="ready-h">
              <span className="tag ok"><Ico n="check" b />Lista</span>
              <h2>Tu rutina</h2>
              <p className="mono big-sum">{resumen.estructura}</p>
            </div>
            <div className="pd"><div className="spec flat">
              {resumen.dias.map(d => { const [a, b] = d.split('|'); return <p key={d}><span>{a}</span><b>{b}</b></p> })}
            </div></div>
          </div>
          <p className="note mt12"><Ico n="info" /><span>La primera semana es <b>de calibración</b>: pesos cómodos mientras medimos tus tiempos.</span></p>
        </>
      )}
    </Paso>
  )

  const contenido: Record<number, { t: string; d?: string; saltar?: boolean; c: ReactNode }> = {
    2: { t: 'Sobre ti', d: 'Para calcular tu gasto y tus objetivos.', c: (
      <div className="fields mt16">
        <label><span className="lbl fl">Nombre (opcional)</span><input className="inp" value={p.nombre} onChange={e => cambia({ nombre: e.target.value })} placeholder="¿Cómo te llamamos?" /></label>
        <label><span className="lbl fl">Fecha de nacimiento</span><input className="inp" type="date" value={p.nacimiento} onChange={e => cambia({ nacimiento: e.target.value })} /></label>
        <div><span className="lbl fl">Sexo (para las fórmulas)</span><Elegir eq opciones={[{ v: 'hombre', t: 'Hombre' }, { v: 'mujer', t: 'Mujer' }]} valor={p.sexo} onCambio={v => cambia({ sexo: v })} /></div>
        <div><span className="lbl fl">Altura</span><Stepper valor={p.alturaCm} paso={1} min={120} max={230} sufijo="cm" onCambio={v => cambia({ alturaCm: v })} /></div>
      </div>) },
    3: { t: 'Tu cuerpo hoy', d: 'Con esto medimos tu punto de partida. Puedes cambiarlo después en Perfil.', saltar: true, c: (
      <>
        <Medir />
        <div className="fields mt16">
          <div><span className="lbl fl">Peso</span><Stepper valor={cuerpo.peso} paso={0.1} decimales={1} min={30} sufijo="kg" onCambio={v => setCuerpo(c => ({ ...c, peso: v }))} /></div>
          <div className="grid2">
            <div><span className="lbl fl">Cintura</span><Stepper className="sm" valor={cuerpo.cintura} paso={0.5} sufijo="cm" onCambio={v => setCuerpo(c => ({ ...c, cintura: v }))} /></div>
            <div><span className="lbl fl">Cuello</span><Stepper className="sm" valor={cuerpo.cuello} paso={0.5} sufijo="cm" onCambio={v => setCuerpo(c => ({ ...c, cuello: v }))} /></div>
          </div>
        </div>
        <details className="fold mt12">
          <summary><Ico n="ruler" className="blue" />Más medidas <span className="tag">opcional</span><Ico n="caret-down" /></summary>
          <div className="in"><div className="grid2">
            {([['cadera', 'Cadera'], ['pecho', 'Pecho'], ['brazo', 'Brazo relajado'], ['brazoContraido', 'Brazo contraído'], ['muslo', 'Muslo']] as const).map(([k, t]) => (
              <div key={k}><span className="lbl fl">{t}</span><Stepper className="sm" valor={cuerpo[k] || null} paso={0.5} sufijo="cm" onCambio={v => setCuerpo(c => ({ ...c, [k]: v }))} /></div>
            ))}
          </div></div>
        </details>
      </>) },
    4: { t: 'Tu objetivo', d: 'Lo puedes cambiar cuando quieras.', c: (
      <>
        <div className="opts mt16">
          {([['recomposicion', 'Recomposición', 'Menos grasa y más músculo. El peso es lo de menos.', 'Recomendado'], ['perder', 'Perder peso', 'Déficit algo mayor y más proteína.', ''], ['fuerza', 'Ganar fuerza', 'Comer lo justo para subir de peso en los ejercicios.', '']] as const).map(([v, t, d, tag]) => (
            <button key={v} className={cx('opt-c', p.objetivo === v && 'on')} onClick={() => cambia({ objetivo: v })}>
              <span className="rad" /><span className="tx"><b>{t} {tag && <span className="tag ok">{tag}</span>}</b><small>{d}</small></span>
            </button>
          ))}
        </div>
        <p className="lbl fl mt16">Zonas a priorizar</p>
        <Elegir opciones={['brazos', 'pecho', 'espalda', 'hombros', 'piernas', 'gluteo', 'abdomen'].map(z => ({ v: z, t: z === 'gluteo' ? 'Glúteo' : z[0]!.toUpperCase() + z.slice(1) }))} valor={p.zonasPrioridad} onCambio={z => cambia({ zonasPrioridad: p.zonasPrioridad.includes(z) ? p.zonasPrioridad.filter(x => x !== z) : [...p.zonasPrioridad, z] })} />
      </>) },
    5: { t: 'Cómo te gusta entrenar', c: (
      <div className="fields mt16">
        <div><span className="lbl fl">Tu nivel</span><Elegir opciones={[{ v: 'empiezo', t: 'Empiezo' }, { v: 'vuelvo', t: 'Vuelvo tras un parón' }, { v: 'intermedio', t: 'Intermedio' }, { v: 'avanzado', t: 'Avanzado' }]} valor={p.nivel} onCambio={v => cambia({ nivel: v })} /></div>
        <div><span className="lbl fl">Prefieres</span><Elegir eq opciones={[{ v: 'maquinas', t: 'Máquinas' }, { v: 'libre', t: 'Peso libre' }, { v: 'mezcla', t: 'Mezcla' }]} valor={p.preferencia} onCambio={v => cambia({ preferencia: v })} /></div>
        <div><span className="lbl fl">Repeticiones</span><Elegir eq opciones={[{ v: 'pesadas', t: 'Pocas y pesadas' }, { v: 'moderadas', t: 'Moderadas' }, { v: 'mezcla', t: 'Mezcla' }]} valor={p.reps} onCambio={v => cambia({ reps: v })} /></div>
        <div className="list">
          <Fila t="Superseries" d="Dos ejercicios seguidos: ahorran tiempo" on={p.superseries} c={v => cambia({ superseries: v })} />
          <Fila t="Abdominales y core" d="Al final de las sesiones" on={p.core} c={v => cambia({ core: v })} />
          <Fila t="Me gusta ir al fallo" d="Solo donde es seguro (máquinas)" on={p.alFallo} c={v => cambia({ alFallo: v })} />
        </div>
      </div>) },
    6: { t: 'Tus horarios', d: 'Toca un día para marcarlo: fijo → opcional → libre.', c: <Horarios p={p} cambia={cambia} /> },
    7: { t: 'Salud', d: 'Para no proponerte ejercicios que no te convienen.', saltar: true, c: (
      <div className="fields mt16">
        <div><span className="lbl fl">Zonas sensibles</span><Elegir opciones={[{ v: 'rodilla', t: 'Rodilla' }, { v: 'lumbar', t: 'Lumbar' }, { v: 'hombro', t: 'Hombro' }, { v: 'muneca', t: 'Muñeca' }, { v: 'codo', t: 'Codo' }] as { v: Zona; t: string }[]} valor={p.zonasSensibles} onCambio={z => cambia({ zonasSensibles: p.zonasSensibles.includes(z) ? p.zonasSensibles.filter(x => x !== z) : [...p.zonasSensibles, z] })} /></div>
        <label><span className="lbl fl">Lesiones o molestias (opcional)</span><textarea className="inp" value={p.lesiones} onChange={e => cambia({ lesiones: e.target.value })} placeholder="Por ejemplo: me duele la extensión de cuádriceps" /></label>
        <p className="note plain"><Ico n="first-aid" /><span>Los ejercicios que te duelan o no te gusten los puedes marcar en <b>Rutina → Ejercicios</b> y no volverán a salir. <b>Esto no es consejo médico.</b></span></p>
      </div>) },
    8: { t: 'Tu gimnasio', d: 'Marca lo que tiene. Si te cambias, creas otro.', saltar: true, c: (
      <>
        <label className="mt16" style={{ display: 'block' }}><span className="lbl fl">Nombre</span><input className="inp" value={gym.nombre} onChange={e => setGym(g => ({ ...g, nombre: e.target.value }))} /></label>
        <div className="sec"><div className="sec-h"><h2>Máquinas y material</h2><span className="lbl">{gym.material.length} marcadas</span></div>
          <CatalogoMaterial material={gym.material} onCambio={m => setGym(g => ({ ...g, material: m }))} />
        </div>
        <details className="fold mt12"><summary><Ico n="barbell" className="blue" />Mancuernas y discos <Ico n="caret-down" /></summary><div className="in">
          <PesosGimnasio g={gym} onCambio={c => setGym(g => ({ ...g, ...c }))} />
        </div></details>
        <p className="result card mt16" style={{ boxShadow: 'none' }}><Ico n="check-circle" b className="okc" />Con este gimnasio tienes <b className="mono">{ejerciciosDisponibles(gym.material)}</b> ejercicios disponibles</p>
      </>) },
    9: { t: 'Comida y actividad', d: 'Lo justo para tus recordatorios y objetivos.', c: (
      <div className="fields mt16">
        <div><span className="lbl fl">Suplementos que tomas</span><Elegir opciones={['Creatina', 'Batido de proteína'].map(s => ({ v: s, t: s }))} valor={p.suplementos} onCambio={s => cambia({ suplementos: p.suplementos.includes(s) ? p.suplementos.filter(x => x !== s) : [...p.suplementos, s] })} /></div>
        <div><span className="lbl fl">Tu trabajo</span><Elegir eq opciones={[{ v: 'sentado', t: 'Sentado' }, { v: 'depie', t: 'De pie' }, { v: 'fisico', t: 'Físico' }]} valor={p.trabajo} onCambio={v => cambia({ trabajo: v })} /></div>
        <div><span className="lbl fl">Objetivo de pasos diarios</span><Stepper valor={p.pasosObjetivo} paso={1000} min={2000} max={20000} onCambio={v => cambia({ pasosObjetivo: v })} /></div>
        <div><span className="lbl fl">Días de pesarte</span>
          <div className="days">{DIAS_CORTOS.map((d, i) => <button key={d} className={cx('chip day', p.diasPesaje.includes(i as Dia) && 'on')} onClick={() => cambia({ diasPesaje: p.diasPesaje.includes(i as Dia) ? p.diasPesaje.filter(x => x !== i) : [...p.diasPesaje, i as Dia].sort() })}>{d}</button>)}</div>
        </div>
      </div>) },
  }
  const c = contenido[paso]!
  return (
    <Paso n={paso} titulo={c.t} desc={c.d} onAtras={atras} onSaltar={c.saltar ? sig : undefined} pie={
      <>
        <button className="btn gry auto" onClick={atras} aria-label="Atrás"><Ico n="caret-left" b /></button>
        <button className="btn" onClick={sig}>Siguiente <Ico n="arrow-right" b /></button>
      </>
    }>{c.c}</Paso>
  )
}

function Paso({ n, titulo, desc, children, pie, onAtras, onSaltar, sinAtras }: { n: number; titulo: string; desc?: string; children: ReactNode; pie: ReactNode; onAtras?: () => void; onSaltar?: () => void; sinAtras?: boolean }) {
  return (
    <section className="screen" data-full="" key={n}>
      <div className="alt">
        <div className="alt-top">
          {sinAtras || !onAtras ? <span className="skip-gap" /> : <button className="ib" onClick={onAtras} aria-label="Atrás"><Ico n="caret-left" /></button>}
          <div className="prog" aria-label={`Paso ${n} de ${TOTAL}`}>{Array.from({ length: TOTAL }, (_, i) => <i key={i} className={cx(i < n && 'on')} />)}</div>
          {onSaltar ? <button className="skipb" onClick={onSaltar}>Saltar</button> : <span className="skip-gap" />}
        </div>
        <div className="alt-body">
          <p className="lbl">Paso {n} de {TOTAL}</p>
          <h1 className="alt-h2">{titulo}</h1>
          {desc && <p className="muted mt4">{desc}</p>}
          {children}
        </div>
        {pie && <div className="alt-foot">{pie}</div>}
      </div>
    </section>
  )
}

function Fila({ t, d, on, c }: { t: string; d?: string; on: boolean; c: (v: boolean) => void }) {
  return <div className="it"><span className="tx"><b>{t}</b>{d && <small>{d}</small>}</span><Interruptor on={on} onCambio={c} etiqueta={t} /></div>
}

export function Medir() {
  return (
    <div className="measure mt16">
      <svg className="sil-fig" viewBox="0 0 120 240" aria-hidden="true">
        <circle className="sil" cx="60" cy="24" r="15" />
        <path className="sil" d="M53 38h14v10H53zM36 50Q60 44 84 50L100 58Q106 62 106 72L110 126Q110 134 104 134L98 80 92 82 92 138 90 226Q90 232 84 232H76L64 150H56L44 232H36Q30 232 30 226L28 138 28 82 22 80 16 134Q10 134 10 126L14 72Q14 62 20 58Z" />
        <line className="msr" x1="34" y1="44" x2="86" y2="44" />
        <line className="msr go" x1="20" y1="108" x2="100" y2="108" />
        <circle className="msr-dot" cx="60" cy="108" r="3" />
      </svg>
      <div className="measure-key">
        <p><span className="kdot blue" /><b>Cuello</b><small>Justo bajo la nuez</small></p>
        <p><span className="kdot go" /><b>Cintura</b><small>A la altura del ombligo, sin apretar</small></p>
        <p className="muted small mt8">Cinta métrica horizontal, después de soltar el aire.</p>
      </div>
    </div>
  )
}

export function Horarios({ p, cambia }: { p: Perfil; cambia: (c: Partial<Perfil>) => void }) {
  const ciclo = (d: Dia) => {
    if (p.diasFijos.includes(d)) cambia({ diasFijos: p.diasFijos.filter(x => x !== d), diasOpcionales: [...p.diasOpcionales, d].sort() })
    else if (p.diasOpcionales.includes(d)) cambia({ diasOpcionales: p.diasOpcionales.filter(x => x !== d) })
    else cambia({ diasFijos: [...p.diasFijos, d].sort() })
  }
  const horas = ['05:00', '05:30', '06:00', '07:00', '18:00', '19:00']
  return (
    <>
      <div className="days mt16">
        {DIAS_CORTOS.map((d, i) => (
          <button key={d} className={cx('chip day', p.diasFijos.includes(i as Dia) && 'fix on', p.diasOpcionales.includes(i as Dia) && 'opt on')} onClick={() => ciclo(i as Dia)}>{d}</button>
        ))}
      </div>
      <p className="legend mt8"><span><i className="lg fix" />Fijo</span><span><i className="lg opt" />Opcional</span><span><i className="lg" />Libre</span></p>
      <p className="lbl fl mt16">¿A qué hora entrenas?</p>
      <div className="chips">
        {horas.map(h => <button key={h} className={cx('chip', p.horaEntreno === h && 'on')} onClick={() => cambia({ horaEntreno: h })}>{h.replace(/^0/, '')}</button>)}
        <input className="inp" type="time" value={p.horaEntreno} onChange={e => cambia({ horaEntreno: e.target.value })} style={{ width: 120, minHeight: 40 }} aria-label="Otra hora" />
      </div>
      <p className="lbl fl mt16">¿Cómo vas al gimnasio?</p>
      <div className="chips eq">
        <button className={cx('chip big', p.transporte === 'coche' && 'on')} onClick={() => cambia({ transporte: 'coche' })}><Ico n="car" />Coche</button>
        <button className={cx('chip big', p.transporte === 'andando' && 'on')} onClick={() => cambia({ transporte: 'andando' })}><Ico n="person-simple-walk" />Andando</button>
      </div>
      <div className="grid2 mt16">
        <label><span className="lbl fl">Me voy (coche)</span><input className="inp" type="time" value={p.horaLimite.coche} onChange={e => cambia({ horaLimite: { ...p.horaLimite, coche: e.target.value } })} /></label>
        <label><span className="lbl fl">Me voy (andando)</span><input className="inp" type="time" value={p.horaLimite.andando} onChange={e => cambia({ horaLimite: { ...p.horaLimite, andando: e.target.value } })} /></label>
      </div>
      <p className="lbl fl mt16">Tiempo por sesión</p>
      <div className="grid2">
        <div><span className="lbl fl">Normal</span><Stepper className="sm" valor={p.minutosNormal} paso={5} min={30} max={120} sufijo="min" onCambio={v => cambia({ minutosNormal: v, minutosCorta: Math.min(p.minutosCorta, v - 5) })} /></div>
        <div><span className="lbl fl">Corto</span><Stepper className="sm" valor={p.minutosCorta} paso={5} min={20} max={p.minutosNormal - 5} sufijo="min" onCambio={v => cambia({ minutosCorta: v })} /></div>
      </div>
      <div className="list mt16">
        <div className="it">
          <span className="ico"><Ico n="moon" /></span>
          <span className="tx"><b>Hora de acostarte</b><small>Para avisarte 1 h antes</small></span>
          <input className="inp" type="time" value={p.horaDormir} onChange={e => cambia({ horaDormir: e.target.value })} style={{ width: 110 }} aria-label="Hora de acostarte" />
        </div>
        <div className="it"><span className="ico"><Ico n="coffee" /></span><span className="tx"><b>¿Entrenas en ayunas?</b></span><Interruptor on={p.enAyunas} onCambio={v => cambia({ enAyunas: v })} etiqueta="Entrenas en ayunas" /></div>
        <div className="it"><span className="ico"><Ico n="calendar-x" /></span><span className="tx"><b>Si pierdes una sesión</b><small>{p.sesionPerdida === 'sabado' ? 'Te propongo pasarla al día opcional' : 'Se salta sin más'}</small></span><Interruptor on={p.sesionPerdida === 'sabado'} onCambio={v => cambia({ sesionPerdida: v ? 'sabado' : 'saltar' })} etiqueta="Recolocar sesión perdida" /></div>
      </div>
    </>
  )
}

function Generando({ onListo, p }: { onListo: () => Promise<void>; p: Perfil }) {
  useEffect(() => {
    const t = setTimeout(() => void onListo(), 1400)
    return () => clearTimeout(t)
  }, [onListo])
  const fijos = p.diasFijos.length
  return (
    <>
      <div className="bar thick go mt12 build"><i /></div>
      <ul className="steps-done mt12">
        <li><Ico n="check" b />{fijos} día{fijos === 1 ? '' : 's'} fijo{fijos === 1 ? '' : 's'}{p.diasOpcionales.length ? ' y uno opcional' : ''}</li>
        <li><Ico n="check" b />Sesiones de ~{p.minutosNormal} min (corta ~{p.minutosCorta})</li>
        <li><Ico n="check" b />{p.preferencia === 'maquinas' ? 'Máquinas y poleas por delante' : p.preferencia === 'libre' ? 'Peso libre por delante' : 'Máquinas y peso libre'}</li>
        <li><Ico n="check" b />{p.zonasPrioridad.length ? `Prioridad: ${p.zonasPrioridad.join(', ')}` : 'Todo el cuerpo equilibrado'}</li>
      </ul>
    </>
  )
}
