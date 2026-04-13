"use strict";

const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const QRCodeGen = require("qrcode");

const Token = require("../models/Token");
const DistributionRecord = require("../models/DistributionRecord");
const Distributor = require("../models/Distributor");
const User = require("../models/User");
const StockLedger = require("../models/StockLedger");
const DistributionSession = require("../models/DistributionSession");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function formatDateTime(d) {
  const dt = new Date(d || Date.now());
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yyyy = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2, "0");
  const mi = String(dt.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

async function getDistributorName(distributorId) {
  const dist = await Distributor.findById(distributorId)
    .select("userId")
    .lean();
  if (!dist?.userId) return "N/A";
  const user = await User.findById(dist.userId).select("name").lean();
  return user?.name || "N/A";
}

async function generateReceipt(tokenId) {
  const receiptsDir = path.resolve(
    process.cwd(),
    process.env.RECEIPTS_DIR || "./receipts",
  );
  ensureDir(receiptsDir);

  const token = await Token.findById(tokenId)
    .populate("consumerId", "name consumerCode ward unionName category")
    .lean();
  if (!token) {
    const err = new Error("Token not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  const record = await DistributionRecord.findOne({
    tokenId: token._id,
  }).lean();
  const distributorName = await getDistributorName(token.distributorId);

  const filePath = path.resolve(receiptsDir, `${token.tokenCode}.pdf`);

  await new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ size: "A5", margin: 32 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(18).text("আমার রেশন — বিতরণ রসিদ", { align: "center" });
    doc.moveDown(0.6).fontSize(10).text("─────────────────────────────");

    const consumer = token.consumerId || {};
    doc.text(`ভোক্তার নাম:   ${consumer.name || "N/A"}`);
    doc.text(`ভোক্তা কোড:   ${consumer.consumerCode || "N/A"}`);
    doc.text(
      `ওয়ার্ড / ইউনিয়ন: ${consumer.ward || "N/A"} / ${consumer.unionName || "N/A"}`,
    );
    doc.text(`শ্রেণী:        ${consumer.category || "N/A"}`);

    doc.moveDown(0.3).text("─────────────────────────────");
    doc.text(`টোকেন নম্বর:  ${token.tokenCode}`);
    doc.text(
      `তারিখ:        ${formatDateTime(token.usedAt || token.issuedAt || token.createdAt)}`,
    );
    doc.text(`বরাদ্দ:       ${Number(token.rationQtyKg || 0).toFixed(2)} কেজি`);
    doc.text(
      `প্রদত্ত:      ${record ? Number(record.actualKg || 0).toFixed(2) : "যাচাই বাকি"} কেজি`,
    );
    doc.text(`ওজন যাচাই:   ${record ? "✓ হয়েছে" : "✗ হয়নি"}`);
    doc.text(`বিতরণকারী:   ${distributorName}`);
    doc.moveDown(0.3).text("─────────────────────────────");

    const qrBuffer = await QRCodeGen.toBuffer(token.tokenCode, {
      type: "png",
      width: 80,
      margin: 1,
    });
    const x = (doc.page.width - 80) / 2;
    doc.image(qrBuffer, x, doc.y, { width: 80, height: 80 });
    doc.moveDown(4.2);

    doc.text("এই রসিদ সংরক্ষণ করুন। অভিযোগ: 16XXX", { align: "center" });
    doc.text("─────────────────────────────", { align: "center" });

    doc.end();
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });

  return filePath;
}

