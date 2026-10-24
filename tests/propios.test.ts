// Ejercicios propios: cómo entran en el catálogo, cómo se apuntan, cuándo los usa la rutina automática,
// y que borrarlos los saque del plan sin tocar el historial (con «Deshacer»).
import { beforeEach, describe, expect, it } from 'vitest'
import { TABLAS, db } from '../src/datos/db'
import { borrarPropio, cargarPropios, guardarPropio, recuperarPropio, sinEjercicio } from '../src/datos/acciones/propios'
import { activarRutina } from '../src/datos/acciones/rutina'
import { catalogoCargado, ejercicio, hayEn, nombreMaterial, usarCatalogo } from '../src/catalogo/catalogo'
import { comoEjercicio, parecido, registroSugerido } from '../src/catalogo/propios'
import { patron, tipoRegistro } from '../src/catalogo/clasificacion'
import { generarRutina } from '../src/dominio/generador'
import { validarDatos } from '../src/datos/validarCopia'
import { perfilPorDefecto } from '../src/datos/repos'
import type { Catalogo, Ejercicio } from '../src/catalogo/tipos'
import type { Bloque, EjercicioPropio, Perfil, Rutina } from '../src/datos/tipos'

const propio = (x: Partial<EjercicioPropio> = {}): EjercicioPropio => ({
  id: 'mio-1', nombre: 'Remo con goma elástica', grupo: 'espalda', material: 'otro', registro: 'peso', rutinaAuto: false, creado: '2026-10-20', ...x,
})

const repdb = (id: string, nombre: string, x: Partial<Ejercicio> = {}): Ejercicio => ({
  id, nombre, descripcion: '', instrucciones: [], consejos: [], categoria: 'strength', fuerza: 'pull', mecanica: 'compound', dificultad: 'beginner',
  material: 'cable', zona: 'back', principales: ['latissimus_dorsi'], secundarios: [], objetivos: [], etiquetas: [], unilateral: false, pesoCorporal: false,
  poses: ['main'], met: 3.5, ...x,
})
const catalogo = (): Catalogo => ({
  fuente: 'RepDB', version: 1, generado: '', etiquetas: {}, musculos: {}, material: { cable: { nombre: 'Polea', etiquetas: [] } },
  ejercicios: [repdb('lat-pulldown', 'Jalón al Pecho'), repdb('seated-cable-row', 'Remo Sentado en Polea')],
})

const bloque = (uid: string, ejercicio: string, x: Partial<Bloque> = {}): Bloque => ({ uid, ejercicio, alternativas: [], series: 3, repsMin: 8, repsMax: 12, rpe: 8, descanso: 90, registro: 'peso', ...x })
const rutina = (bloques: Bloque[]): Omit<Rutina, 'id'> => ({
  creada: '2026-10-20T10:00:00.000Z', activa: true, estructura: 'x', porque: [], calibracion: false, gimnasioId: null,
  dias: [{ letra: 'A', nombre: 'A', dia: 1, opcional: false, bloques }],
})

describe('cómo entra en el catálogo', () => {
  it('su nombre tal cual, en su grupo y con su material', () => {
    const e = comoEjercicio(propio({ grupo: 'pecho', material: 'mancuernas' }))
    expect(e).toMatchObject({ nombre: 'Remo con goma elástica', nombreEs: 'Remo con goma elástica', zona: 'chest', material: 'dumbbell', categoria: 'strength' })
    expect(patron(e)).toBe('empuje-h')
    expect(comoEjercicio(propio({ material: 'corporal' }))).toMatchObject({ material: null, pesoCorporal: true, etiquetas: ['bodyweight'] })
    expect(comoEjercicio(propio({ registro: 'cardio' })).categoria).toBe('cardio')
  })
  it('la máquina y «otro» tienen nombre aunque RepDB no los conozca', () => {
    expect(nombreMaterial(comoEjercicio(propio({ material: 'maquina' })).material)).toBe('Máquina')
    expect(nombreMaterial(comoEjercicio(propio({ material: 'otro' })).material)).toBe('Otro')
  })
  it('se apunta como el usuario eligió; con mancuernas, los kg de cada una', () => {
    expect(tipoRegistro(comoEjercicio(propio({ registro: 'peso', material: 'mancuernas' })))).toBe('mancuerna')
    expect(tipoRegistro(comoEjercicio(propio({ registro: 'peso', material: 'barra' })))).toBe('peso')
    expect(tipoRegistro(comoEjercicio(propio({ registro: 'tiempo', material: 'corporal' })))).toBe('tiempo')
    expect(tipoRegistro(comoEjercicio(propio({ registro: 'cardio' })))).toBe('cardio')
  })
  it('siempre está «en tu gimnasio»: lo creaste para lo que tienes', () => {
    expect(hayEn(comoEjercicio(propio({ material: 'barra' })), new Set())).toBe(true)
    expect(hayEn(repdb('x', 'X', { material: 'barbell' }), new Set())).toBe(false)
  })
})

