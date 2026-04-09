const SystemSetting = require("../models/SystemSetting");

async function getRationAllocation() {
  const setting = await SystemSetting.findOne({
    key: "distributor:global:settings",
  })
    .select("value")
    .lean();

  const alloc = setting?.value?.allocation || {};
  return {
    A: Number(alloc.A) || 5,
    B: Number(alloc.B) || 4,
    C: Number(alloc.C) || 3,
  };
}

async function rationQtyByCategory(cat) {
  const allocation = await getRationAllocation();
  return allocation[cat] ?? 3;
}

function makeTokenCode() {
  return `T-${Math.floor(100000 + Math.random() * 900000)}`;
}

module.exports = { rationQtyByCategory, makeTokenCode };
