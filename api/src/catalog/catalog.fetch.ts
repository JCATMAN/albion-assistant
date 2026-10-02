/** HTTP GET used to download items.json. Tests inject a fake. */
export const CATALOG_FETCH = Symbol('CATALOG_FETCH');

export interface CatalogResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type CatalogFetch = (url: string) => Promise<CatalogResponse>;
