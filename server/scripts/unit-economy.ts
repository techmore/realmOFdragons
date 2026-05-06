import assert from 'node:assert/strict';
import type { RoomShopItem } from '../src/world.js';
import {
  canAfford,
  catalogCodeForSale,
  estimateAmmoPouchSalePrice,
  estimateInventorySalePrice,
  findLocalShopBuyItem,
  findLocalShopSaleItem,
  isDamagedAmmoCode,
  listShopItems,
  originalAmmoCodeFromDamaged,
  resolveShopBuyDecision,
  resolveShopPurchase,
} from '../src/economy.js';

const practiceArrow: RoomShopItem = {
  code: 'itm-sting-arrow',
  name: 'practice arrow',
  price: 1,
  currency: 'trias',
};

const testBlade: RoomShopItem = {
  code: 'itm-test-blade',
  name: 'test blade',
  price: 3,
  currency: 'trias',
};

const shopItems = [practiceArrow, testBlade];

assert.equal(isDamagedAmmoCode('damaged-itm-sting-arrow'), true);
assert.equal(isDamagedAmmoCode('damaged itm-sting-arrow'), true);
assert.equal(isDamagedAmmoCode('itm-sting-arrow'), false);
assert.equal(originalAmmoCodeFromDamaged('damaged-itm-sting-arrow'), 'itm-sting-arrow');
assert.equal(catalogCodeForSale('damaged-itm-sting-arrow'), 'itm-sting-arrow');
assert.equal(catalogCodeForSale('itm-test-blade'), 'itm-test-blade');

assert.equal(findLocalShopSaleItem(shopItems, 'itm-test-blade')?.code, 'itm-test-blade');
assert.equal(findLocalShopSaleItem(shopItems, 'test blade')?.code, 'itm-test-blade');
assert.equal(findLocalShopSaleItem(shopItems, 'damaged-itm-sting-arrow')?.code, 'itm-sting-arrow');
assert.equal(findLocalShopSaleItem(shopItems, 'itm-unknown-arrow'), undefined);
assert.equal(findLocalShopBuyItem(shopItems, 'practice arrow')?.code, 'itm-sting-arrow');
assert.equal(findLocalShopBuyItem(shopItems, 'damaged-itm-sting-arrow'), undefined);

assert.equal(estimateInventorySalePrice('itm-test-blade', testBlade), 2);
assert.equal(estimateInventorySalePrice('damaged-itm-sting-arrow', practiceArrow, 5), 1);
assert.equal(estimateAmmoPouchSalePrice(practiceArrow, 5), 1);
assert.equal(estimateAmmoPouchSalePrice({ ...practiceArrow, price: 12 }, 5), 1);
assert.equal(estimateAmmoPouchSalePrice({ ...practiceArrow, price: 20 }, 5), 3);

const wallet = { plat: 1, trias: 3, lucan: 0, silk: 0 };
assert.equal(canAfford(wallet, practiceArrow), true);
assert.equal(canAfford(wallet, { ...practiceArrow, price: 4 }), false);
assert.deepEqual(resolveShopPurchase(practiceArrow, wallet, 'ammo', 5), {
  item: practiceArrow,
  delivery: 'ammoPouch',
  quantity: 5,
  affordable: true,
});
assert.deepEqual(resolveShopPurchase(testBlade, wallet, 'weapon'), {
  item: testBlade,
  delivery: 'inventory',
  quantity: 1,
  affordable: true,
});
assert.equal(resolveShopPurchase({ ...testBlade, price: 4 }, wallet, 'weapon').affordable, false);

assert.deepEqual(listShopItems(), ['No shop is open in this location.']);
assert.deepEqual(listShopItems({ code: 'test-shop', name: 'Test Shop', items: shopItems }), [
  'Test Shop:',
  'itm-sting-arrow practice arrow — 1 trias',
  'itm-test-blade test blade — 3 trias',
]);

const testShop = { code: 'test-shop', name: 'Test Shop', items: shopItems };
assert.deepEqual(resolveShopBuyDecision(testShop, '', wallet), {
  allowed: false,
  reason: 'missing_code',
  events: ['Specify an item code or name: shop buy <code>.'],
});
assert.deepEqual(resolveShopBuyDecision(undefined, 'itm-test-blade', wallet), {
  allowed: false,
  reason: 'no_shop',
  events: ['No shop is present here.'],
});
assert.deepEqual(resolveShopBuyDecision(testShop, 'itm-missing', wallet), {
  allowed: false,
  reason: 'not_found',
  events: ['I could not find "itm-missing" here.'],
});
assert.deepEqual(resolveShopBuyDecision(testShop, 'itm-test-blade', { ...wallet, trias: 2 }), {
  allowed: false,
  reason: 'unaffordable',
  events: ['You cannot afford test blade: 3 trias required.'],
});
assert.deepEqual(resolveShopBuyDecision(testShop, 'itm-test-blade', wallet), {
  allowed: true,
  item: testBlade,
  purchase: {
    item: testBlade,
    delivery: 'inventory',
    quantity: 1,
    affordable: true,
  },
  events: ['You buy test blade for 3 trias.'],
});
assert.deepEqual(resolveShopBuyDecision(testShop, 'practice arrow', wallet, () => ({ category: 'ammo', bundleSize: 7 })), {
  allowed: true,
  item: practiceArrow,
  purchase: {
    item: practiceArrow,
    delivery: 'ammoPouch',
    quantity: 7,
    affordable: true,
  },
  events: ['You buy practice arrow for 1 trias (7 bundled).'],
});

console.log(JSON.stringify({ ok: true, suite: 'unit:economy', shopListFormattingChecked: true, shopBuyDecisionChecked: true }, null, 2));
