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

export function estimateAmmoPouchSalePrice(item: RoomShopItem, bundleSize = DEFAULT_AMMO_BUNDLE_SIZE): number {
  return Math.max(1, Math.floor((item.price / bundleSize) * SHOP_SELL_RATE));
}

export function estimateInventorySalePrice(code: string, item: RoomShopItem, bundleSize = DEFAULT_AMMO_BUNDLE_SIZE): number {
  if (isDamagedAmmoCode(code)) {
    return Math.max(1, Math.floor((item.price / bundleSize) * DAMAGED_AMMO_SELL_RATE));
  }
  return Math.max(1, Math.floor(item.price * SHOP_SELL_RATE));
}
