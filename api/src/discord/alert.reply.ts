import { AlertSide } from '../alerts/alert.service';

export interface AlertScope {
  city?: string;
  quality?: number;
  enchantment?: number;
}

export interface AlertHit {
  city: string;
  quality: number;
  enchantment: number;
  price: number;
}

export interface AlertReplyInput {
  name: string;
  side: AlertSide;
  target: number;
  scope: AlertScope;
  hit: AlertHit | null;
  replaced: boolean;
}

export interface AlertReply {
  save: boolean;
  title: string;
  description: string;
}

interface PricedCell {
  city: string;
  quality: number;
  enchantment: number;
  sellMin: number | null;
  buyMax: number | null;
}

/** The best cell that already meets the target. Sell prefers the lowest price. */
export function bestAlertHit(
  cells: PricedCell[],
  side: AlertSide,
  target: number,
): AlertHit | null {
  let best: AlertHit | null = null;
  for (const cell of cells) {
    const price = side === 'buy' ? cell.buyMax : cell.sellMin;
    if (price === null || price <= 0 || !crossed(side, target, price)) {
      continue;
    }
    const hit: AlertHit = {
      city: cell.city,
      quality: cell.quality,
      enchantment: cell.enchantment,
      price,
    };
    if (best === null || betterHit(side, hit, best)) {
      best = hit;
    }
  }
  return best;
}

/** Decides whether to store the watch and the Spanish text Discord shows. */
export function describeAlert(input: AlertReplyInput): AlertReply {
  const target = silver(input.target);
  if (input.hit) {
    const now = silver(input.hit.price);
    const where = place(input.hit);
    if (input.side === 'buy') {
      return {
        save: false,
        title: 'Ya cruzó el precio',
        description: `La compra en ${where} ya está en ${now}, por encima de ${target}. No guardé el aviso.`,
      };
    }
    return {
      save: false,
      title: 'Ya cruzó el precio',
      description: `La venta en ${where} ya está en ${now}, por debajo de ${target}. No guardé el aviso.`,
    };
  }
  const title = input.replaced ? 'Aviso actualizado' : 'Aviso guardado';
  const where = scopePlace(input.scope);
  const placeText = where === '' ? '' : ` en ${where}`;
  if (input.side === 'buy') {
    return {
      save: true,
      title,
      description: `Te aviso en este canal cuando la compra de ${input.name}${placeText} suba a ${target} o más.`,
    };
  }
  return {
    save: true,
    title,
    description: `Te aviso en este canal cuando la venta de ${input.name}${placeText} baje a ${target} o menos.`,
  };
}

function betterHit(side: AlertSide, candidate: AlertHit, current: AlertHit): boolean {
  if (candidate.price !== current.price) {
    return side === 'buy' ? candidate.price > current.price : candidate.price < current.price;
  }
  return candidate.city < current.city;
}

function crossed(side: AlertSide, target: number, price: number): boolean {
  if (side === 'buy') {
    return price >= target;
  }
  return price <= target;
}

function place(hit: AlertHit): string {
  return `${hit.city}, ${qualityName(hit.quality)}, encantamiento ${hit.enchantment}`;
}

function scopePlace(scope: AlertScope): string {
  const parts: string[] = [];
  if (scope.city) {
    parts.push(scope.city);
  }
  if (scope.quality !== undefined) {
    parts.push(qualityName(scope.quality));
  }
  if (scope.enchantment !== undefined) {
    parts.push(`encantamiento ${scope.enchantment}`);
  }
  return parts.join(', ');
}

function qualityName(quality: number): string {
  const names = ['', 'Normal', 'Buena', 'Destacada', 'Excelente', 'Obra maestra'];
  return names[quality] ?? `Calidad ${quality}`;
}

function silver(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
