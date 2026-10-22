// ALT · Dibujo de cómo medir el cuello y la cintura con la cinta métrica.
import { t } from '../../i18n'

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
        <p><span className="kdot blue" /><b>{t('Cuello')}</b><small>{t('Justo bajo la nuez')}</small></p>
        <p><span className="kdot go" /><b>{t('Cintura')}</b><small>{t('A la altura del ombligo, sin apretar')}</small></p>
        <p className="muted small mt8">{t('Cinta métrica horizontal, después de soltar el aire.')}</p>
      </div>
    </div>
  )
}
