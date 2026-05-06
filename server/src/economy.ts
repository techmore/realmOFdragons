import type { RoomShop, RoomShopItem } from './world.js';

export const SHOP_SELL_RATE = 0.75;
export const DAMAGED_AMMO_SELL_RATE = 0.25;
export const DEFAULT_AMMO_BUNDLE_SIZE = 5;

export type CurrencyWallet = Record<RoomShopItem['currency'], number>;

export type ShopPurchaseResolution = {
  item: RoomShopItem;
  delivery: 'ammoPouch' | 'inventory';
  quantity: number;
  affordable: boolean;
};

export type ShopBuyItemDetail = {
  category: string;
  bundleSize?: number;
};

export type ShopBuyDecision =
  | { allowed: false; reason: 'missing_code' | 'no_shop' | 'not_found' | 'unaffordable'; events: string[] }
  | { allowed: true; item: RoomShopItem; purchase: ShopPurchaseResolution; events: string[] };

export type ShopSellItemDetail = {
  name: string;
  category: string;
  bundleSize?: number;
};

export type ShopSellDecision =
  | { allowed: false; reason: 'no_shop' | 'missing_code' | 'not_carried' | 'shop_does_not_buy'; events: string[] }
  | {
      allowed: true;
      source: 'inventory';
      inventoryIndex: number;
      itemCode: string;
      catalogItem: RoomShopItem;
      sellPrice: number;
      events: string[];
    }
  | {
      allowed: true;
      source: 'ammoPouch';
      itemCode: string;
      catalogItem: RoomShopItem;
      sellPrice: number;
      remainingAmmo: number;
      events: string[];
    };

export function isDamagedAmmoCode(code: string): boolean {
  const normalized = code.toLowerCase();
  return normalized.startsWith('damaged-itm-') || normalized.startsWith('damaged itm-');
}

export function originalAmmoCodeFromDamaged(code: string): string {
  return code.toLowerCase().replace(/^damaged[- ]/, '');
}

export function catalogCodeForSale(code: string): string {
  return isDamagedAmmoCode(code) ? originalAmmoCodeFromDamaged(code) : code;
}

export function findLocalShopSaleItem(items: RoomShopItem[], code: string): RoomShopItem | undefined {
  const lowered = code.toLowerCase();
  const catalogCode = catalogCodeForSale(code);
  return items.find(
    (entry) =>
      entry.code.toLowerCase() === catalogCode ||
      entry.code.toLowerCase() === lowered ||
      entry.name.toLowerCase() === lowered,
  );
}

export function findLocalShopBuyItem(items: RoomShopItem[], code: string): RoomShopItem | undefined {
  const lowered = code.toLowerCase();
  return items.find((entry) => entry.code.toLowerCase() === lowered || entry.name.toLowerCase() === lowered);
}

export function canAfford(wallet: CurrencyWallet, item: RoomShopItem): boolean {
  return wallet[item.currency] >= item.price;
}

export function resolveShopPurchase(item: RoomShopItem, wallet: CurrencyWallet, itemCategory: string, bundleSize = DEFAULT_AMMO_BUNDLE_SIZE): ShopPurchaseResolution {
  const delivery = itemCategory === 'ammo' ? 'ammoPouch' : 'inventory';
  return {
    item,
    delivery,
    quantity: delivery === 'ammoPouch' ? bundleSize : 1,
    affordable: canAfford(wallet, item),
  };
}

export function listShopItems(shop?: RoomShop): string[] {
  if (!shop) return ['No shop is open in this location.'];
  const rows = shop.items.map((item) => `${item.code} ${item.name} — ${item.price} ${item.currency}`);
  return [`${shop.name}:`, ...rows];
}

