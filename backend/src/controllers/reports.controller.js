const Token = require("../models/Token");
const DistributionRecord = require("../models/DistributionRecord");

async function reportSummary(req, res) {
  const [totalTokens, usedTokens, mismatches] = await Promise.all([
    Token.countDocuments({}),
    Token.countDocuments({ status: "Used" }),
    DistributionRecord.countDocuments({ mismatch: true })
  ]);

  res.json({ totalTokens, usedTokens, mismatches });
}

module.exports = { reportSummary };
