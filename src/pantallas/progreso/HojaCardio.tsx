// Apuntar cardio fuera del gimnasio: qué (caminar, bici…) y cuántos minutos. Cuenta para el cardio de la semana.
import { useState } from 'react'
import { apuntarCardio } from '../../datos/acciones/cuerpo'
import type { TipoCardio } from '../../datos/tipos'
import { pasosDeCardio, TIPOS_CARDIO } from '../../dominio/cardio'
import { num } from '../../dominio/formato'
import { hoyISO } from '../../dominio/fechas'
import { Chip, FilaInterruptor, Hoja, Ico, Stepper, useUnaVez } from '../../ui/componentes'
import { useNav, type Ruta } from '../../app/nav'
import { useAviso } from '../../ui/aviso'
import { useAjustes, usePerfilCargado } from '../../datos/hooks'
import { t } from '../../i18n'

export function HojaCardio({ ruta }: { ruta: Ruta<'hoja-cardio'> }) {
  const perfil = usePerfilCargado()
  // Con el perfil ya leído: el tipo de partida es el primero que eligió en Pasos y cardio.
  if (!perfil) return <Hoja titulo={t('Apuntar cardio')}><p className="muted">{t('Cargando…')}</p></Hoja>
  return <FormCardio fecha={ruta.d?.fecha ?? hoyISO()} inicial={perfil.cardioTipos?.[0] ?? 'caminar'} />
}

function FormCardio({ fecha, inicial }: { fecha: string; inicial: TipoCardio }) {
  const nav = useNav()
  const aviso = useAviso()
  const unaVez = useUnaVez()
  const [tipo, setTipo] = useState<TipoCardio>(inicial)
  const [min, setMin] = useState(20)
  // Correr cuenta también como pasos (un trote): se dice antes de guardar y en el aviso.
  // Con Health Connect, el móvil o el reloj ya los contó si iba encima: de partida no se suman.
  const conMovil = useAjustes().fuentePasos === 'auto'
  const [sumar, setSumar] = useState<boolean | null>(null)
  const sumarPasos = sumar ?? !conMovil
  const posibles = pasosDeCardio(tipo, min)
  const pasos = sumarPasos ? posibles : 0
  const guardar = unaVez(async () => {
    const deshacer = await apuntarCardio(fecha, tipo, min, sumarPasos)
    nav.hoja(null)
    const que = t('Apuntado: {min} min de {tipo}', { min, tipo: t(TIPOS_CARDIO.find(x => x.v === tipo)!.t).toLowerCase() })
    aviso(pasos ? t('{que} (≈ {n} pasos)', { que, n: num(pasos, 0) }) : que, deshacer)
  })
  return (
    <Hoja titulo={t('Apuntar cardio')} sub={t('Lo que haces fuera de las pesas.')}>
      <span className="lbl fl">{t('¿Qué has hecho?')}</span>
      <div className="chips mt8">{TIPOS_CARDIO.map(c => <Chip key={c.v} on={tipo === c.v} onClick={() => setTipo(c.v)}><Ico n={c.ico} />{t(c.t)}</Chip>)}</div>
      <span className="lbl fl mt16">{t('Minutos')}</span>
      <div className="mt8"><Stepper valor={min} paso={5} min={5} max={600} decimales={0} sufijo="min" etiqueta={t('Minutos')} onCambio={setMin} /></div>
      {posibles > 0 && (
        <div className="list mt12">
          <FilaInterruptor ico="footprints" titulo={t('Sumar a mis pasos: ≈ {n}', { n: num(posibles, 0) })} etiqueta={t('Sumar a mis pasos')}
            d={conMovil ? t('Solo si no llevabas el móvil ni el reloj: si los llevabas, ya están contados') : t('Cuenta también para tus pasos del día')}
            on={sumarPasos} onCambio={setSumar} />
        </div>
      )}
      <button className="btn mt16" onClick={() => void guardar()}>{t('Guardar')}</button>
    </Hoja>
  )
}
