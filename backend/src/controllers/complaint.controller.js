"use strict";

const Complaint = require("../models/Complaint");
const Consumer = require("../models/Consumer");
const Token = require("../models/Token");
const DistributionSession = require("../models/DistributionSession");
const Distributor = require("../models/Distributor");
const User = require("../models/User");
const DistributionRecord = require("../models/DistributionRecord");
const {
  hydrateRecordItemFields,
} = require("../services/distributionRecord.service");
const { makeSessionCode } = require("../services/sessionCode.service");
const { normalizeDivision } = require("../utils/division.utils");
const { normalizeWardNo } = require("../utils/ward.utils");
const {
  sendComplaintAcknowledgeSms,
  sendComplaintResolvedSms,
} = require("../services/sms.service");

function makeComplaintId() {
  return `CMP-${Date.now()}`;
}

async function resolveComplaintContext({
  consumerId,
  consumerCode,
  tokenCode,
  sessionId,
  distributorId,
}) {
  let consumer = null;
  let token = null;
  let record = null;
  let session = null;
  let distributor = null;

  if (consumerId) {
    consumer = await Consumer.findById(consumerId)
      .select("_id consumerCode name division ward")
      .lean();
  }

  if (!consumer && consumerCode) {
    consumer = await Consumer.findOne({
      consumerCode: String(consumerCode).trim(),
    })
      .select("_id consumerCode name division ward")
      .lean();
  }

  if (tokenCode) {
    token = await Token.findOne({ tokenCode: String(tokenCode).trim() })
      .select(
        "_id tokenCode consumerId sessionId distributorId rationItem rationQtyKg",
      )
      .populate("consumerId", "_id consumerCode name division ward")
      .populate("sessionId", "_id dateKey status distributorId")
      .populate("distributorId", "_id division wardNo ward userId")
      .lean();

    if (token?._id) {
      record = await DistributionRecord.findOne({ tokenId: token._id })
        .select(
          "expectedKg actualKg item expectedByItem actualByItem mismatchDetails mismatch",
        )
        .lean();
    }

    if (
      !consumer &&
      token?.consumerId &&
      typeof token.consumerId === "object"
    ) {
      consumer = token.consumerId;
    }
    if (!session && token?.sessionId && typeof token.sessionId === "object") {
      session = token.sessionId;
    }
    if (
      !distributor &&
      token?.distributorId &&
      typeof token.distributorId === "object"
    ) {
      distributor = token.distributorId;
    }
  }

  if (!session && sessionId) {
    session = await DistributionSession.findById(sessionId)
      .select("_id dateKey status distributorId")
      .lean();
  }

  if (!distributor && session?.distributorId) {
    distributor = await Distributor.findById(session.distributorId)
      .select("_id division wardNo ward userId")
      .lean();
  }

  if (!distributor && distributorId) {
    distributor = await Distributor.findOne({
      $or: [{ _id: distributorId }, { userId: distributorId }],
    })
      .select("_id division wardNo ward userId")
      .lean();
  }

  let distributorName = "";
  if (distributor?.userId) {
    const user = await User.findById(distributor.userId).select("name").lean();
    distributorName = user?.name || "";
  }

  const division =
    normalizeDivision(consumer?.division || distributor?.division || "") || "";
  const ward =
    normalizeWardNo(
      consumer?.ward || distributor?.wardNo || distributor?.ward || "",
    ) || "";

  const itemWise = hydrateRecordItemFields({
    item: record?.item || token?.rationItem,
    expectedKg: Number(record?.expectedKg ?? token?.rationQtyKg ?? 0),
    actualKg: Number(record?.actualKg ?? 0),
    expectedByItem: record?.expectedByItem,
    actualByItem: record?.actualByItem,
  });

  return {
    consumerId: consumer?._id || null,
    consumerCode: consumer?.consumerCode || "",
    consumerName: consumer?.name || "",
    distributorId: distributor?.userId || distributor?._id || null,
    distributorName,
    distributorCode: distributor?._id
      ? `DST-${String(distributor._id).slice(-6).toUpperCase()}`
      : "",
    sessionId: session?._id || null,
    sessionCode: session ? makeSessionCode(session) : "",
    sessionDate: session?.dateKey || "",
    sessionStatus: session?.status || "",
    division,
    ward,
    tokenCode: token?.tokenCode || (tokenCode ? String(tokenCode).trim() : ""),
    item: itemWise.item,
    expectedByItem: itemWise.expectedByItem,
    actualByItem: itemWise.actualByItem,
    mismatchDetails:
      record?.mismatchDetails?.length > 0
        ? record.mismatchDetails
        : itemWise.mismatchDetails,
  };
}

