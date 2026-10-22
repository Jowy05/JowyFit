// Idiomas de la app: t()/tn()/tc()/tk()/tr(), carga del diccionario, números, fechas y catálogo en inglés.
// Cada caso carga los módulos de nuevo (vi.resetModules) porque el idioma se elige una vez, al arrancar.
process.env.TZ = 'Europe/Madrid'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Catalogo } from '../src/catalogo/tipos'

/** localStorage de mentira con el idioma guardado. */
function conIdioma(i: string | null) {
  vi.stubGlobal('localStorage', { getItem: (k: string) => (k === 'jf-idioma-app' ? i : null), setItem: () => {} })
}
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe('t() y compañía', () => {
  it('sin localStorage (Node) es castellano y devuelve el texto tal cual', async () => {
    const i = await import('../src/i18n')
    expect(i.idioma()).toBe('es')
    await i.cargarIdioma()
    expect(i.t('Inicio')).toBe('Inicio')
    expect(i.t('Faltan {n} g', { n: 12 })).toBe('Faltan 12 g')
    expect(i.tn(1, '{n} serie', '{n} series')).toBe('1 serie')
    expect(i.tn(0, '{n} serie', '{n} series')).toBe('0 series')
    expect(i.tn(3, '1 pesada', '{n} pesadas')).toBe('3 pesadas')
    expect(i.tc('máquina', 'Ocupado')).toBe('Ocupado')
    expect(i.tk('Rutina')).toBe('Rutina')
    expect(i.regionNumeros()).toBe('es-ES')
  })
  it('lo guardado manda; lo raro o vacío es castellano (no se mira el idioma del móvil)', async () => {
    for (const [guardado, sale] of [['ca', 'ca'], ['en', 'en'], ['fr', 'es'], ['', 'es'], [null, 'es']] as const) {
      vi.resetModules()
      conIdioma(guardado)
      expect((await import('../src/i18n')).idioma()).toBe(sale)
    }
    vi.resetModules()
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqueado') } })
    expect((await import('../src/i18n')).idioma()).toBe('es')
  })
  it('con diccionario: traduce, rellena variables y, si falta, sale el castellano', async () => {
    const i = await import('../src/i18n')
    i.usarIdiomaEnPruebas('en', {
      'Inicio': 'Home', 'Faltan {n} g': '{n} g to go', '{n} serie': '{n} set', '{n} series': '{n} sets',
      'máquina|Ocupado': 'Taken', 'Vacío': '',
    })
    expect(i.t('Inicio')).toBe('Home')
    expect(i.t('Faltan {n} g', { n: 30 })).toBe('30 g to go')
    expect(i.t('No está')).toBe('No está')
    expect(i.t('Vacío')).toBe('Vacío')
    expect(i.t('constructor')).toBe('constructor')
    expect(i.t('Hola {nombre}', {})).toBe('Hola {nombre}')
    expect(i.tn(1, '{n} serie', '{n} series')).toBe('1 set')
    expect(i.tn(4, '{n} serie', '{n} series')).toBe('4 sets')
    expect(i.tc('máquina', 'Ocupado')).toBe('Taken')
    expect(i.tc('persona', 'Ocupado')).toBe('Ocupado')
    expect(i.regionNumeros()).toBe('en-US')
  })
  it('tr(): variables con JSX y marcas <b>…</b>, también movidas de sitio por la traducción', async () => {
    const i = await import('../src/i18n')
    const { tr } = await import('../src/i18n/jsx')
    const html = (n: unknown) => renderToStaticMarkup(n as never)
    expect(html(tr('Te faltan {cant} de proteína', { cant: <b>30 g</b> }))).toBe('Te faltan <b>30 g</b> de proteína')
    expect(html(tr('Toca <b>Hecho</b> al acabar', { b: s => <strong>{s}</strong> }))).toBe('Toca <strong>Hecho</strong> al acabar')
    i.usarIdiomaEnPruebas('en', { 'Te faltan {cant} de proteína': '{cant} of protein to go', 'Toca <b>Hecho</b> al acabar': 'Tap <b>Done</b> when you finish' })
    expect(html(tr('Te faltan {cant} de proteína', { cant: <b>30 g</b> }))).toBe('<b>30 g</b> of protein to go')
    expect(html(tr('Toca <b>Hecho</b> al acabar', { b: s => <strong>{s}</strong> }))).toBe('Tap <strong>Done</strong> when you finish')
  })
  it('cargarIdioma() trae el diccionario de verdad (catalán e inglés) y la app empieza a traducir', async () => {
    conIdioma('ca')
    let i = await import('../src/i18n')
    await i.cargarIdioma()
    expect(i.t('Inicio')).toBe('Inici')
    expect(i.t('Cancelar')).toBe('Cancel·lar')
    vi.resetModules()
    conIdioma('en')
    i = await import('../src/i18n')
    await i.cargarIdioma()
    expect(i.t('Inicio')).toBe('Home')
    expect(i.tn(2, '1 pesada traída', '{n} pesadas traídas')).toBe('2 weigh-ins imported')
  })
})

