// Molestias repetidas, «Me duele» y el sábado «lo que falte»: las reglas puras (dominio/molestias, volumen y el
// generador) y, con la base simulada y el catálogo real, lo que cambian en el plan, la marca y el entreno en curso.
import { beforeEach, describe, expect, it } from 'vitest'
import { catalogoReal, hayCatalogo, perfilEjemplo } from './ayuda'
import { TABLAS, db } from '../src/datos/db'
import { gimnasioNuevo, rutinaActiva } from '../src/datos/repos'
import { activarRutina } from '../src/datos/acciones/rutina'
import { iniciarEntreno, pasarACorta } from '../src/datos/acciones/entreno'
import { cambiarPorMolestia, meDuele, seguirConMolestia } from '../src/datos/acciones/molestias'
import { loQueFalta, propuestasMolestia } from '../src/datos/consultas'
import { ejercicio, hayEn } from '../src/catalogo/catalogo'
import { alternativaSinMolestia, cambiarEnPlan, molestiasRepetidas, zonaMolestia } from '../src/dominio/molestias'
import { faltanSemana, seriesSemana, ZONA_DE_PATRON, type ZonaVolumen } from '../src/dominio/volumen'
import { generarDiaFalta, patronGenerador } from '../src/dominio/generador'
import { cargaZona } from '../src/dominio/salud'
import { hoyISO } from '../src/dominio/fechas'
import { recortarACorta, sustituir } from '../src/dominio/sesion'
import type { Ejercicio } from '../src/catalogo/tipos'
import type { Bloque, DiaRutina, EjercicioSesion, Guardado, Rutina, Serie, Sesion } from '../src/datos/tipos'

const HOY = hoyISO()
const bloque = (uid: string, ejercicio: string, x: Partial<Bloque> = {}): Bloque => ({ uid, ejercicio, alternativas: [], series: 3, repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...x })
const dia = (letra: string, bloques: Bloque[], x: Partial<DiaRutina> = {}): DiaRutina => ({ letra, nombre: `Día ${letra}`, dia: null, opcional: false, bloques, ...x })
const rutina = (dias: DiaRutina[]): Omit<Rutina, 'id'> => ({ creada: '2026-10-01T10:00:00.000Z', activa: true, estructura: '', porque: [], calibracion: false, gimnasioId: null, dias })
const serie = (n: number, hecha = true): Serie => ({ n, peso: 40, reps: 10, rpe: null, calentamiento: false, hecha })
const ej = (id: string, x: Partial<EjercicioSesion> = {}, series = 3): EjercicioSesion => ({
  uid: id, ejercicio: id, planificado: id, estado: 'hecho', series: Array.from({ length: series }, (_, i) => serie(i + 1)), repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...x,
})
const sesion = (id: number, fecha: string, ejercicios: EjercicioSesion[], x: Partial<Sesion> = {}): Guardado<Sesion> => ({
  id, fecha, rutinaId: 1, letra: 'A', nombre: 'A', gimnasioId: null, inicio: Date.parse(`${fecha}T07:00:00`), version: 'normal', estado: 'hecha', calibracion: false, ejercicios, ...x,
})

