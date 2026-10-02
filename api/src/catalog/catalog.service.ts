import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AppConfig } from '../config/app-config';
import { CATALOG_FETCH, CatalogFetch } from './catalog.fetch';
import {
  CatalogItem,
  CatalogLocale,
  catalogItemsFromPayload,
  createItemNameIndex,
  displayName,
  itemNameStartsWith,
  ItemNameIndex,
} from './item-name.index';
import { parseItemQuery } from './item-query.parser';

export interface ItemSuggestion {
  uniqueName: string;
  name: string;
  tier: number | null;
  enchantment: number;
}

const MAXIMUM_SUGGESTIONS = 25;

/** Downloads items.json, keeps a name index, and suggests items without Redis. */
@Injectable()
export class CatalogService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CatalogService.name);
  private index: ItemNameIndex | undefined;
  private refreshTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly config: AppConfig,
    @Inject(CATALOG_FETCH) private readonly fetchCatalog: CatalogFetch,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshCatalog();
    this.refreshTimer = setInterval(() => {
      void this.refreshCatalog();
    }, this.config.catalogRefreshMilliseconds);
    this.refreshTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  /** Reloads the catalog. The first failure aborts startup; a later one keeps the previous index. */
  async refreshCatalog(): Promise<void> {
    try {
      this.index = await this.downloadIndex();
    } catch (error) {
      if (!this.index) {
        throw error;
      }
      const stack = error instanceof Error ? error.stack : String(error);
      this.logger.error(
        'Catalog refresh failed; keeping the previous index',
        stack,
      );
    }
  }

  /** Looks up an id, including a base id when the query carries @enchantment. */
  findByUniqueName(uniqueName: string): CatalogItem | undefined {
    const index = this.index;
    if (!index) {
      return undefined;
    }
    const direct = index.get(uniqueName);
    if (direct) {
      return direct;
    }
    const baseName = uniqueName.replace(/@[0-4]$/, '');
    if (baseName === uniqueName) {
      return undefined;
    }
    return index.get(baseName);
  }

  /** Returns at most 25 suggestions. An exact unique name keeps its @enchantment. */
  suggest(query: string, locale: CatalogLocale = 'es'): ItemSuggestion[] {
    const index = this.requireIndex();
    const exact = this.exactSuggestion(index, query, locale);
    if (exact) {
      return [exact];
    }

    const parsed = parseItemQuery(query);
    const found = parsed.text ? index.findByToken(parsed.text) : [];
    const filtered =
      parsed.tier === undefined
        ? found
        : found.filter((item) => item.tier === parsed.tier);
    filtered.sort((left, right) => {
      const leftRank = itemNameStartsWith(left, parsed.text) ? 0 : 1;
      const rightRank = itemNameStartsWith(right, parsed.text) ? 0 : 1;
      return leftRank - rightRank;
    });
    const enchantment = parsed.enchantment ?? 0;
    return collapseEnchantmentCopies(filtered)
      .slice(0, MAXIMUM_SUGGESTIONS)
      .map((item) => ({
      uniqueName:
        enchantment > 0
          ? `${item.uniqueName.replace(/@[0-4]$/, '')}@${enchantment}`
          : item.uniqueName,
      name: displayName(item, locale),
      tier: item.tier,
      enchantment,
    }));
  }

  private exactSuggestion(
    index: ItemNameIndex,
    query: string,
    locale: CatalogLocale,
  ): ItemSuggestion | undefined {
    const trimmed = query.trim();
    const suffix = /^(.*)@([0-4])$/.exec(trimmed);
    const lookupName = suffix?.[1] ?? trimmed;
    const enchantment = suffix ? Number(suffix[2]) : 0;
    const item = index.get(trimmed) ?? index.get(lookupName);
    if (!item) {
      return undefined;
    }
    const baseName = item.uniqueName.replace(/@[0-4]$/, '');
    return {
      uniqueName: enchantment > 0 ? `${baseName}@${enchantment}` : item.uniqueName,
      name: displayName(item, locale),
      tier: item.tier,
      enchantment,
    };
  }

  private requireIndex(): ItemNameIndex {
    if (!this.index) {
      throw new ServiceUnavailableException('Catalog is not loaded');
    }
    return this.index;
  }

  private async downloadIndex(): Promise<ItemNameIndex> {
    const response = await this.fetchCatalog(this.config.itemsUrl);
    if (!response.ok) {
      throw new Error(
        `Catalog download failed with HTTP ${response.status}`,
      );
    }
    const payload: unknown = await response.json();
    return createItemNameIndex(catalogItemsFromPayload(payload));
  }
}

/** One row per base item. T5_BAG@1 uses the same Spanish name as T5_BAG. */
function collapseEnchantmentCopies(items: CatalogItem[]): CatalogItem[] {
  const seenBaseNames = new Set<string>();
  const collapsed: CatalogItem[] = [];
  for (const item of items) {
    const baseName = item.uniqueName.replace(/@[0-4]$/, '');
    if (seenBaseNames.has(baseName)) {
      continue;
    }
    seenBaseNames.add(baseName);
    collapsed.push(
      baseName === item.uniqueName ? item : { ...item, uniqueName: baseName },
    );
  }
  return collapsed;
}
