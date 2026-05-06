import type { RoomShopItem } from './world.js';

export const SHOP_SELL_RATE = 0.75;
export const DAMAGED_AMMO_SELL_RATE = 0.25;
export const DEFAULT_AMMO_BUNDLE_SIZE = 5;

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

export function estimateAmmoPouchSalePrice(item: RoomShopItem, bundleSize = DEFAULT_AMMO_BUNDLE_SIZE): number {
  return Math.max(1, Math.floor((item.price / bundleSize) * SHOP_SELL_RATE));
}

export function estimateInventorySalePrice(code: string, item: RoomShopItem, bundleSize = DEFAULT_AMMO_BUNDLE_SIZE): number {
  if (isDamagedAmmoCode(code)) {
    return Math.max(1, Math.floor((item.price / bundleSize) * DAMAGED_AMMO_SELL_RATE));
  }
  return Math.max(1, Math.floor(item.price * SHOP_SELL_RATE));
}