describe('qué se le propone al crearlo', () => {
  it('cómo se apunta, por el nombre (en los tres idiomas) o por el material', () => {
    expect(registroSugerido('Bici estática', 'maquina')).toBe('cardio')
    expect(registroSugerido('Caminar en la cinta', 'otro')).toBe('cardio')
    expect(registroSugerido('Treadmill walk', 'otro')).toBe('cardio')
    expect(registroSugerido('Plancha con toalla', 'corporal')).toBe('tiempo')
    expect(registroSugerido('Planxa lateral', 'corporal')).toBe('tiempo')
    expect(registroSugerido('Flexiones en la pared', 'corporal')).toBe('corporal')
    expect(registroSugerido('Remo con goma', 'otro')).toBe('peso')
    // Solo palabras enteras: «Crunch» no es cardio por llevar «run» dentro.
    expect(registroSugerido('Crunch en banco', 'corporal')).toBe('corporal')
  })
  it('avisa si se parece a uno que ya está (sin tildes ni palabras cortas), no por una palabra suelta', () => {
    const l = catalogo().ejercicios
    expect(parecido('jalon al pecho', l)?.id).toBe('lat-pulldown')
    expect(parecido('Remo sentado polea', l)?.id).toBe('seated-cable-row')
    expect(parecido('Remo', l)).toBeUndefined()
    expect(parecido('Sentadilla búlgara', l)).toBeUndefined()
    expect(parecido('Jalón al pecho', l, 'lat-pulldown')).toBeUndefined()
  })
})

describe('el catálogo con los propios', () => {
  beforeEach(() => usarCatalogo(catalogo()))

  it('los vivos salen en la lista; los borrados no, pero su nombre sigue (historial e informe)', async () => {
    const { usarPropios } = await import('../src/catalogo/catalogo')
    usarPropios([comoEjercicio(propio()), comoEjercicio(propio({ id: 'mio-2', nombre: 'Viejo', borrado: '2026-10-21' }))])
    const ids = catalogoCargado()!.ejercicios.map(e => e.id)
    expect(ids).toContain('mio-1')
    expect(ids).not.toContain('mio-2')
    expect(ejercicio('mio-2')?.nombre).toBe('Viejo')
    expect(ids).toContain('lat-pulldown')
  })
})

describe('la rutina automática', () => {
  const perfil: Perfil = { ...perfilPorDefecto(), diasFijos: [1, 3, 5] }
  const conPecho = (rutinaAuto: boolean) => generarRutina({ perfil, gimnasio: null, marcas: new Map(), ejercicios: [comoEjercicio(propio({ grupo: 'pecho', rutinaAuto }))] })
  const usa = (r: ReturnType<typeof conPecho>) => r.dias.some(d => d.bloques.some(b => b.ejercicio === 'mio-1' || b.alternativas.includes('mio-1')))
  it('no lo pone salvo que el usuario lo deje', () => {
    expect(usa(conPecho(false))).toBe(false)
    expect(usa(conPecho(true))).toBe(true)
  })
  it('lo deja fuera si lo marcó como «me duele»', () => {
    const r = generarRutina({ perfil, gimnasio: null, marcas: new Map([['mio-1', { id: 'mio-1', duele: true }]]), ejercicios: [comoEjercicio(propio({ grupo: 'pecho', rutinaAuto: true }))] })
    expect(usa(r)).toBe(false)
  })
})