describe('molestias repetidas: cuándo se propone cambiar un ejercicio', () => {
  const plan = new Set(['squat', 'bench-press'])
  it('con molestia en sus 2 últimos entrenos se propone; con una sola, o si la última fue bien, no', () => {
    const dos = [sesion(1, '2026-10-20', [ej('squat', { molestia: true }), ej('bench-press')]), sesion(2, '2026-10-22', [ej('squat', { molestia: true }), ej('bench-press', { molestia: true })])]
    expect(molestiasRepetidas(dos, plan)).toEqual([{ ejercicio: 'squat', sesion: 2 }])
    const ultimaBien = [...dos, sesion(3, '2026-10-24', [ej('squat')])]
    expect(molestiasRepetidas(ultimaBien, plan)).toEqual([])
    expect(molestiasRepetidas(dos.slice(1), plan)).toEqual([])
  })
  it('«seguidos» son los entrenos en que se hizo: uno sin ese ejercicio en medio no corta la racha', () => {
    const s = [sesion(1, '2026-10-20', [ej('squat', { molestia: true })]), sesion(2, '2026-10-21', [ej('bench-press')]), sesion(3, '2026-10-22', [ej('squat', { molestia: true })])]
    expect(molestiasRepetidas(s, plan).map(x => x.ejercicio)).toEqual(['squat'])
    // Previsto pero sin ninguna serie hecha (saltado sin molestia): tampoco cuenta.
    const saltado = [...s, sesion(4, '2026-10-23', [ej('squat', { estado: 'saltado', series: [serie(1, false)] })])]
    expect(molestiasRepetidas(saltado, plan).map(x => x.ejercicio)).toEqual(['squat'])
  })
  it('lo que no está en el plan, los entrenos sin terminar y los «Seguir igual» de esa molestia no salen', () => {
    const s = [sesion(1, '2026-10-20', [ej('curl', { molestia: true })]), sesion(2, '2026-10-22', [ej('curl', { molestia: true })])]
    expect(molestiasRepetidas(s, plan)).toEqual([])
    const sq = [sesion(1, '2026-10-20', [ej('squat', { molestia: true })]), sesion(2, '2026-10-22', [ej('squat', { molestia: true })], { estado: 'curso' })]
    expect(molestiasRepetidas(sq, plan)).toEqual([])
    const dos = [sesion(1, '2026-10-20', [ej('squat', { molestia: true })]), sesion(2, '2026-10-22', [ej('squat', { molestia: true })])]
    expect(molestiasRepetidas(dos, plan, [{ ejercicio: 'squat', sesion: 2 }])).toEqual([])
    // Otra molestia en un entreno posterior: se vuelve a proponer.
    expect(molestiasRepetidas([...dos, sesion(3, '2026-10-24', [ej('squat', { molestia: true })])], plan, [{ ejercicio: 'squat', sesion: 2 }])).toEqual([{ ejercicio: 'squat', sesion: 3 }])
  })
})

describe('cambiar un ejercicio en el plan', () => {
  const sq = bloque('a1', 'squat', { alternativas: ['front-squat', 'leg-press'], superserie: 'a2' })
  const r = { ...rutina([dia('A', [sq, bloque('a2', 'bench-press', { superserie: 'a1', alternativas: ['squat'] })]), dia('B', [bloque('b1', 'squat'), bloque('b2', 'lat-pulldown')])]), id: 1 }
  const prensa: Ejercicio = {
    id: 'leg-press', nombre: 'Prensa', descripcion: '', instrucciones: [], consejos: [], categoria: 'strength', fuerza: 'push', mecanica: 'compound', dificultad: 'beginner',
    material: 'leg_press', zona: 'upper_legs', principales: ['quadriceps'], secundarios: [], objetivos: [], etiquetas: [], unilateral: false, pesoCorporal: false, poses: [], met: null,
  }
  it('lo cambia en todos los días, con su registro, y sale de las alternativas de los demás', () => {
    const { rutina: nueva, cambios } = cambiarEnPlan(r, 'squat', () => prensa)
    expect(nueva.dias.map(d => d.bloques.map(b => b.ejercicio))).toEqual([['leg-press', 'bench-press'], ['leg-press', 'lat-pulldown']])
    expect(nueva.dias[0]!.bloques[0]!.alternativas).toEqual(['front-squat'])
    expect(nueva.dias[0]!.bloques[1]!.alternativas).toEqual([])
    expect(cambios.map(c => [c.letra, c.uid, c.despues?.ejercicio])).toEqual([['A', 'a1', 'leg-press'], ['B', 'b1', 'leg-press']])
  })
  it('sin otro posible lo quita, y su pareja de «dos seguidos» queda suelta', () => {
    const { rutina: nueva, cambios } = cambiarEnPlan(r, 'squat', () => null)
    expect(nueva.dias.map(d => d.bloques.map(b => b.ejercicio))).toEqual([['bench-press'], ['lat-pulldown']])
    expect(nueva.dias[0]!.bloques[0]!.superserie).toBeUndefined()
    expect(cambios.every(c => c.despues === null)).toBe(true)
    // La rutina de antes no se toca (se guarda para deshacer).
    expect(r.dias[0]!.bloques[0]!.ejercicio).toBe('squat')
  })
})

