import { AlertSide } from '../alerts/alert.service';

export interface AlertReplyInput {
  name: string;
  city: string;
  side: AlertSide;
  target: number;
  current: number | null;
  replaced: boolean;
}

export interface AlertReply {
  save: boolean;
  title: string;
  description: string;
}

/** Decides whether to store the watch and the Spanish text Discord shows. */
export function describeAlert(input: AlertReplyInput): AlertReply {
  const target = silver(input.target);
  if (input.current !== null && crossed(input.side, input.target, input.current)) {
    const now = silver(input.current);
    if (input.side === 'buy') {
      return {
        save: false,
        title: 'Ya cruzó el precio',
        description: `La compra en ${input.city} ya está en ${now}, por encima de ${target}. No guardé el aviso.`,
      };
    }
    return {
      save: false,
      title: 'Ya cruzó el precio',
      description: `La venta en ${input.city} ya está en ${now}, por debajo de ${target}. No guardé el aviso.`,
    };
  }
  const title = input.replaced ? 'Aviso actualizado' : 'Aviso guardado';
  if (input.side === 'buy') {
    const now =
      input.current === null
        ? `Todavía no hay compra en ${input.city}.`
        : `Ahora está en ${silver(input.current)}.`;
    return {
      save: true,
      title,
      description: `Te aviso en este canal cuando la compra de ${input.name} en ${input.city} suba a ${target} o más. ${now}`,
    };
  }
  const now =
    input.current === null
      ? `Todavía no hay venta en ${input.city}.`
      : `Ahora está en ${silver(input.current)}.`;
  return {
    save: true,
    title,
    description: `Te aviso en este canal cuando la venta de ${input.name} en ${input.city} baje a ${target} o menos. ${now}`,
  };
}

function crossed(side: AlertSide, target: number, price: number): boolean {
  if (side === 'buy') {
    return price >= target;
  }
  return price <= target;
}

function silver(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