async function createComplaint(req, res) {
  try {
    const {
      consumerPhone,
      category,
      description,
      consumerId,
      consumerCode,
      tokenCode,
      sessionId,
      distributorId,
    } = req.body || {};

    if (!consumerPhone || !category || !description) {
      return res.status(400).json({
        success: false,
        message: "consumerPhone, category, description are required",
        code: "VALIDATION_ERROR",
      });
    }

    const context = await resolveComplaintContext({
      consumerId,
      consumerCode,
      tokenCode,
      sessionId,
      distributorId,
    });

    const complaint = await Complaint.create({
      complaintId: makeComplaintId(),
      consumerId: context.consumerId || undefined,
      consumerCode: context.consumerCode || undefined,
      consumerName: context.consumerName || undefined,
      consumerPhone: String(consumerPhone).trim(),
      category,
      description,
      tokenCode: context.tokenCode || undefined,
      sessionId: context.sessionId || undefined,
      sessionCode: context.sessionCode || undefined,
      sessionDate: context.sessionDate || undefined,
      sessionStatus: context.sessionStatus || undefined,
      distributorId: context.distributorId || undefined,
      distributorName: context.distributorName || undefined,
      distributorCode: context.distributorCode || undefined,
      division: context.division || undefined,
      ward: context.ward || undefined,
      item: context.item || undefined,
      expectedByItem: context.expectedByItem || undefined,
      actualByItem: context.actualByItem || undefined,
      mismatchDetails: context.mismatchDetails || undefined,
    });

    void sendComplaintAcknowledgeSms(
      complaint.consumerPhone,
      complaint.complaintId,
    );

    return res.status(201).json({
      success: true,
      data: { complaintId: complaint.complaintId },
      message: "অভিযোগ নিবন্ধিত হয়েছে",
    });
  } catch (error) {
    console.error("createComplaint error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function listComplaints(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const query = {};
    if (req.query.status) query.status = String(req.query.status);
    if (req.query.category) query.category = String(req.query.category);
    if (req.query.distributorId) query.distributorId = req.query.distributorId;
    if (req.query.division) {
      query.division = normalizeDivision(String(req.query.division));
    }

    const inputWard = normalizeWardNo(req.query.ward || req.query.wardNo);
    if (inputWard) {
      query.ward = inputWard;
    }

    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate)
        query.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) {
        const end = new Date(req.query.endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const search = String(req.query.search || req.query.q || "").trim();
    if (search) {
      query.$or = [
        { complaintId: { $regex: search, $options: "i" } },
        { consumerPhone: { $regex: search, $options: "i" } },
        { consumerCode: { $regex: search, $options: "i" } },
        { consumerName: { $regex: search, $options: "i" } },
        { distributorName: { $regex: search, $options: "i" } },
        { tokenCode: { $regex: search, $options: "i" } },
        { sessionCode: { $regex: search, $options: "i" } },
      ];
    }

    const [total, items] = await Promise.all([
      Complaint.countDocuments(query),
      Complaint.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const consumerIdsToFill = Array.from(
      new Set(
        items
          .filter(
            (item) =>
              item.consumerId && (!item.consumerName || !item.consumerCode),
          )
          .map((item) => String(item.consumerId)),
      ),
    );
    const distributorIdsToFill = Array.from(
      new Set(
        items
          .filter((item) => item.distributorId && !item.distributorName)
          .map((item) => String(item.distributorId)),
      ),
    );
    const sessionIdsToFill = Array.from(
      new Set(
        items
          .filter((item) => item.sessionId && !item.sessionCode)
          .map((item) => String(item.sessionId)),
      ),
    );

    const [consumers, distributors, sessions] = await Promise.all([
      consumerIdsToFill.length
        ? Consumer.find({ _id: { $in: consumerIdsToFill } })
            .select("_id consumerCode name division ward")
            .lean()
        : [],
      distributorIdsToFill.length
        ? Distributor.find({
            $or: [
              { _id: { $in: distributorIdsToFill } },
              { userId: { $in: distributorIdsToFill } },
            ],
          })
            .select("_id userId division wardNo ward")
            .populate("userId", "name")
            .lean()
        : [],
      sessionIdsToFill.length
        ? DistributionSession.find({ _id: { $in: sessionIdsToFill } })
            .select("_id dateKey status distributorId")
            .lean()
        : [],
    ]);

    const consumerMap = new Map(consumers.map((c) => [String(c._id), c]));
    const sessionMap = new Map(sessions.map((s) => [String(s._id), s]));
    const distributorByUserId = new Map();
    const distributorById = new Map();
    for (const d of distributors) {
      distributorById.set(String(d._id), d);
      distributorByUserId.set(String(d.userId), d);
    }

    const enriched = items.map((item) => {
      const fallbackConsumer = item.consumerId
        ? consumerMap.get(String(item.consumerId))
        : null;
      const fallbackDistributor = item.distributorId
        ? distributorByUserId.get(String(item.distributorId)) ||
          distributorById.get(String(item.distributorId))
        : null;
      const fallbackSession = item.sessionId
        ? sessionMap.get(String(item.sessionId))
        : null;

      const fallbackDistributorUser =
        fallbackDistributor?.userId &&
        typeof fallbackDistributor.userId === "object"
          ? fallbackDistributor.userId
          : null;

      return {
        ...item,
        consumerCode: item.consumerCode || fallbackConsumer?.consumerCode || "",
        consumerName: item.consumerName || fallbackConsumer?.name || "",
        division:
          item.division ||
          fallbackConsumer?.division ||
          fallbackDistributor?.division ||
          "",
        ward:
          item.ward ||
          fallbackConsumer?.ward ||
          fallbackDistributor?.wardNo ||
          fallbackDistributor?.ward ||
          "",
        distributorName:
          item.distributorName || fallbackDistributorUser?.name || "",
        distributorCode:
          item.distributorCode ||
          (fallbackDistributor?._id
            ? `DST-${String(fallbackDistributor._id).slice(-6).toUpperCase()}`
            : ""),
        sessionCode:
          item.sessionCode ||
          (fallbackSession ? makeSessionCode(fallbackSession) : ""),
        sessionDate: fallbackSession?.dateKey || "",
        sessionStatus: fallbackSession?.status || "",
      };
    });

    return res.json({
      success: true,
      data: {
        items: enriched,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
          limit,
        },
      },
    });
  } catch (error) {
    console.error("listComplaints error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function getComplaintById(req, res) {
  try {
    const complaint = await Complaint.findOne({
      complaintId: req.params.complaintId,
    }).lean();
    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
        code: "NOT_FOUND",
      });
    }
    return res.json({ success: true, data: complaint });
  } catch (error) {
    console.error("getComplaintById error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function resolveComplaint(req, res) {
  try {
    const { status, adminNote } = req.body || {};
    if (!["resolved", "rejected"].includes(String(status))) {
      return res.status(400).json({
        success: false,
        message: "status must be resolved or rejected",
        code: "VALIDATION_ERROR",
      });
    }

    const complaint = await Complaint.findOneAndUpdate(
      { complaintId: req.params.complaintId },
      {
        $set: {
          status,
          adminNote: String(adminNote || ""),
          resolvedBy: req.user.userId,
          resolvedAt: new Date(),
        },
      },
      { new: true },
    ).lean();

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Complaint not found",
        code: "NOT_FOUND",
      });
    }

    void sendComplaintResolvedSms(
      complaint.consumerPhone,
      complaint.complaintId,
    );

    return res.json({ success: true, data: complaint });
  } catch (error) {
    console.error("resolveComplaint error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

async function complaintStats(req, res) {
  try {
    const [total, open, under_review, resolved, rejected, byCategoryRows] =
      await Promise.all([
        Complaint.countDocuments({}),
        Complaint.countDocuments({ status: "open" }),
        Complaint.countDocuments({ status: "under_review" }),
        Complaint.countDocuments({ status: "resolved" }),
        Complaint.countDocuments({ status: "rejected" }),
        Complaint.aggregate([
          { $group: { _id: "$category", count: { $sum: 1 } } },
        ]),
      ]);

    const byCategory = {};
    for (const row of byCategoryRows) {
      byCategory[row._id] = row.count;
    }

    return res.json({
      success: true,
      data: { total, open, under_review, resolved, rejected, byCategory },
    });
  } catch (error) {
    console.error("complaintStats error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Server error", code: "SERVER_ERROR" });
  }
}

module.exports = {
  createComplaint,
  listComplaints,
  getComplaintById,
  resolveComplaint,
  complaintStats,
};
