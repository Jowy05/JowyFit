import { describe, expect, it } from 'vitest'
import { pasosTutorial, type PlataformaTutorial } from '../src/ui/tutorial/pasos'
import { usarIdiomaEnPruebas } from '../src/i18n'
import ca from '../src/i18n/ca'
import en from '../src/i18n/en'

const ids = (p: ReturnType<typeof pasosTutorial>) => p.map(x => x.id)
const todo = (p: ReturnType<typeof pasosTutorial>) => p.map(x => `${x.titulo} ${x.texto}`).join(' ')

describe('guion del tutorial', () => {
  const android = pasosTutorial({ apple: false, android: true, instalada: true })
  const iphone = pasosTutorial({ apple: true, android: false, instalada: false })
  const iphoneInstalada = pasosTutorial({ apple: true, android: false, instalada: true })
  const web = pasosTutorial({ apple: false, android: false, instalada: false })
  // Cada plataforma con su guion en castellano (para comparar con las traducciones).
  const guiones: [PlataformaTutorial, ReturnType<typeof pasosTutorial>][] = [
    [{ apple: false, android: true, instalada: true }, android],
    [{ apple: true, android: false, instalada: false }, iphone],
    [{ apple: false, android: false, instalada: false }, web],
  ]

  it('empieza con la bienvenida y acaba en «Ver el tutorial» de Ajustes', () => {
    for (const p of [android, iphone, web]) {
      expect(p[0]!.id).toBe('hola')
      expect(p[p.length - 1]).toMatchObject({ id: 'fin', pestana: 'per', ruta: 'ajustes', sel: '[data-tour="tutorial"]' })
    }
  })

  it('Android: reloj y báscula, y el aviso llega al reloj; nada de lo de iPhone', () => {
    expect(ids(android)).toContain('reloj')
    expect(ids(android)).not.toContain('pendientes')
    expect(ids(android)).not.toContain('instalar')
    expect(todo(android)).toContain('también en el reloj')
    expect(todo(android)).toContain('Health Connect')
    expect(todo(android)).not.toMatch(/Compartir|app Salud|destella/)
  })

  it('iPhone: lo adaptado se explica y lo que no funciona no sale', () => {
    expect(ids(iphone)).toEqual(expect.arrayContaining(['pendientes', 'instalar', 'copia']))
    expect(ids(iphone)).not.toContain('reloj')
    const t = todo(iphone)
    expect(t).toContain('pitido')
    expect(t).toContain('destella')
    expect(t).toContain('app Salud')
    expect(t).toContain('menú Compartir')
    expect(t).not.toMatch(/Health Connect|en el reloj|copia sola cada semana/i)
    // Instalada, ya no se le explica cómo instalarla.
    expect(ids(iphoneInstalada)).not.toContain('instalar')
    // Los pendientes son la forma de iPhone de los recordatorios: salen aunque hoy no haya ninguno.
    expect(iphone.find(p => p.id === 'pendientes')?.siempre).toBe(true)
  })

  it('en un navegador que no es de Apple ni el APK no promete ni reloj ni Health Connect', () => {
    expect(ids(web)).not.toContain('reloj')
    expect(todo(web)).not.toMatch(/reloj|Health Connect|Compartir/)
  })

  it('textos cortos: título de una línea y una frase que se lee de un vistazo (en los tres idiomas)', () => {
    const idiomas = [['es', {}], ['ca', ca], ['en', en]] as const
    try {
      for (const [i, dic] of idiomas) {
        usarIdiomaEnPruebas(i, dic)
        for (const [plataforma, castellano] of guiones) {
          const p = pasosTutorial(plataforma)
          p.forEach((x, n) => {
            expect(x.titulo.length, `${i} ${x.id}`).toBeLessThanOrEqual(34)
            expect(x.texto.length, `${i} ${x.id}`).toBeLessThanOrEqual(125)
            // Traducido de verdad: no queda el castellano.
            if (i !== 'es') {
              expect(x.titulo, `${i} ${x.id}`).not.toBe(castellano[n]!.titulo)
              expect(x.texto, `${i} ${x.id}`).not.toBe(castellano[n]!.texto)
            }
          })
        }
      }
    } finally {
      usarIdiomaEnPruebas('es')
    }
  })

  it('cada paso con ancla dice qué pestaña poner; las anclas son atributos data-tour', () => {
    for (const p of [android, iphone]) for (const x of p) {
      if (!x.sel) continue
      expect(x.pestana, x.id).toBeTruthy()
      for (const s of Array.isArray(x.sel) ? x.sel : [x.sel]) expect(s, x.id).toMatch(/^\[data-tour="[a-z-]+"\]/)
    }
  })
})
