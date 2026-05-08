import assert from 'node:assert/strict';
import type { RoomShopItem } from '../src/world.js';
import {
  buildShopStockEvents,
  buildShopTalkEvents,
  canAfford,
  catalogCodeForSale,
  estimateAmmoPouchSalePrice,
  estimateInventorySalePrice,
  findLocalShopBuyItem,
  findLocalShopSaleItem,
  isDamagedAmmoCode,
  listShopItems,
  originalAmmoCodeFromDamaged,
  presentShop,
  resolveShopBuyDecision,
  resolveShopPurchase,
  resolveShopSellDecision,
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
  'NPC: Test Shop clerk (shopkeeper).',
  'Stock: 2 catalog item(s); static catalog; refreshed whenever the world fixture is reloaded.',
  'itm-sting-arrow practice arrow — 1 trias',
  'itm-test-blade test blade — 3 trias',
]);
assert.equal(presentShop({ code: 'test-shop', name: 'Test Shop', items: shopItems }).npc.name, 'Test Shop clerk');
assert.deepEqual(buildShopTalkEvents(), ['No shopkeeper is present here.']);
assert.deepEqual(buildShopTalkEvents({ code: 'test-shop', name: 'Test Shop', items: shopItems }), [
  'Test Shop clerk is here as shopkeeper.',
  'Test Shop clerk says, "Browse the catalog, ask about stock, or trade when you are ready."',
]);
assert.deepEqual(buildShopStockEvents(), ['No shop inventory is present here.']);
assert.deepEqual(buildShopStockEvents({ code: 'test-shop', name: 'Test Shop', items: shopItems }), [
  'Test Shop stock report: 2 catalog item(s).',
  'Refresh: static catalog; refreshed whenever the world fixture is reloaded.',
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

const detailForCode = (code: string) => ({
  name: code === 'damaged-itm-sting-arrow' ? 'damaged practice arrow' : code === 'itm-sting-arrow' ? 'practice arrow' : 'test blade',
  category: code.includes('arrow') ? 'ammo' : 'weapon',
  bundleSize: code.includes('arrow') ? 5 : undefined,
});
assert.deepEqual(resolveShopSellDecision(undefined, 'itm-test-blade', ['itm-test-blade'], detailForCode), {
  allowed: false,
  reason: 'no_shop',
  events: ['No shop is present here.'],
});
assert.deepEqual(resolveShopSellDecision(testShop, '', ['itm-test-blade'], detailForCode), {
  allowed: false,
  reason: 'missing_code',
  events: ['Specify a carried item code: shop sell <code>.'],
});
assert.deepEqual(resolveShopSellDecision(testShop, 'itm-missing', ['itm-test-blade'], detailForCode), {
  allowed: false,
  reason: 'not_carried',
  events: ['You are not carrying "itm-missing".'],
});
assert.deepEqual(resolveShopSellDecision(testShop, 'itm-unknown', ['itm-unknown'], detailForCode), {
  allowed: false,
  reason: 'shop_does_not_buy',
  events: ['This shop does not buy itm-unknown.'],
});
assert.deepEqual(resolveShopSellDecision(testShop, 'itm-test-blade', ['itm-test-blade'], detailForCode), {
  allowed: true,
  source: 'inventory',
  inventoryIndex: 0,
  itemCode: 'itm-test-blade',
  catalogItem: testBlade,
  sellPrice: 2,
  events: ['You sell test blade for 2 trias.'],
});
assert.deepEqual(resolveShopSellDecision(testShop, 'damaged-itm-sting-arrow', ['damaged-itm-sting-arrow'], detailForCode), {
  allowed: true,
  source: 'inventory',
  inventoryIndex: 0,
  itemCode: 'damaged-itm-sting-arrow',
  catalogItem: practiceArrow,
  sellPrice: 1,
  events: ['You sell damaged practice arrow for 1 trias.'],
});
assert.deepEqual(resolveShopSellDecision(testShop, 'practice arrow', [], detailForCode, () => 3), {
  allowed: true,
  source: 'ammoPouch',
  itemCode: 'itm-sting-arrow',
  catalogItem: practiceArrow,
  sellPrice: 1,
  remainingAmmo: 2,
  events: ['You sell one practice arrow from your ammo pouch for 1 trias. 2 remain.'],
});

console.log(JSON.stringify({ ok: true, suite: 'unit:economy', shopListFormattingChecked: true, shopNpcPresentationChecked: true, shopBuyDecisionChecked: true, shopSellDecisionChecked: true }, null, 2));
