import {getTranslations} from 'next-intl/server';

export async function MovementList({rows}: {rows: Array<{movement: {id: number; quantityBefore: number; quantityChange: number; quantityAfter: number; createdAt: Date}; medicineName: string}>}) {
  const t = await getTranslations('Stock');
  return <section className="movement-list"><h2>{t('movements')}</h2>{rows.map(({movement, medicineName}) => <article key={movement.id}><strong>{medicineName}</strong><span dir="ltr">{movement.quantityBefore} {movement.quantityChange >= 0 ? '+' : ''}{movement.quantityChange} = {movement.quantityAfter}</span></article>)}</section>;
}
