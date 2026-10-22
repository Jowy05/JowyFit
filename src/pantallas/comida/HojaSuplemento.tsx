// Cambiar cuánto se toma de un suplemento («10 g» de creatina en vez de «3-5 g»).
// El batido de proteína, además, dice cuánta proteína lleva: es lo que se suma al día al marcarlo.
import { useState } from 'react'
import { db } from '../../datos/db'
import { guardarPerfil } from '../../datos/repos'
import { batidoDe, dosisDe, dosisPorDefecto, esBatido, kcalBatido } from '../../dominio/comida'
import { hoyISO } from '../../dominio/fechas'
import { Hoja, Ico, Stepper, useUnaVez, LARGO } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { usePerfilCargado } from '../../datos/hooks'
import type { Perfil } from '../../datos/tipos'
import { propio } from '../../dominio/claves'
import { t } from '../../i18n'

export function HojaSuplemento({ ruta }: { ruta: Ruta<'sheet-supl'> }) {
  // El formulario se monta con el perfil ya cargado: con el de por defecto, «Guardar» pisaba el batido con 24 g.
  const perfil = usePerfilCargado()
  const s = ruta.d.nombre
  if (!perfil) return <Hoja titulo={t(s)}><p className="muted">{t('Cargando…')}</p></Hoja>
  return <Formulario perfil={perfil} s={s} />
}

function Formulario({ perfil, s }: { perfil: Perfil; s: string }) {
  const nav = useNav()
  const aviso = useAviso()
  const batido = esBatido(s)
  const [dosis, setDosis] = useState(() => { const v = propio(perfil.dosisSuplementos, s); return typeof v === 'string' ? v : '' })
  const [b, setB] = useState(batidoDe(perfil.batido))
  // Mientras no se toquen las kcal, siguen a la proteína.
  const [kcalTocadas, setKcalTocadas] = useState(!!perfil.batido && perfil.batido.kcal !== kcalBatido(perfil.batido.proteina))
  const unaVez = useUnaVez()

  const guardar = unaVez(async () => {
    await guardarPerfil({ dosisSuplementos: { ...perfil.dosisSuplementos, [s]: dosis.trim() }, ...(batido ? { batido: b } : {}) })
    if (batido) {
      // Lo mismo en el batido de Mis comidas y en el que ya se haya marcado hoy.
      // La de Mis comidas puede llevar el nombre traducido (las comidas de partida se crean en el idioma de la app).
      const nombres = [s.toLowerCase(), t(s).toLowerCase()]
      await db.plantillas.filter(p => nombres.includes(p.nombre.toLowerCase())).modify({ kcal: b.kcal, proteina: b.proteina })
      await db.comidas.where('fecha').equals(hoyISO()).filter(c => c.suplemento === s).modify({ kcal: b.kcal, proteina: b.proteina })
    }
    nav.hoja(null)
    aviso(t('Guardado: {nombre}', { nombre: `${t(s)}${dosis.trim() ? ` · ${dosis.trim()}` : ''}` }))
  })

  return (
    <Hoja titulo={t(s)} sub={t('Cuánto tomas')}>
      <span className="lbl fl">{t('Cantidad')}</span>
      <input className="inp" maxLength={LARGO.corto} value={dosis} onChange={e => setDosis(e.target.value)} placeholder={dosisPorDefecto(s) || t('p. ej. 1 cápsula')} aria-label={t('Cantidad de {nombre}', { nombre: t(s) })} />
      <p className="small muted mt4">{t('Escríbelo como lo tomas: «10 g», «2 cápsulas»…')} {dosisPorDefecto(s) ? t('Si lo dejas vacío, pone «{dosis}».', { dosis: dosisDe(undefined, s) }) : ''}</p>
      {batido && (
        <>
          <p className="lbl fl mt16">{t('Lo que lleva cada batido')}</p>
          <div className="grid2">
            <Stepper className="sm" valor={b.proteina} onCambio={v => setB({ proteina: v, kcal: kcalTocadas ? b.kcal : kcalBatido(v) })} paso={1} min={0} sufijo={t('g prot.')} etiqueta={t('Proteína del batido')} />
            <Stepper className="sm" valor={b.kcal} onCambio={v => { setKcalTocadas(true); setB({ ...b, kcal: v }) }} paso={10} min={0} sufijo="kcal" etiqueta={t('kcal del batido')} />
          </div>
          <p className="small muted mt4">{t('Mira el bote: viene por cacito. Al marcarlo en Comida, se suma al día.')}</p>
        </>
      )}
      <button className="btn mt20" onClick={() => void guardar()}><Ico n="check" b />{t('Guardar')}</button>
    </Hoja>
  )
}