describe('guardar y borrar (IndexedDB simulada)', () => {
  beforeEach(async () => {
    for (const t of TABLAS) await db.table(t).clear()
    usarCatalogo(catalogo())
    await cargarPropios()
  })

  it('guardar lo pone en el catálogo al momento, con el nombre limpio', async () => {
    await guardarPropio(propio({ nombre: '  Remo con goma  ', notas: '   ' }))
    expect(ejercicio('mio-1')?.nombre).toBe('Remo con goma')
    expect((await db.propios.get('mio-1'))!.notas).toBeUndefined()
  })

  it('quitarlo del plan: su bloque, su sitio de «si está ocupado» y la superserie con él', () => {
    const r = { ...rutina([
      bloque('b1', 'mio-1', { superserie: 'b2' }),
      bloque('b2', 'lat-pulldown', { superserie: 'b1', alternativas: ['mio-1', 'seated-cable-row'] }),
    ]), id: 1 }
    const b = sinEjercicio(r, 'mio-1').dias[0]!.bloques
    expect(b.map(x => x.uid)).toEqual(['b2'])
    expect(b[0]!.alternativas).toEqual(['seated-cable-row'])
    expect(b[0]!.superserie).toBeUndefined()
  })

  it('borrar lo saca del plan, se queda como borrado (para el historial) y «Deshacer» lo deja todo como estaba', async () => {
    await guardarPropio(propio())
    const id = await activarRutina(rutina([bloque('b1', 'mio-1'), bloque('b2', 'lat-pulldown', { alternativas: ['mio-1'] })]))
    const antes = await db.rutinas.get(id)
    const deshacer = await borrarPropio('mio-1')
    expect((await db.propios.get('mio-1'))!.borrado).toBeTruthy()
    expect(catalogoCargado()!.ejercicios.some(e => e.id === 'mio-1')).toBe(false)
    expect(ejercicio('mio-1')?.nombre).toBe('Remo con goma elástica')
    const r = (await db.rutinas.get(id))!
    expect(r.dias[0]!.bloques.map(b => b.uid)).toEqual(['b2'])
    expect(r.dias[0]!.bloques[0]!.alternativas).toEqual([])

    await deshacer!()
    expect((await db.propios.get('mio-1'))!.borrado).toBeUndefined()
    expect(await db.rutinas.get(id)).toEqual(antes)
    expect(catalogoCargado()!.ejercicios.some(e => e.id === 'mio-1')).toBe(true)
  })

  it('«Deshacer» no pisa el plan si se cambió entre medias (solo recupera el ejercicio)', async () => {
    await guardarPropio(propio())
    const id = await activarRutina(rutina([bloque('b1', 'mio-1'), bloque('b2', 'lat-pulldown')]))
    const deshacer = await borrarPropio('mio-1')
    const cambiada = (await db.rutinas.get(id))!
    cambiada.dias[0]!.bloques.push(bloque('b3', 'seated-cable-row'))
    await db.rutinas.put(cambiada)
    await deshacer!()
    expect((await db.rutinas.get(id))!.dias[0]!.bloques.map(b => b.uid)).toEqual(['b2', 'b3'])
    expect((await db.propios.get('mio-1'))!.borrado).toBeUndefined()
  })

  it('sin plan también se borra; uno que no existe no hace nada', async () => {
    await guardarPropio(propio())
    expect(await borrarPropio('mio-1')).toBeTypeOf('function')
    expect(await borrarPropio('mio-nada')).toBeUndefined()
  })

  it('recuperar uno borrado lo vuelve a poner en la lista', async () => {
    await guardarPropio(propio({ borrado: '2026-10-21' }))
    expect(catalogoCargado()!.ejercicios.some(e => e.id === 'mio-1')).toBe(false)
    await recuperarPropio('mio-1')
    expect(catalogoCargado()!.ejercicios.some(e => e.id === 'mio-1')).toBe(true)
  })
})

describe('copias de seguridad', () => {
  const base = () => ({ perfil: [{ ...perfilPorDefecto(), altaCompleta: true }] })
  it('acepta un ejercicio propio y quita los campos que no conoce', () => {
    const { tablas } = validarDatos({ ...base(), propios: [{ ...propio(), raro: 1 }] })
    expect(tablas.propios).toEqual([propio()])
  })
  it('rechaza un id que no es de ejercicio propio o un grupo que no existe', () => {
    expect(() => validarDatos({ ...base(), propios: [propio({ id: 'bench-press' })] })).toThrow()
    expect(() => validarDatos({ ...base(), propios: [{ ...propio(), grupo: 'cuello' }] })).toThrow()
  })
})