describe('series que faltan esta semana', () => {
  const zonaDe = (id: string) => ({ squat: 'piernas', 'bench-press': 'pecho', row: 'espalda', curl: 'brazos' } as Record<string, ZonaVolumen>)[id]
  const r = rutina([dia('A', [bloque('a1', 'squat'), bloque('a2', 'bench-press'), bloque('a3', 'row')]), dia('B', [bloque('b1', 'curl')]), dia('S', [bloque('s1', 'curl')], { opcional: true, dia: 5 })])
  const p = perfilEjemplo({ zonasPrioridad: [] })
  const semana = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24']
  // Las que tocan: las del plan (3 series por ejercicio), como mucho las de seriesSemana.
  const objetivo = (z: ZonaVolumen) => Math.min(3, seriesSemana(z, p, { sesiones: 2, prueba: false }))
  it('solo las zonas de la rutina, con lo hecho en la semana restado y la que más falta primero', () => {
    const hechas = [sesion(1, '2026-10-20', [ej('squat', {}, objetivo('piernas')), ej('bench-press', {}, 2)]), sesion(2, '2026-10-14', [ej('row', {}, 10)])]
    const f = faltanSemana({ rutina: r, perfil: p, sesiones: hechas, dias: semana, zonaDe })
    // Piernas ya hechas; la sesión de la semana pasada no cuenta; gemelos y abdomen no están en la rutina.
    expect(f.map(x => x.zona).sort()).toEqual(['brazos', 'espalda', 'pecho'])
    expect(f.find(x => x.zona === 'piernas')).toBeUndefined()
    expect(f.find(x => x.zona === 'pecho')).toMatchObject({ hechas: 2, faltan: objetivo('pecho') - 2 })
    expect(f.find(x => x.zona === 'espalda')).toMatchObject({ hechas: 0, faltan: objetivo('espalda') })
    expect(f.map(x => x.faltan)).toEqual([...f.map(x => x.faltan)].sort((a, b) => b - a))
  })
  it('las de calentamiento y las no hechas no cuentan; con todo hecho no falta nada', () => {
    const calentar = ej('row', { series: [{ ...serie(1), calentamiento: true }, serie(2, false)] })
    expect(faltanSemana({ rutina: r, perfil: p, sesiones: [sesion(1, '2026-10-20', [calentar])], dias: semana, zonaDe }).find(x => x.zona === 'espalda')!.hechas).toBe(0)
    const todo = sesion(2, '2026-10-21', (['squat', 'bench-press', 'row', 'curl'] as const).map(id => ej(id, {}, 20)))
    expect(faltanSemana({ rutina: r, perfil: p, sesiones: [todo], dias: semana, zonaDe })).toEqual([])
  })
  it('fallaba: con justo las series del plan hechas, el sábado aún pedía hasta el objetivo teórico', () => {
    const justo = [sesion(1, '2026-10-20', [ej('squat'), ej('bench-press'), ej('row')]), sesion(2, '2026-10-22', [ej('curl')])]
    expect(faltanSemana({ rutina: r, perfil: p, sesiones: justo, dias: semana, zonaDe })).toEqual([])
    // Una serie menos (recortada o con la corta): falta esa.
    const menos = [sesion(1, '2026-10-20', [ej('squat'), ej('bench-press'), ej('row', {}, 2)]), sesion(2, '2026-10-22', [ej('curl')])]
    expect(faltanSemana({ rutina: r, perfil: p, sesiones: menos, dias: semana, zonaDe })).toMatchObject([{ zona: 'espalda', faltan: 1 }])
  })
})

describe('pasar a la versión corta', () => {
  it('salta los pendientes que apunta la sesión (sábado armado, sin día en la rutina); lo que está en curso se queda', () => {
    const s = sesion(1, HOY, [ej('a', { estado: 'curso', fueraEnCorta: true }), ej('b', { estado: 'pendiente', fueraEnCorta: true }), ej('c', { estado: 'pendiente' })], { estado: 'curso' })
    const c = recortarACorta(s, undefined)
    expect(c.version).toBe('corta')
    expect(c.ejercicios.map(x => x.estado)).toEqual(['curso', 'saltado', 'pendiente'])
  })
})

