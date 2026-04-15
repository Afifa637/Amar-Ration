const Distributor = require("../models/Distributor");
const Consumer = require("../models/Consumer");
const Family = require("../models/Family");
const OMSCard = require("../models/OMSCard");
const QRCode = require("../models/QRCode");
const Token = require("../models/Token");
const AuditLog = require("../models/AuditLog");
const BlacklistEntry = require("../models/BlacklistEntry");
const OfflineQueue = require("../models/OfflineQueue");
const DistributionRecord = require("../models/DistributionRecord");
const DistributionSession = require("../models/DistributionSession");
const StockLedger = require("../models/StockLedger");
const SystemSetting = require("../models/SystemSetting");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendFieldUserApprovalEmail } = require("../services/email.service");
const { normalizeWardNo, buildWardMatchQuery } = require("../utils/ward.utils");
const {
  normalizeDivision,
  buildDivisionMatchQuery,
} = require("../utils/division.utils");

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function buildWardQuery(distributor) {
  const query = {};

  const divisionQuery = buildDivisionMatchQuery(distributor?.division);
  if (divisionQuery) {
    query.division = divisionQuery;
  }

  const wardInput = distributor?.wardNo || distributor?.ward;
  const wardQuery = buildWardMatchQuery(wardInput);
  if (wardQuery) {
    Object.assign(query, wardQuery);
  }

  return query;
}

async function getDistributorProfileByUserId(userId) {
  if (!userId) return null;
  return Distributor.findOne({ userId }).lean();
}

async function ensureDistributorProfile(reqUser) {
  const userId = reqUser?.userId;
  if (!userId) return null;

  let distributor = await Distributor.findOne({ userId }).lean();
  if (distributor) return distributor;

  const user = await User.findById(userId).lean();
  if (!user) return null;
  if (user.userType !== "Distributor" && user.userType !== "FieldUser") {
    return null;
  }

  const created = await Distributor.create({
    userId: user._id,
    wardNo: normalizeWardNo(user.wardNo || user.ward),
    division: normalizeDivision(user.division),
    district: user.district,
    upazila: user.upazila,
    unionName: user.unionName,
    ward: normalizeWardNo(user.ward || user.wardNo),
    authorityStatus: user.authorityStatus || "Active",
    authorityFrom: user.authorityFrom || new Date(),
    authorityTo: user.authorityTo,
  });

  return created.toObject();
}

