import { CatalogLocale } from '../catalog/item-name.index';

export interface PriceQuery {
  item: string;
  cities?: string;
  qualities?: string;
  enchantment?: number;
  locale?: CatalogLocale;
}

export interface PriceCell {
  city: string;
  quality: number;
  enchantment: number;
  sellMin: number | null;
  sellAmount: number | null;
  sellAvg: number | null;
  buyMax: number | null;
  buyAmount: number | null;
  buyAvg: number | null;
  updatedAt: string | null;
  source: 'nats' | 'api' | null;
  status: 'fresh' | 'stale' | 'missing';
  iconUrl: string;
}

export interface PriceResponse {
  uniqueName: string;
  name: string;
  cells: PriceCell[];
}