describe.skipIf(!hayCatalogo)('con el catálogo real', () => {
  const c = hayCatalogo ? catalogoReal() : null
  const e = (id: string) => ejercicio(id)!
  const fuerza = () => c!.ejercicios.filter(x => x.categoria === 'strength')
  const zonaVol = (id: string) => { const x = ejercicio(id); return x ? ZONA_DE_PATRON[patronGenerador(x)] : undefined }

  describe('otro ejercicio que no cargue la zona que molesta', () => {
    it('la zona de cada tipo: rodillas en la sentadilla, hombros en el press, codos en el curl', () => {
      expect(zonaMolestia(e('squat'))).toBe('rodillas')
      expect(zonaMolestia(e('bench-press'))).toBe('hombros')
      expect(zonaMolestia(e('barbell-curl'))).toBe('codos')
    })
    it('primero uno del mismo tipo que cuide la zona; si no hay, uno parecido; si tampoco, ninguno', () => {
      const pool = [e('front-squat'), e('goblet-squat'), e('leg-press'), e('hip-thrust'), e('romanian-deadlift')]
      const a = alternativaSinMolestia(e('squat'), pool, { zona: 'rodillas', preferidos: ['front-squat', 'leg-press'] })!
      // La frontal también carga la rodilla (sin etiqueta que la cuide): fuera. De las que la cuidan, la de «si está ocupado».
      expect(a.id).toBe('leg-press')
      expect(alternativaSinMolestia(e('squat'), pool, { zona: 'rodillas', ocupados: new Set(['leg-press', 'goblet-squat']) })!.id).toMatch(/hip-thrust|romanian-deadlift/)
      expect(alternativaSinMolestia(e('squat'), [e('front-squat'), e('bench-press')], { zona: 'rodillas' })).toBeNull()
    })
    it('con todo el catálogo, lo que propone no carga la zona (o la cuida) y no es el mismo ejercicio', () => {
      for (const id of ['squat', 'bench-press', 'barbell-row', 'barbell-curl', 'romanian-deadlift']) {
        const o = e(id), zona = zonaMolestia(o)!
        const a = alternativaSinMolestia(o, fuerza(), { zona })
        expect(a, id).not.toBeNull()
        expect(a!.id).not.toBe(id)
        const cuida = { rodillas: 'knee_safe', hombros: 'shoulder_safe', lumbar: 'lower_back_safe' } as Record<string, string>
        expect(!cargaZona(zona, a!) || a!.etiquetas.includes(cuida[zona] ?? '-') || zona === 'codos', `${id} → ${a!.id}`).toBe(true)
      }
    })
  })

  describe('sábado «lo que falte»', () => {
    const p = perfilEjemplo({ zonasPrioridad: [], superseries: false })
    it('llena las zonas que faltan, la que más primero, con 2 a 4 series y sin repetir lo de la semana', () => {
      const semana = new Set(['squat', 'bench-press'])
      const d = generarDiaFalta({ perfil: p, gimnasio: gimnasioNuevo('Gym'), marcas: new Map(), ejercicios: c!.ejercicios }, { letra: 'S', nombre: 'Sesión extra', dia: 5 },
        [{ zona: 'espalda', faltan: 8 }, { zona: 'brazos', faltan: 4 }, { zona: 'pecho', faltan: 0 }], semana)!
      expect(d).toMatchObject({ letra: 'S', opcional: true, dia: 5 })
      const zonas = d.bloques.map(b => zonaVol(b.ejercicio))
      expect(zonas).not.toContain('pecho')
      expect(zonas.filter(z => z === 'espalda')).toHaveLength(2)
      expect(zonas.filter(z => z === 'brazos')).toHaveLength(2)
      expect(zonas[0]).toBe('espalda')
      for (const b of d.bloques) expect(b.series).toBeGreaterThanOrEqual(2)
      for (const b of d.bloques) expect(b.series).toBeLessThanOrEqual(4)
      expect(d.bloques.some(b => semana.has(b.ejercicio))).toBe(false)
    })
    it('fallaba: como mucho 6 ejercicios aunque la última zona sea de pareja (brazos va suelto si solo cabe uno)', () => {
      const largo = perfilEjemplo({ zonasPrioridad: [], superseries: true, minutosNormal: 180 })
      const d = generarDiaFalta({ perfil: largo, gimnasio: gimnasioNuevo('Gym'), marcas: new Map(), ejercicios: c!.ejercicios }, { letra: 'S', nombre: 'S', dia: 5 },
        [{ zona: 'espalda', faltan: 8 }, { zona: 'pecho', faltan: 3 }, { zona: 'piernas', faltan: 3 }, { zona: 'gemelos', faltan: 3 }, { zona: 'brazos', faltan: 4 }, { zona: 'hombros', faltan: 4 }])!
      expect(d.bloques.length).toBeLessThanOrEqual(6)
      expect(d.bloques.length).toBeGreaterThanOrEqual(5)
      const brazos = d.bloques.filter(b => zonaVol(b.ejercicio) === 'brazos')
      expect(brazos.length).toBeLessThanOrEqual(1)
      for (const b of brazos) expect(b.superserie).toBeUndefined()
      expect(d.bloques.some(b => zonaVol(b.ejercicio) === 'hombros')).toBe(false)
    })
    it('sin nada que falte no hay día armado', () => {
      expect(generarDiaFalta({ perfil: p, gimnasio: null, marcas: new Map(), ejercicios: c!.ejercicios }, { letra: 'S', nombre: 'S', dia: 5 }, [])).toBeNull()
    })
  })

  describe('en la base: «Me duele», la propuesta de Inicio y el sábado', () => {
    beforeEach(async () => {
      for (const t of TABLAS) await db.table(t).clear()
      await db.perfil.put(perfilEjemplo({ zonasPrioridad: [], superseries: false }))
      await db.gimnasios.add({ ...gimnasioNuevo('Gym'), material: ['barbell', 'leg_press', 'kettlebell', 'cable', 'flat_bench', 'dumbbell', 'hack_squat'] })
      await activarRutina(rutina([
        dia('A', [bloque('a1', 'squat', { alternativas: ['front-squat'] }), bloque('a2', 'bench-press')]),
        dia('B', [bloque('b1', 'squat'), bloque('b2', 'seated-cable-row'), bloque('b3', 'barbell-curl')]),
        dia('S', [bloque('s1', 'barbell-curl')], { opcional: true, dia: 5, letra: 'S', nombre: 'Sesión extra' }),
      ]))
    })

    it('«Me duele» cambia el ejercicio en el plan y en el entreno por uno que cuide la rodilla; «Deshacer» lo deja todo como estaba', async () => {
      const antes = await rutinaActiva()
      const id = await iniciarEntreno({ letra: 'A' })
      const s = (await db.sesiones.get(id))!
      const r = await meDuele(s, 0)
      const despues = (await rutinaActiva())!
      const nuevo = despues.dias[0]!.bloques[0]!.ejercicio
      expect(nuevo).not.toBe('squat')
      expect(nuevo).not.toBe('front-squat')
      expect(e(nuevo).etiquetas).toContain('knee_safe')
      expect(despues.dias[1]!.bloques[0]!.ejercicio).toBe(nuevo)
      expect(r.otro).toBe(nuevo)
      expect(r.texto).toContain(e(nuevo).nombre)
      expect((await db.marcas.get('squat'))!.duele).toBe(true)
      const enCurso = (await db.sesiones.get(id))!
      expect(enCurso.ejercicios[0]).toMatchObject({ ejercicio: nuevo, planificado: 'squat', motivo: 'cambio' })
      await r.deshacer()
      expect(await rutinaActiva()).toEqual(antes)
      expect(await db.marcas.get('squat')).toBeUndefined()
      expect((await db.sesiones.get(id))!.ejercicios[0]!.ejercicio).toBe('squat')
    })

    it('«Me duele» con series ya hechas: lo hecho se queda, el resto se salta y la molestia queda apuntada', async () => {
      const id = await iniciarEntreno({ letra: 'A' })
      const s = (await db.sesiones.get(id))!
      s.ejercicios[0]!.series[0]!.hecha = true
      await db.sesiones.put(s)
      await meDuele(s, 0)
      const e0 = (await db.sesiones.get(id))!.ejercicios[0]!
      expect(e0).toMatchObject({ ejercicio: 'squat', estado: 'saltado', molestia: true })
      expect(e0.series[0]!.hecha).toBe(true)
    })

    it('propuesta tras 2 entrenos con molestia: «Seguir igual» la guarda hasta otra molestia; «Cambiarlo» la aplica', async () => {
      const r = (await rutinaActiva())!
      await db.sesiones.bulkAdd([
        { ...sesion(1, '2026-10-20', [ej('squat', { molestia: true })]), rutinaId: r.id },
        { ...sesion(2, '2026-10-22', [ej('squat', { molestia: true })]), rutinaId: r.id },
      ])
      const [p] = await propuestasMolestia()
      expect(p).toMatchObject({ ejercicio: 'squat', sesion: 2, zona: 'rodillas' })
      expect(e(p!.otro!).etiquetas).toContain('knee_safe')
      const deshacerSeguir = await seguirConMolestia('squat', 2)
      expect(await propuestasMolestia()).toEqual([])
      await deshacerSeguir()
      expect(await propuestasMolestia()).toHaveLength(1)
      await seguirConMolestia('squat', 2)
      await db.sesiones.add({ ...sesion(3, '2026-10-24', [ej('squat', { molestia: true })]), rutinaId: r.id })
      expect((await propuestasMolestia()).map(x => x.sesion)).toEqual([3])
      const hecho = await cambiarPorMolestia('squat')
      const plan = (await rutinaActiva())!.dias.flatMap(d => d.bloques.map(b => b.ejercicio))
      expect(plan).not.toContain('squat')
      expect(plan).toContain(hecho.otro)
      expect(await propuestasMolestia()).toEqual([])
    })

    it('el sábado se arma con lo que falta: piernas y pecho hechos, toca espalda y brazos', async () => {
      const r = (await rutinaActiva())!
      await db.sesiones.add({ ...sesion(1, HOY, [ej('squat', {}, 20), ej('bench-press', {}, 20)]), id: undefined, rutinaId: r.id } as Sesion)
      const s = r.dias.find(d => d.letra === 'S')!
      const f = (await loQueFalta(s, r))!
      expect(f.zonas).toEqual(expect.arrayContaining(['espalda', 'brazos']))
      expect(f.zonas).not.toContain('piernas')
      expect(f.zonas).not.toContain('pecho')
      // Al empezar el sábado sale ese mismo día, no el de la rutina (solo un curl).
      const id = await iniciarEntreno({ letra: 'S' })
      const zonas = (await db.sesiones.get(id))!.ejercicios.map(x => zonaVol(x.ejercicio))
      expect(zonas).toEqual(f.dia.bloques.map(b => zonaVol(b.ejercicio)))
      expect(zonas).toContain('espalda')
      // Un día de la rutina que no es opcional no se toca.
      expect(await loQueFalta(r.dias[0]!, r)).toBeNull()
    })

    it('«Empezar» enseña el mismo sábado que se crea, y en la corta se quita lo que toca aunque no esté en la rutina', async () => {
      await db.perfil.update('yo', { minutosCorta: 15 })
      const r = (await rutinaActiva())!
      await db.sesiones.add({ ...sesion(1, HOY, [ej('squat', {}, 20), ej('bench-press', {}, 20)]), id: undefined, rutinaId: r.id } as Sesion)
      const s = r.dias.find(d => d.letra === 'S')!
      // La hoja «Empezar» calcula el día con loQueFalta, como la tarjeta de Inicio.
      const hoja = (await loQueFalta(s, r))!.dia
      const id = await iniciarEntreno({ letra: 'S' })
      const creada = (await db.sesiones.get(id))!
      expect(creada.ejercicios.map(x => [x.ejercicio, x.series.length])).toEqual(hoja.bloques.map(b => [b.ejercicio, b.series]))
      expect(hoja.bloques.length).toBeGreaterThan(1)
      const fuera = creada.ejercicios.filter(x => x.fueraEnCorta)
      expect(fuera.length).toBe(hoja.bloques.filter(b => b.fueraEnCorta).length)
      expect(fuera.length).toBeGreaterThan(0)
      await pasarACorta(creada)
      const corta = (await db.sesiones.get(id))!
      expect(corta.version).toBe('corta')
      expect(corta.ejercicios.filter(x => x.fueraEnCorta).every(x => x.estado === 'saltado')).toBe(true)
      expect(corta.ejercicios.filter(x => !x.fueraEnCorta).some(x => x.estado !== 'saltado')).toBe(true)
    })

    it('fallaba: con justo las series del plan hechas, el sábado es el de siempre', async () => {
      const r = (await rutinaActiva())!
      await db.sesiones.add({ ...sesion(1, HOY, [ej('squat', {}, 6), ej('bench-press'), ej('seated-cable-row'), ej('barbell-curl')]), id: undefined, rutinaId: r.id } as Sesion)
      expect(await loQueFalta(r.dias.find(d => d.opcional)!, r)).toBeNull()
    })

    it('fallaba: «Me duele» sobre una alternativa (puesta con «Ocupado») la quita de las alternativas; «Deshacer» la devuelve', async () => {
      const antes = await rutinaActiva()
      expect(antes!.dias[0]!.bloques[0]!.alternativas).toContain('front-squat')
      const id = await iniciarEntreno({ letra: 'A' })
      const s = sustituir((await db.sesiones.get(id))!, 0, 'front-squat', 'ocupado', { peso: null, reps: null }, 'peso')
      await db.sesiones.put(s)
      const hecho = await meDuele(s, 0)
      const despues = (await rutinaActiva())!
      expect(despues.dias[0]!.bloques[0]!.ejercicio).toBe('squat')
      expect(despues.dias[0]!.bloques[0]!.alternativas).not.toContain('front-squat')
      expect((await db.marcas.get('front-squat'))!.duele).toBe(true)
      await hecho.deshacer()
      expect(await rutinaActiva()).toEqual(antes)
      expect(await db.marcas.get('front-squat')).toBeUndefined()
    })

    it('«Me duele» busca el sustituto con el material del gimnasio de la sesión', async () => {
      const gimnasioId = await db.gimnasios.add({ ...gimnasioNuevo('En casa'), material: ['dumbbell'] })
      const id = await iniciarEntreno({ letra: 'A', gimnasioId })
      const s = (await db.sesiones.get(id))!
      const antes = s.ejercicios[0]!
      await meDuele(s, 0)
      const despues = (await db.sesiones.get(id))!.ejercicios[0]!
      if (despues.ejercicio !== antes.ejercicio) {
        expect(hayEn(ejercicio(despues.ejercicio)!, new Set(['dumbbell']))).toBe(true)
      } else {
        expect(despues.estado).toBe('saltado')
      }
    })

    it('fallaba: «Deshacer» no borra la marca si entre medias se cambió en su ficha', async () => {
      const id = await iniciarEntreno({ letra: 'A' })
      const hecho = await meDuele((await db.sesiones.get(id))!, 0)
      await db.marcas.put({ id: 'squat', duele: true, odiado: true })
      await hecho.deshacer()
      expect(await db.marcas.get('squat')).toEqual({ id: 'squat', duele: true, odiado: true })
      // La rutina y el entreno sí vuelven (nadie los tocó).
      expect((await rutinaActiva())!.dias[0]!.bloques[0]!.ejercicio).toBe('squat')
      expect((await db.sesiones.get(id))!.ejercicios[0]!.ejercicio).toBe('squat')
    })

    it('el sábado con todo hecho es el de la rutina', async () => {
      const r = (await rutinaActiva())!
      await db.sesiones.add({ ...sesion(1, HOY, [ej('squat', {}, 30), ej('bench-press', {}, 30), ej('seated-cable-row', {}, 30), ej('barbell-curl', {}, 30)]), id: undefined, rutinaId: r.id } as Sesion)
      expect(await loQueFalta(r.dias.find(d => d.opcional)!, r)).toBeNull()
      const id = await iniciarEntreno({ letra: 'S' })
      expect((await db.sesiones.get(id))!.ejercicios.map(x => x.ejercicio)).toEqual(['barbell-curl'])
    })
  })
})