async function getOrGenerateReceipt(tokenCode) {
  const receiptsDir = path.resolve(
    process.cwd(),
    process.env.RECEIPTS_DIR || "./receipts",
  );
  ensureDir(receiptsDir);

  const filePath = path.resolve(receiptsDir, `${tokenCode}.pdf`);
  if (fs.existsSync(filePath)) return filePath;

  const token = await Token.findOne({ tokenCode }).select("_id").lean();
  if (!token) {
    const err = new Error("Token not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  return generateReceipt(token._id);
}

async function generateReconciliationReport(sessionId) {
  const receiptsDir = path.resolve(
    process.cwd(),
    process.env.RECEIPTS_DIR || "./receipts",
  );
  ensureDir(receiptsDir);

  const session = await DistributionSession.findById(sessionId).lean();
  if (!session) {
    const err = new Error("Session not found");
    err.code = "NOT_FOUND";
    throw err;
  }

  const [tokens, records, stockOutRows] = await Promise.all([
    Token.find({ sessionId: session._id })
      .populate("consumerId", "name consumerCode")
      .lean(),
    DistributionRecord.find({}).lean(),
    StockLedger.find({
      distributorId: session.distributorId,
      dateKey: session.dateKey,
      type: "OUT",
    }).lean(),
  ]);

  const recordMap = new Map(records.map((r) => [String(r.tokenId), r]));

  const issuedCount = tokens.length;
  const usedTokens = tokens.filter((t) => t.status === "Used");
  const usedCount = usedTokens.length;
  const iotVerifiedCount = usedTokens.filter(
    (t) => t.iotVerified === true,
  ).length;

  let totalExpectedKg = 0;
  let totalActualKg = 0;
  let totalMismatches = 0;
  const mismatchRows = [];

  for (const token of tokens) {
    totalExpectedKg += Number(token.rationQtyKg || 0);
    const rec = recordMap.get(String(token._id));
    if (!rec) continue;
    totalActualKg += Number(rec.actualKg || 0);
    if (rec.mismatch) {
      totalMismatches += 1;
      mismatchRows.push({
        tokenCode: token.tokenCode,
        consumer:
          token.consumerId?.name || token.consumerId?.consumerCode || "N/A",
        expected: Number(rec.expectedKg || 0),
        actual: Number(rec.actualKg || 0),
      });
    }
  }

  const discrepancy = totalExpectedKg - totalActualKg;
  const stockDeducted = stockOutRows.reduce(
    (s, row) => s + Number(row.qtyKg || 0),
    0,
  );
  const stockVsActual = stockDeducted - totalActualKg;
  const distributorName = await getDistributorName(session.distributorId);

  const filePath = path.resolve(
    receiptsDir,
    `reconciliation-${session._id}.pdf`,
  );

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc
      .fontSize(16)
      .text("আমার রেশন — সেশন সমন্বয় রিপোর্ট", { align: "center" });
    doc
      .moveDown(0.3)
      .fontSize(10)
      .text("─────────────────────────────────────────", { align: "center" });

    doc.text(`সেশন আইডি: ${session._id}`);
    doc.text(`তারিখ: ${session.dateKey}`);
    doc.text(`বিতরণকারী: ${distributorName}`);
    doc.moveDown(0.2).text("─────────────────────────────────────────");

    doc.text(`মোট টোকেন জারি:     ${issuedCount}`);
    doc.text(`মোট বিতরণ সম্পন্ন: ${usedCount}`);
    doc.text(`আইওটি যাচাই:        ${iotVerifiedCount}`);
    doc.text(`ওজন গরমিল:          ${totalMismatches}`);
    doc.moveDown(0.2).text("─────────────────────────────────────────");

    doc.text(`মোট প্রত্যাশিত (কেজি): ${totalExpectedKg.toFixed(2)}`);
    doc.text(`মোট প্রদত্ত (কেজি):    ${totalActualKg.toFixed(2)}`);
    doc.text(`মোট বিচ্যুতি (কেজি):   ${discrepancy.toFixed(2)}`);
    doc.text(`গুদাম কর্তন (কেজি):    ${stockDeducted.toFixed(2)}`);
    doc.text(`গুদাম বনাম প্রদত্ত:    ${stockVsActual.toFixed(2)} কেজি`);

    doc.moveDown(0.2).text("─────────────────────────────────────────");
    doc.text("মিসম্যাচ টোকেন তালিকা (সর্বোচ্চ ২০)");
    doc.text("টোকেন | ভোক্তা | প্রত্যাশিত | প্রদত্ত | পার্থক্য");

    mismatchRows.slice(0, 20).forEach((row) => {
      const diff = row.expected - row.actual;
      doc.text(
        `${row.tokenCode} | ${row.consumer} | ${row.expected.toFixed(2)} | ${row.actual.toFixed(2)} | ${diff.toFixed(2)}`,
      );
    });

    doc.moveDown(1);
    doc.text("বিতরণকারীর স্বাক্ষর: _______________");
    doc.text("তারিখ: _______________");
    doc.text("─────────────────────────────────────────");

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return filePath;
}

module.exports = {
  generateReceipt,
  getOrGenerateReceipt,
  generateReconciliationReport,
};