describe('cambiar cómo se apunta uno que ya está en el plan', () => {
  beforeEach(async () => {
    for (const t of TABLAS) await db.table(t).clear()
    usarCatalogo(catalogo())
  })
  it('sus bloques pasan a apuntarse así, con series y repeticiones nuevas; el resto no cambia', async () => {
    await guardarPropio(propio({ registro: 'peso' }))
    const id = await activarRutina(rutina([bloque('b1', 'mio-1', { alternativas: ['lat-pulldown'], repsMin: 6, repsMax: 10 }), bloque('b2', 'lat-pulldown')]))
    await guardarPropio(propio({ registro: 'tiempo' }))
    const [b1, b2] = (await db.rutinas.get(id))!.dias[0]!.bloques
    expect(b1).toMatchObject({ uid: 'b1', registro: 'tiempo', alternativas: ['lat-pulldown'] })
    expect([b1!.repsMin, b1!.repsMax]).not.toEqual([6, 10])
    expect(b2).toEqual(bloque('b2', 'lat-pulldown'))
  })
  it('con mancuernas, «peso» pasa a los kg de cada una sin tocar series ni repeticiones', async () => {
    await guardarPropio(propio({ registro: 'peso', material: 'barra' }))
    const id = await activarRutina(rutina([bloque('b1', 'mio-1', { series: 5, repsMin: 3, repsMax: 5 })]))
    await guardarPropio(propio({ registro: 'peso', material: 'mancuernas' }))
    expect((await db.rutinas.get(id))!.dias[0]!.bloques[0]).toEqual(bloque('b1', 'mio-1', { series: 5, repsMin: 3, repsMax: 5, registro: 'mancuerna' }))
  })
  it('en superserie, las series nuevas no pasan de las de su pareja', async () => {
    await guardarPropio(propio({ registro: 'peso' }))
    const id = await activarRutina(rutina([bloque('b1', 'mio-1', { superserie: 'b2' }), bloque('b2', 'lat-pulldown', { superserie: 'b1', series: 1 })]))
    await guardarPropio(propio({ registro: 'tiempo' }))
    expect((await db.rutinas.get(id))!.dias[0]!.bloques[0]!.series).toBe(1)
  })
  it('si solo cambia el nombre, el plan no se toca', async () => {
    await guardarPropio(propio())
    const id = await activarRutina(rutina([bloque('b1', 'mio-1', { repsMin: 6 })]))
    const antes = await db.rutinas.get(id)
    await guardarPropio(propio({ nombre: 'Otro nombre' }))
    expect(await db.rutinas.get(id)).toEqual(antes)
  })
})

describe('restaurar una copia', () => {
  it('pone al día el catálogo con sus ejercicios propios (sin recargar la app)', async () => {
    for (const t of TABLAS) await db.table(t).clear()
    usarCatalogo(catalogo())
    await cargarPropios()
    const { importar } = await import('../src/datos/copias')
    const copia = { app: 'JowyFit', version: 2, datos: { perfil: [{ ...perfilPorDefecto(), altaCompleta: true }], propios: [propio()] } }
    await importar(new TextEncoder().encode(JSON.stringify(copia)))
    expect(ejercicio('mio-1')?.nombre).toBe('Remo con goma elástica')
  })
})

describe('alternativas', () => {
  it('en la rutina generada entera, tampoco: ni los recibe ni sale como el de otro', () => {
    const ejercicios = [repdb('bench-press', 'Press de Banca', { zona: 'chest', principales: ['pectoralis_major'], fuerza: 'push', material: 'barbell' }),
      repdb('db-press', 'Press con Mancuernas', { zona: 'chest', principales: ['pectoralis_major'], fuerza: 'push', material: 'dumbbell' }),
      comoEjercicio(propio({ grupo: 'pecho', rutinaAuto: true }))]
    const r = generarRutina({ perfil: { ...perfilPorDefecto(), diasFijos: [1, 3, 5] }, gimnasio: null, marcas: new Map(), ejercicios })
    const bloques = r.dias.flatMap(d => d.bloques)
    expect(bloques.some(b => b.alternativas.includes('mio-1'))).toBe(false)
    for (const b of bloques.filter(b => b.ejercicio === 'mio-1')) expect(b.alternativas).toEqual([])
  })
  it('uno propio no recibe «si está ocupado» automáticos ni sale como el de otro', async () => {
    const { alternativasDe } = await import('../src/dominio/generador')
    const ejercicios = [...catalogo().ejercicios, comoEjercicio(propio({ rutinaAuto: true }))]
    const x = { perfil: perfilPorDefecto(), gimnasio: null, marcas: new Map(), ejercicios }
    expect(alternativasDe('mio-1', x)).toEqual([])
    expect(alternativasDe('lat-pulldown', x)).not.toContain('mio-1')
  })
})
