"use strict";

const Consumer = require("../models/Consumer");
const SystemSetting = require("../models/SystemSetting");

async function nextConsumerCode() {
  while (true) {
    const seqDoc = await SystemSetting.findOneAndUpdate(
      { key: "consumer:code:seq" },
      [
        {
          $set: {
            value: {
              seq: {
                $add: [{ $ifNull: ["$value.seq", 0] }, 1],
              },
            },
          },
        },
      ],
      { upsert: true, new: true },
    ).lean();

    const seq = Number(seqDoc?.value?.seq || 0);
    const code = `C${String(seq).padStart(4, "0")}`;
    const exists = await Consumer.exists({ consumerCode: code });
    if (!exists) return code;
  }
}

module.exports = {
  nextConsumerCode,
};
