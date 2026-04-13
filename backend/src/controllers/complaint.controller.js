"use strict";

const Complaint = require("../models/Complaint");
const Consumer = require("../models/Consumer");
const {
  sendComplaintAcknowledgeSms,
  sendComplaintResolvedSms,
} = require("../services/sms.service");

function makeComplaintId() {
  return `CMP-${Date.now()}`;
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

    let resolvedConsumerId = consumerId || undefined;
    if (!resolvedConsumerId && consumerCode) {
      const found = await Consumer.findOne({
        consumerCode: String(consumerCode).trim(),
      })
        .select("_id")
        .lean();
      resolvedConsumerId = found?._id || undefined;
    }

    const complaint = await Complaint.create({
      complaintId: makeComplaintId(),
      consumerId: resolvedConsumerId,
      consumerPhone: String(consumerPhone).trim(),
      category,
      description,
      tokenCode: tokenCode || undefined,
      sessionId: sessionId || undefined,
      distributorId: distributorId || undefined,
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

    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate)
        query.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
    }

    const [total, items] = await Promise.all([
      Complaint.countDocuments(query),
      Complaint.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    const enriched = await Promise.all(
      items.map(async (item) => {
        let consumerName = null;
        if (item.consumerId) {
          const c = await Consumer.findById(item.consumerId)
            .select("name")
            .lean();
          consumerName = c?.name || null;
        }
        return { ...item, consumerName };
      }),
    );

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
