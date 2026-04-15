"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  mapSingleItemQty,
  hydrateRecordItemFields,
  buildMismatchDetails,
} = require("../src/services/distributionRecord.service");

test("mapSingleItemQty maps normalized item and rounds qty", () => {
  const byItem = mapSingleItemQty("Rice", 3.4567);

  assert.equal(byItem["চাল"], 3.457);
  assert.equal(byItem["ডাল"], 0);
  assert.equal(byItem["পেঁয়াজ"], 0);
});

test("hydrateRecordItemFields preserves canonical by-item payload", () => {
  const hydrated = hydrateRecordItemFields({
    item: "ডাল",
    expectedKg: 4,
    actualKg: 3.5,
    expectedByItem: { চাল: 0, ডাল: 4, পেঁয়াজ: 0 },
    actualByItem: { চাল: 0, ডাল: 3.5, পেঁয়াজ: 0 },
  });

  assert.equal(hydrated.item, "ডাল");
  assert.deepEqual(hydrated.expectedByItem, { চাল: 0, ডাল: 4, পেঁয়াজ: 0 });
  assert.deepEqual(hydrated.actualByItem, { চাল: 0, ডাল: 3.5, পেঁয়াজ: 0 });
  assert.equal(hydrated.mismatchDetails.length, 1);
  assert.equal(hydrated.mismatchDetails[0].item, "ডাল");
});

test("buildMismatchDetails returns empty for equal item-wise values", () => {
  const expected = { চাল: 1, ডাল: 2, পেঁয়াজ: 0 };
  const actual = { চাল: 1, ডাল: 2, পেঁয়াজ: 0 };

  assert.deepEqual(buildMismatchDetails(expected, actual), []);
});
