// Cambiar cuánto se toma de un suplemento («10 g» de creatina en vez de «3-5 g»).
// El batido de proteína, además, dice cuánta proteína lleva: es lo que se suma al día al marcarlo.
import { useState } from 'react'
import { db } from '../../../datos/db'
import { guardarPerfil } from '../../../datos/repos'
import { batidoDe, dosisDe, dosisPorDefecto, esBatido, kcalBatido } from '../../../dominio/comida'
import { hoyISO } from '../../../dominio/fechas'
import { Hoja, Ico, Stepper, useUnaVez } from '../../comp'
import { useNav, type Ruta } from '../../nav'
import { useAviso } from '../../aviso'
import { usePerfil } from '../../datos'

export function HojaSuplemento({ ruta }: { ruta: Ruta }) {
  const nav = useNav()
  const aviso = useAviso()
  const perfil = usePerfil()
  const s = String(ruta.d?.nombre ?? '')
  const batido = esBatido(s)
  const [dosis, setDosis] = useState(perfil.dosisSuplementos?.[s] ?? '')
  const [b, setB] = useState(batidoDe(perfil.batido))
  // Mientras no se toquen las kcal, siguen a la proteína.
  const [kcalTocadas, setKcalTocadas] = useState(!!perfil.batido && perfil.batido.kcal !== kcalBatido(perfil.batido.proteina))
  const unaVez = useUnaVez()

  const guardar = unaVez(async () => {
    await guardarPerfil({ dosisSuplementos: { ...perfil.dosisSuplementos, [s]: dosis.trim() }, ...(batido ? { batido: b } : {}) })
    if (batido) {
      // Lo mismo en el batido de Mis comidas y en el que ya se haya marcado hoy.
      await db.plantillas.filter(p => p.nombre.toLowerCase() === s.toLowerCase()).modify({ kcal: b.kcal, proteina: b.proteina })
      await db.comidas.where('fecha').equals(hoyISO()).filter(c => c.suplemento === s).modify({ kcal: b.kcal, proteina: b.proteina })
    }
    nav.hoja(null)
    aviso(`Guardado: ${s}${dosis.trim() ? ` · ${dosis.trim()}` : ''}`)
  })

  return (
    <Hoja titulo={s} sub="Cuánto tomas">
      <span className="lbl fl">Cantidad</span>
      <input className="inp" value={dosis} onChange={e => setDosis(e.target.value)} placeholder={dosisPorDefecto(s) || 'p. ej. 1 cápsula'} aria-label={`Cantidad de ${s}`} />
      <p className="small muted mt4">Escríbelo como lo tomas: «10 g», «2 cápsulas»… {dosisPorDefecto(s) ? `Si lo dejas vacío, pone «${dosisDe(undefined, s)}».` : ''}</p>
      {batido && (
        <>
          <p className="lbl fl mt16">Lo que lleva cada batido</p>
          <div className="grid2">
            <Stepper className="sm" valor={b.proteina} onCambio={v => setB({ proteina: v, kcal: kcalTocadas ? b.kcal : kcalBatido(v) })} paso={1} min={0} sufijo="g prot." etiqueta="Proteína del batido" />
            <Stepper className="sm" valor={b.kcal} onCambio={v => { setKcalTocadas(true); setB({ ...b, kcal: v }) }} paso={10} min={0} sufijo="kcal" etiqueta="kcal del batido" />
          </div>
          <p className="small muted mt4">Mira el bote: viene por cacito. Al marcarlo en Comida, se suma al día.</p>
        </>
      )}
      <button className="btn mt20" onClick={() => void guardar()}><Ico n="check" b />Guardar</button>
    </Hoja>
  )
}