describe('números', () => {
  it('castellano y catalán con coma (y sin punto de miles con 4 cifras); inglés con punto decimal y coma de miles', async () => {
    const { num, kg } = await import('../src/dominio/calculos')
    expect(num(1234.5)).toBe('1234,5')
    expect(num(12345.5)).toBe('12.345,5')
    expect(kg(47.5)).toBe('47,5')
    for (const [i, mil, diezmil] of [['ca', '1234,5', '12.345,5'], ['en', '1,234.5', '12,345.5']] as const) {
      vi.resetModules()
      conIdioma(i)
      const c = await import('../src/dominio/calculos')
      expect(c.num(1234.5)).toBe(mil)
      expect(c.num(12345.5)).toBe(diezmil)
      expect(c.num(-0.04)).toBe('0')
    }
  })
})

describe('fechas en cada idioma', () => {
  it('castellano: igual que siempre', async () => {
    const f = await import('../src/dominio/fechas')
    expect(f.fechaLarga('2026-10-13')).toBe('martes 13 de octubre')
    expect(f.fechaCorta('2026-10-13')).toBe('13 oct')
    expect(f.diaMes(5, 0)).toBe('5 ene')
    expect(f.DIAS_ABREV[2]).toBe('mié')
  })
  it("catalán: «de» o «d'» según el mes, días y meses en minúscula", async () => {
    conIdioma('ca')
    const f = await import('../src/dominio/fechas')
    expect(f.fechaLarga('2026-10-13')).toBe("dimarts 13 d'octubre")
    expect(f.fechaLarga('2027-01-01')).toBe('divendres 1 de gener')
    expect(f.fechaLarga('2026-04-05')).toBe("diumenge 5 d'abril")
    expect(f.fechaLarga('2026-08-03')).toBe("dilluns 3 d'agost")
    expect(f.fechaCorta('2026-10-13')).toBe('13 oct')
    expect(f.DIAS_CORTOS.join(' ')).toBe('Dl Dt Dc Dj Dv Ds Dg')
    expect(f.MESES[2]).toBe('març')
    expect(f.saludo(new Date(2026, 9, 13, 8, 0))).toBe('Buenos días') // sin cargar el diccionario, castellano
  })
  it('inglés: mes delante del día y nombres con mayúscula', async () => {
    conIdioma('en')
    const f = await import('../src/dominio/fechas')
    expect(f.fechaLarga('2026-10-13')).toBe('Tuesday, October 13')
    expect(f.fechaCorta('2026-10-13')).toBe('Oct 13')
    expect(f.diaMes(1, 2)).toBe('Mar 1')
    expect(f.DIAS_CORTOS.join('')).toBe('MTWTFSS')
    expect(f.DIAS[6]).toBe('Sunday')
    const i = await import('../src/i18n')
    await i.cargarIdioma()
    expect(f.saludo(new Date(2026, 9, 13, 22, 0))).toBe('Good evening')
  })
  it('horas: 24 h en castellano y catalán; en inglés con AM/PM', async () => {
    let f = await import('../src/dominio/fechas')
    expect(f.formatoHora('18:30')).toBe('18:30')
    for (const i of ['ca', 'en'] as const) {
      vi.resetModules()
      conIdioma(i)
      f = await import('../src/dominio/fechas')
      const en = i === 'en'
      expect(f.formatoHora('18:30')).toBe(en ? '6:30 PM' : '18:30')
      expect(f.formatoHora('00:05')).toBe(en ? '12:05 AM' : '0:05')
      expect(f.formatoHora('12:00')).toBe(en ? '12:00 PM' : '12:00')
      expect(f.horaDe(new Date(2026, 9, 13, 5, 31).getTime())).toBe(en ? '5:31 AM' : '5:31')
    }
  })
})

describe('unidades y nombres guardados', () => {
  it('el % va pegado solo en inglés', async () => {
    let c = await import('../src/dominio/calculos')
    expect(c.conUnidad('26,3', '%')).toBe('26,3 %')
    expect(c.conUnidad('75', 'kg')).toBe('75 kg')
    expect(c.conUnidad('3', '')).toBe('3')
    vi.resetModules()
    conIdioma('en')
    c = await import('../src/dominio/calculos')
    expect(c.conUnidad('26.3', '%')).toBe('26.3%')
    expect(c.conUnidad('75', 'kg')).toBe('75 kg')
  })
  it('el nombre del entreno guardado en castellano sale en el idioma de la app; uno puesto a mano, tal cual', async () => {
    conIdioma('en')
    const i = await import('../src/i18n')
    await i.cargarIdioma()
    const { nombreEntreno, nombreEstructura } = await import('../src/dominio/nombres')
    expect(nombreEntreno({ nombre: 'Cuerpo completo B' })).not.toBe('Cuerpo completo B')
    expect(nombreEntreno({ nombre: 'Mi pierna favorita' })).toBe('Mi pierna favorita')
    expect(nombreEstructura('Cuerpo completo · 3 días')).not.toContain('días')
  })
})