export function resolveShopBuyDecision(
  shop: RoomShop | undefined,
  code: string,
  wallet: CurrencyWallet,
  itemDetailForPurchase: (item: RoomShopItem) => ShopBuyItemDetail = () => ({ category: 'inventory' }),
): ShopBuyDecision {
  const requestedCode = code.trim();
  if (!requestedCode) {
    return { allowed: false, reason: 'missing_code', events: ['Specify an item code or name: shop buy <code>.'] };
  }
  if (!shop) {
    return { allowed: false, reason: 'no_shop', events: ['No shop is present here.'] };
  }

  const item = findLocalShopBuyItem(shop.items, requestedCode);
  if (!item) {
    return { allowed: false, reason: 'not_found', events: [`I could not find "${requestedCode}" here.`] };
  }
  if (!canAfford(wallet, item)) {
    return { allowed: false, reason: 'unaffordable', events: [`You cannot afford ${item.name}: ${item.price} ${item.currency} required.`] };
  }

  const itemDetail = itemDetailForPurchase(item);
  const purchase = resolveShopPurchase(item, wallet, itemDetail.category, itemDetail.bundleSize);
  return {
    allowed: true,
    item,
    purchase,
    events: [`You buy ${item.name} for ${item.price} ${item.currency}${purchase.delivery === 'ammoPouch' ? ` (${purchase.quantity} bundled).` : '.'}`],
  };
}

export function resolveShopSellDecision(
  shop: RoomShop | undefined,
  code: string,
  inventory: string[],
  itemDetailForCode: (code: string) => ShopSellItemDetail,
  ammoCountForCode: (code: string) => number = () => 0,
): ShopSellDecision {
  if (!shop) {
    return { allowed: false, reason: 'no_shop', events: ['No shop is present here.'] };
  }

  const requestedCode = code.trim();
  if (!requestedCode) {
    return { allowed: false, reason: 'missing_code', events: ['Specify a carried item code: shop sell <code>.'] };
  }

  const lowered = requestedCode.toLowerCase();
  const inventoryIndex = inventory.findIndex(
    (entry) => entry.toLowerCase() === lowered || entry.toLowerCase().replace(/\s+/g, '-') === lowered,
  );
  if (inventoryIndex < 0) {
    const catalogItem = findLocalShopSaleItem(shop.items, lowered);
    const itemDetail = catalogItem ? itemDetailForCode(catalogItem.code) : undefined;
    if (!catalogItem || itemDetail?.category !== 'ammo' || ammoCountForCode(catalogItem.code) <= 0) {
      return { allowed: false, reason: 'not_carried', events: [`You are not carrying "${requestedCode}".`] };
    }

    const bundleSize = itemDetail.bundleSize ?? 1;
    const sellPrice = estimateAmmoPouchSalePrice(catalogItem, bundleSize);
    const remainingAmmo = Math.max(0, ammoCountForCode(catalogItem.code) - 1);
    return {
      allowed: true,
      source: 'ammoPouch',
      itemCode: catalogItem.code,
      catalogItem,
      sellPrice,
      remainingAmmo,
      events: [`You sell one ${catalogItem.name} from your ammo pouch for ${sellPrice} ${catalogItem.currency}. ${remainingAmmo} remain.`],
    };
  }

  const itemCode = inventory[inventoryIndex];
  const catalogItem = findLocalShopSaleItem(shop.items, itemCode);
  if (!catalogItem) {
    return { allowed: false, reason: 'shop_does_not_buy', events: [`This shop does not buy ${itemCode}.`] };
  }

  const itemDetail = itemDetailForCode(itemCode);
  const damagedAmmo = isDamagedAmmoCode(itemCode);
  const sellPrice = estimateInventorySalePrice(
    itemCode,
    catalogItem,
    damagedAmmo ? itemDetailForCode(catalogItem.code).bundleSize : undefined,
  );
  return {
    allowed: true,
    source: 'inventory',
    inventoryIndex,
    itemCode,
    catalogItem,
    sellPrice,
    events: [`You sell ${itemDetail.name} for ${sellPrice} ${catalogItem.currency}.`],
  };
}

export function estimateAmmoPouchSalePrice(item: RoomShopItem, bundleSize = DEFAULT_AMMO_BUNDLE_SIZE): number {
  return Math.max(1, Math.floor((item.price / bundleSize) * SHOP_SELL_RATE));
}

export function estimateInventorySalePrice(code: string, item: RoomShopItem, bundleSize = DEFAULT_AMMO_BUNDLE_SIZE): number {
  if (isDamagedAmmoCode(code)) {
    return Math.max(1, Math.floor((item.price / bundleSize) * DAMAGED_AMMO_SELL_RATE));
  }
  return Math.max(1, Math.floor(item.price * SHOP_SELL_RATE));
}