async function getDistributorDashboard(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);

    if (!distributor) {
      return res.status(404).json({ message: "Distributor profile not found" });
    }

    const tokenDocs = await Token.find({ distributorId: distributor._id })
      .select("_id status rationQtyKg")
      .lean();

    const tokenIds = tokenDocs.map((t) => t._id);

    const wardQuery = buildWardQuery(distributor);

    const [
      totalConsumers,
      activeConsumers,
      pendingOffline,
      recentAudit,
      stockOutTodayAgg,
      mismatchCount,
    ] = await Promise.all([
      Consumer.countDocuments(wardQuery),
      Consumer.countDocuments({
        ...wardQuery,
        status: "Active",
      }),
      OfflineQueue.countDocuments({
        distributorId: distributor._id,
        status: "Pending",
      }),
      AuditLog.find({
        $or: [{ actorUserId: req.user.userId }, { actorType: "Distributor" }],
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      StockLedger.aggregate([
        {
          $match: {
            distributorId: distributor._id,
            dateKey: todayKey(),
            type: "OUT",
          },
        },
        {
          $group: {
            _id: null,
            totalKg: { $sum: "$qtyKg" },
          },
        },
      ]),
      DistributionRecord.countDocuments({
        tokenId: { $in: tokenIds },
        mismatch: true,
      }),
    ]);

    const issuedTokens = tokenDocs.length;
    const usedTokens = tokenDocs.filter((t) => t.status === "Used").length;

    res.json({
      distributor: {
        id: String(distributor._id),
        wardNo: distributor.wardNo || "",
        division: distributor.division || "",
        district: distributor.district || "",
        upazila: distributor.upazila || "",
        unionName: distributor.unionName || "",
        ward: distributor.ward || "",
        status: distributor.authorityStatus || "",
      },
      stats: {
        totalConsumers,
        activeConsumers,
        issuedTokens,
        usedTokens,
        mismatchCount,
        pendingOffline,
        stockOutTodayKg: stockOutTodayAgg[0]?.totalKg || 0,
      },
      recentAudit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
}

async function getBeneficiaries(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);

    if (!distributor) {
      return res.status(404).json({ message: "Distributor profile not found" });
    }

    const { tab = "long", q = "", status, ward } = req.query;

    const filter = {};

    Object.assign(filter, buildWardQuery(distributor));

    if (ward && ward !== "সব") {
      const explicitWard = buildWardMatchQuery(ward);
      if (explicitWard?.$or) {
        if (filter.$or) {
          filter.$and = filter.$and || [];
          filter.$and.push({ $or: filter.$or }, { $or: explicitWard.$or });
          delete filter.$or;
        } else {
          filter.$or = explicitWard.$or;
        }
      }
    }

    if (tab === "short") {
      filter.status = "Active";
    } else if (status && status !== "সব" && tab !== "flags") {
      filter.status = status;
    }

    const consumers = await Consumer.find(filter)
      .populate("familyId")
      .sort({ createdAt: -1 })
      .lean();

    const consumerIds = consumers.map((c) => c._id);

    const cards = await OMSCard.find({
      consumerId: { $in: consumerIds },
    }).lean();

    const cardMap = new Map(cards.map((c) => [String(c.consumerId), c]));

    const qrIds = cards.map((c) => c.qrCodeId).filter(Boolean);

    const qrs = await QRCode.find({
      _id: { $in: qrIds },
    }).lean();

    const qrMap = new Map(qrs.map((q) => [String(q._id), q]));

    let rows = consumers.map((c) => {
      const family = c.familyId || null;
      const card = cardMap.get(String(c._id)) || null;
      const qr = card?.qrCodeId ? qrMap.get(String(card.qrCodeId)) : null;

      return {
        id: String(c._id),
        consumerCode: c.consumerCode,
        name: c.name,
        nidLast4: c.nidLast4,
        status: c.status,
        category: c.category,
        ward: c.ward || "",
        blacklistStatus: c.blacklistStatus,
        familyFlag: !!family?.flaggedDuplicate,
        cardStatus: card?.cardStatus || null,
        qrStatus: qr?.status || null,
        createdAt: c.createdAt,
      };
    });

    if (tab === "flags") {
      rows = rows.filter((r) => r.familyFlag || r.blacklistStatus !== "None");
    }

    if (q && q.trim()) {
      const needle = q.trim().toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.consumerCode || "").toLowerCase().includes(needle) ||
          (r.name || "").toLowerCase().includes(needle) ||
          (r.nidLast4 || "").includes(q.trim()),
      );
    }

    res.json({
      rows,
      total: rows.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
}

async function getDistributorTokens(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);

    if (!distributor) {
      return res.status(404).json({ message: "Distributor profile not found" });
    }

    const tokens = await Token.find({ distributorId: distributor._id })
      .populate("consumerId")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const rows = tokens.map((t) => ({
      id: String(t._id),
      tokenCode: t.tokenCode,
      status: t.status,
      rationQtyKg: t.rationQtyKg,
      issuedAt: t.issuedAt,
      usedAt: t.usedAt,
      consumer: t.consumerId
        ? {
            id: String(t.consumerId._id),
            consumerCode: t.consumerId.consumerCode,
            name: t.consumerId.name,
            category: t.consumerId.category,
            status: t.consumerId.status,
          }
        : null,
    }));

    res.json({ rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
}

async function getDistributorAudit(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);

    if (!distributor) {
      return res.status(404).json({ message: "Distributor profile not found" });
    }

    const logs = await AuditLog.find({
      $or: [{ actorUserId: req.user.userId }, { actorType: "Distributor" }],
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const blacklist = await BlacklistEntry.find({ active: true })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ logs, blacklist });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
}

async function getDistributorReports(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);

    if (!distributor) {
      return res.status(404).json({ message: "Distributor profile not found" });
    }

    const tokenDocs = await Token.find({ distributorId: distributor._id })
      .select("_id status")
      .lean();

    const tokenIds = tokenDocs.map((t) => t._id);

    const [stockOutAgg, mismatchCount] = await Promise.all([
      StockLedger.aggregate([
        {
          $match: {
            distributorId: distributor._id,
            type: "OUT",
          },
        },
        {
          $group: {
            _id: null,
            totalKg: { $sum: "$qtyKg" },
          },
        },
      ]),
      DistributionRecord.countDocuments({
        tokenId: { $in: tokenIds },
        mismatch: true,
      }),
    ]);

    const totalTokens = tokenDocs.length;
    const usedTokens = tokenDocs.filter((t) => t.status === "Used").length;
    const cancelledTokens = tokenDocs.filter(
      (t) => t.status === "Cancelled",
    ).length;

    res.json({
      totalTokens,
      usedTokens,
      cancelledTokens,
      mismatchCount,
      totalStockOutKg: stockOutAgg[0]?.totalKg || 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
}

async function getDistributorMonitoring(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);

    if (!distributor) {
      return res.status(404).json({ message: "Distributor profile not found" });
    }

    const [offline, sessions, criticalLogs] = await Promise.all([
      OfflineQueue.find({ distributorId: distributor._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      DistributionSession.find({ distributorId: distributor._id })
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),
      AuditLog.find({
        actorUserId: req.user.userId,
        severity: "Critical",
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    res.json({
      offline,
      sessions,
      criticalLogs,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
}

async function getDistributorSettings(req, res) {
  try {
    const settings = await SystemSetting.find({}).lean();

    const settingMap = {};
    for (const s of settings) {
      settingMap[s.key] = s.value;
    }

    res.json(settingMap);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
}

// @desc    Get pending FieldUser applications for this distributor's division+ward
// @route   GET /api/distributor/field-users/pending
// @access  Private (Distributor)
async function getPendingFieldUsers(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (!distributor) {
      return res.status(404).json({ success: false, message: "Distributor profile not found" });
    }

    // Find FieldUsers in same division+ward who are pending
    const query = {
      userType: "FieldUser",
      authorityStatus: "Pending",
      status: "Inactive",
    };

    // Match by division
    const divisionQuery = buildDivisionMatchQuery(distributor.division);
    if (divisionQuery) {
      query.division = divisionQuery;
    }

    // Match by ward
    const wardInput = distributor.wardNo || distributor.ward;
    const wardQuery = buildWardMatchQuery(wardInput);
    if (wardQuery) {
      Object.assign(query, wardQuery);
    }

    const pendingUsers = await User.find(query)
      .select("name email phone wardNo ward division district upazila unionName createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: {
        rows: pendingUsers.map((u) => ({
          _id: String(u._id),
          name: u.name,
          email: u.email,
          phone: u.phone,
          wardNo: u.wardNo,
          ward: u.ward,
          division: u.division,
          district: u.district,
          upazila: u.upazila,
          unionName: u.unionName,
          createdAt: u.createdAt,
        })),
        total: pendingUsers.length,
      },
    });
  } catch (err) {
    console.error("getPendingFieldUsers error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
}

// @desc    Approve a pending FieldUser — generates 6-digit password and sends email
// @route   POST /api/distributor/field-users/:id/approve
// @access  Private (Distributor)
async function approveFieldUser(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (!distributor) {
      return res.status(404).json({ success: false, message: "Distributor profile not found" });
    }

    const fieldUser = await User.findById(req.params.id);
    if (!fieldUser) {
      return res.status(404).json({ success: false, message: "FieldUser not found" });
    }

    if (fieldUser.userType !== "FieldUser") {
      return res.status(400).json({ success: false, message: "User is not a FieldUser" });
    }

    if (fieldUser.authorityStatus !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "এই ফিল্ড ডিস্ট্রিবিউটর ইতিমধ্যে প্রক্রিয়াকৃত হয়েছে",
      });
    }

    // Verify the distributor is in the same division+ward
    const distDiv = normalizeDivision(distributor.division);
    const fieldDiv = normalizeDivision(fieldUser.division);
    const distWard = normalizeWardNo(distributor.wardNo || distributor.ward);
    const fieldWard = normalizeWardNo(fieldUser.wardNo || fieldUser.ward);

    if (distDiv !== fieldDiv || distWard !== fieldWard) {
      return res.status(403).json({
        success: false,
        message: "আপনি শুধুমাত্র আপনার নিজের বিভাগ ও ওয়ার্ডের ফিল্ড ডিস্ট্রিবিউটর অনুমোদন করতে পারবেন",
      });
    }

    // Generate random 6-digit password
    const randomPassword = String(crypto.randomInt(100000, 999999));
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    // Get the distributor's user record for email
    const distributorUser = await User.findById(req.user.userId)
      .select("name email contactEmail")
      .lean();

    const distributorEmail = distributorUser?.contactEmail || distributorUser?.email;

    // Update FieldUser
    fieldUser.passwordHash = passwordHash;
    fieldUser.status = "Active";
    fieldUser.authorityStatus = "Active";
    fieldUser.mustChangePassword = true;
    fieldUser.authorityFrom = new Date();
    await fieldUser.save();

    // Send approval email from distributor's email to FieldUser
    const emailResult = await sendFieldUserApprovalEmail({
      to: fieldUser.email,
      fromEmail: distributorEmail,
      fieldUserName: fieldUser.name,
      loginEmail: fieldUser.email,
      password: randomPassword,
      wardNo: fieldUser.wardNo,
      ward: fieldUser.ward,
      division: fieldUser.division,
      distributorName: distributorUser?.name || "ডিস্ট্রিবিউটর",
    });

    console.log("✅ FieldUser approved:", {
      fieldUserId: fieldUser._id,
      approvedBy: req.user.userId,
      emailSent: emailResult.sent,
    });

    return res.json({
      success: true,
      message: emailResult.sent
        ? "ফিল্ড ডিস্ট্রিবিউটর অনুমোদিত এবং লগইন তথ্য ইমেইলে পাঠানো হয়েছে"
        : "ফিল্ড ডিস্ট্রিবিউটর অনুমোদিত, কিন্তু ইমেইল পাঠানো যায়নি",
      data: {
        fieldUserId: String(fieldUser._id),
        emailSent: emailResult.sent,
        emailReason: emailResult.reason || null,
      },
    });
  } catch (err) {
    console.error("approveFieldUser error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
}

// @desc    Reject a pending FieldUser application
// @route   POST /api/distributor/field-users/:id/reject
// @access  Private (Distributor)
async function rejectFieldUser(req, res) {
  try {
    const distributor = await ensureDistributorProfile(req.user);
    if (!distributor) {
      return res.status(404).json({ success: false, message: "Distributor profile not found" });
    }

    const fieldUser = await User.findById(req.params.id);
    if (!fieldUser || fieldUser.userType !== "FieldUser") {
      return res.status(404).json({ success: false, message: "FieldUser not found" });
    }

    if (fieldUser.authorityStatus !== "Pending") {
      return res.status(400).json({
        success: false,
        message: "এই ফিল্ড ডিস্ট্রিবিউটর ইতিমধ্যে প্রক্রিয়াকৃত হয়েছে",
      });
    }

    // Verify same division+ward
    const distDiv = normalizeDivision(distributor.division);
    const fieldDiv = normalizeDivision(fieldUser.division);
    const distWard = normalizeWardNo(distributor.wardNo || distributor.ward);
    const fieldWard = normalizeWardNo(fieldUser.wardNo || fieldUser.ward);

    if (distDiv !== fieldDiv || distWard !== fieldWard) {
      return res.status(403).json({
        success: false,
        message: "আপনি শুধুমাত্র আপনার নিজের বিভাগ ও ওয়ার্ডের ফিল্ড ডিস্ট্রিবিউটর প্রত্যাখ্যান করতে পারবেন",
      });
    }

    fieldUser.authorityStatus = "Revoked";
    fieldUser.status = "Inactive";
    await fieldUser.save();

    return res.json({
      success: true,
      message: "ফিল্ড ডিস্ট্রিবিউটর আবেদন প্রত্যাখ্যাত হয়েছে",
    });
  } catch (err) {
    console.error("rejectFieldUser error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
}

module.exports = {
  getDistributorDashboard,
  getBeneficiaries,
  getDistributorTokens,
  getDistributorAudit,
  getDistributorReports,
  getDistributorMonitoring,
  getDistributorSettings,
  getPendingFieldUsers,
  approveFieldUser,
  rejectFieldUser,
};