/** Catálogo mínimo con un nombre que en castellano se arregla («Cable» → «Polea»). */
const mini = (): Catalogo => ({
  fuente: 'x', version: 1, generado: 'x',
  etiquetas: { category: { strength: 'Fuerza' } },
  musculos: { pectoralis_major: { nombre: 'Pecho', cientifico: 'Pectoral mayor', zona: 'pecho' } },
  material: { cable: { nombre: 'Máquina Smith', etiquetas: [] } },
  ejercicios: [
    { id: 'cable-fly', nombre: 'Aperturas con Cable', descripcion: 'En la máquina Smith.', instrucciones: ['Paso'], consejos: ['Consejo'], categoria: 'strength', fuerza: 'push', mecanica: 'isolation', dificultad: 'beginner', material: 'cable', zona: 'chest', principales: ['pectoralis_major'], secundarios: [], objetivos: [], etiquetas: [], unilateral: false, pesoCorporal: false, poses: ['main'], met: null },
    { id: 'sin-ingles', nombre: 'Curl con Barra EZ', descripcion: '', instrucciones: [], consejos: [], categoria: 'strength', fuerza: 'pull', mecanica: 'isolation', dificultad: 'beginner', material: null, zona: 'arms', principales: [], secundarios: [], objetivos: [], etiquetas: [], unilateral: false, pesoCorporal: false, poses: ['main'], met: null },
  ],
})
const ingles = () => ({
  version: 1, generado: 'x',
  etiquetas: { category: { strength: 'Strength' } },
  musculos: { pectoralis_major: { nombre: 'Chest', cientifico: 'Pectoralis Major' } },
  material: { cable: { nombre: 'Cable Machine' } },
  ejercicios: { 'cable-fly': { nombre: 'Cable Fly', descripcion: 'On the cable machine.', instrucciones: ['Step'], consejos: ['Tip'] } },
})

describe('catálogo en inglés', () => {
  it('con los textos en inglés se usan tal cual; lo que no los tiene sigue en castellano con sus arreglos', async () => {
    const cat = await import('../src/catalogo/catalogo')
    cat.usarCatalogo(mini(), ingles())
    expect(cat.nombreEjercicio('cable-fly')).toBe('Cable Fly')
    expect(cat.ejercicio('cable-fly')!.instrucciones).toEqual(['Step'])
    expect(cat.nombreEjercicio('sin-ingles')).toBe('Curl con Barra Z')
    expect(cat.nombreMaterial('cable')).toBe('Cable Machine')
    expect(cat.nombreMusculo('pectoralis_major')).toBe('Chest')
    expect(cat.etiqueta('category', 'strength')).toBe('Strength')
  })
  it('en castellano, como siempre: solo catalogo.json y con los nombres del gimnasio', async () => {
    const f = vi.fn(async () => ({ ok: true, status: 200, json: async () => mini() }))
    vi.stubGlobal('fetch', f)
    const cat = await import('../src/catalogo/catalogo')
    await cat.cargarCatalogo()
    expect(f.mock.calls).toEqual([['/repdb/catalogo.json']])
    expect(cat.nombreEjercicio('cable-fly')).toBe('Aperturas en Polea')
  })
  it('en inglés pide también catalogo.en.json; si no llega, el catálogo abre en castellano', async () => {
    conIdioma('en')
    const pide = (falla: boolean) => vi.fn(async (url: string) => (url.endsWith('catalogo.en.json')
      ? (falla ? { ok: false, status: 404, json: async () => ({}) } : { ok: true, status: 200, json: async () => ingles() })
      : { ok: true, status: 200, json: async () => mini() }))
    let f = pide(false)
    vi.stubGlobal('fetch', f)
    let cat = await import('../src/catalogo/catalogo')
    await cat.cargarCatalogo()
    expect(f.mock.calls.map(c => c[0]).sort()).toEqual(['/repdb/catalogo.en.json', '/repdb/catalogo.json'])
    expect(cat.nombreEjercicio('cable-fly')).toBe('Cable Fly')
    vi.resetModules()
    f = pide(true)
    vi.stubGlobal('fetch', f)
    cat = await import('../src/catalogo/catalogo')
    await cat.cargarCatalogo()
    expect(cat.nombreEjercicio('cable-fly')).toBe('Aperturas en Polea')
  })
})
