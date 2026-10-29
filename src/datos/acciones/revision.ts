// Escrituras de la revisión semanal: guarda las respuestas, pone al día las molestias del perfil y cambia ya los
// bloques del plan que tocan (sin rehacer la rutina). Todo en una transacción; cada cambio se puede deshacer.
import { db } from '../db'
import { leerPerfil, rutinaActiva, gimnasioActivo } from '../repos'
import type { Dolor, Guardado, Revision, ZonaDolor } from '../tipos'
import { catalogoCargado, ejercicio, hayEn } from '../../catalogo/catalogo'
import { quitadoPor } from '../../catalogo/grupos'
import { patronGenerador } from '../../dominio/generador'
import { aplicarCambios, cambiosRevision, doloresTrasRevision } from '../../dominio/revision'
import { doloresDe } from '../../dominio/salud'
import { hoyISO } from '../../dominio/fechas'

/**
 * Guarda una revisión. `zonasAntes`: las molestias que había al empezarla (las de ahora que no estaban son nuevas;
 * las del grid se guardan al tocarlas). Devuelve la revisión guardada, con los cambios hechos al plan.
 */
export async function guardarRevision(o: { estado: Revision['estado']; respuestas: Revision['respuestas']; zonasAntes: ZonaDolor[] }): Promise<Guardado<Revision>> {
  const [g, marcas] = await Promise.all([gimnasioActivo(), db.marcas.toArray()])
  const material = new Set(g?.material ?? [])
  const evitados = new Set(marcas.filter(m => m.odiado || m.duele).map(m => m.id))
  return db.transaction('rw', [db.perfil, db.rutinas, db.revisiones], async () => {
    const p = (await leerPerfil())!
    const dolores: Dolor[] = doloresTrasRevision(doloresDe(p), o.respuestas)
    const perfil = { ...p, dolores, zonasSensibles: [] }
    await db.perfil.put(perfil)
    const nuevas = dolores.filter(d => !o.zonasAntes.includes(d.zona)).map(d => d.zona)
    const r = await rutinaActiva()
    let cambios: Revision['cambios'] = []
    if (r) {
      const activos = (await db.revisiones.toArray()).flatMap(x => x.cambios).filter(c => !c.deshecho)
      cambios = cambiosRevision(r, perfil, {
        zonasPeor: [...o.respuestas.filter(x => x.va === 'peor').map(x => x.zona), ...nuevas],
        zonasMejor: o.respuestas.filter(x => x.va === 'mejor' || x.va === 'ya').map(x => ({ zona: x.zona, del: x.va === 'ya' })),
        activos,
        ejercicio,
        // Del mismo movimiento, que haya en el gimnasio y que se quiera hacer.
        candidatos: b => {
          const original = ejercicio(b.ejercicio)
          if (!original) return []
          const patron = patronGenerador(original)
          return (catalogoCargado()?.ejercicios ?? []).filter(e => e.categoria === 'strength' && !evitados.has(e.id) && (!g || hayEn(e, material)) && !quitadoPor(e, p.noQuiero) && patronGenerador(e) === patron)
        },
      })
      if (cambios.length) await db.rutinas.put(aplicarCambios(r, cambios))
    }
    const rev: Revision = { fecha: hoyISO(), estado: o.estado, respuestas: o.respuestas, cambios }
    const id = (await db.revisiones.add(rev)) as number
    return { ...rev, id }
  })
}

/**
 * Deshace un cambio de una revisión: el bloque vuelve a como estaba. Si lo cambió algo después (otra revisión), no se
 * toca y devuelve false; así no queda marcado como deshecho un cambio que sigue puesto.
 */
export async function deshacerCambio(revisionId: number, uid: string): Promise<boolean> {
  return db.transaction('rw', [db.rutinas, db.revisiones], async () => {
    const rev = await db.revisiones.get(revisionId)
    const c = rev?.cambios.find(x => x.uid === uid && !x.deshecho)
    const r = await rutinaActiva()
    if (!rev || !c || !r) return false
    const deshecha = aplicarCambios(r, [c], true)
    if (JSON.stringify(deshecha) === JSON.stringify(r)) return false
    await db.rutinas.put(deshecha)
    await db.revisiones.put({ ...rev, cambios: rev.cambios.map(x => (x === c ? { ...x, deshecho: true } : x)) })
    return true
  })
}
