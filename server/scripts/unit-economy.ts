import assert from 'node:assert/strict';
import type { RoomShopItem } from '../src/world.js';
import {
  catalogCodeForSale,
  estimateAmmoPouchSalePrice,
  estimateInventorySalePrice,
  findLocalShopSaleItem,
  isDamagedAmmoCode,
  originalAmmoCodeFromDamaged,
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

assert.equal(estimateInventorySalePrice('itm-test-blade', testBlade), 2);
assert.equal(estimateInventorySalePrice('damaged-itm-sting-arrow', practiceArrow, 5), 1);
assert.equal(estimateAmmoPouchSalePrice(practiceArrow, 5), 1);
assert.equal(estimateAmmoPouchSalePrice({ ...practiceArrow, price: 12 }, 5), 1);
assert.equal(estimateAmmoPouchSalePrice({ ...practiceArrow, price: 20 }, 5), 3);

console.log(JSON.stringify({ ok: true, suite: 'unit:economy' }, null, 2));
