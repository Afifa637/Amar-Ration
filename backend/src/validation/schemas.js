"use strict";

const { z } = require("zod");

const bdPhone = z
  .string()
  .regex(/^01[3-9]\d{8}$/, "Invalid Bangladesh mobile number");
const wardNo = z
  .string()
  .regex(/^[0-9]{2}$/, "wardNo must be 2-digit number like '01'");
const nidLength = z
  .string()
  .regex(/^\d+$/, "NID must be digits only")
  .refine(
    (value) => [10, 13, 17].includes(String(value).length),
    "NID must be 10, 13, or 17 digits",
  );

const loginSchema = z.object({
  identifier: z.string().min(1, "identifier required"),
  password: z.string().min(1, "password required"),
  userType: z.enum(["Admin", "Distributor", "FieldUser"]).optional(),
  totpToken: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "currentPassword required"),
  newPassword: z.string().min(8, "newPassword must be at least 8 characters"),
});

const registerConsumerSchema = z.object({
  name: z.string().min(2).max(100),
  nidFull: nidLength,
  fatherNidFull: nidLength,
  motherNidFull: nidLength,
  category: z.enum(["A", "B", "C"]),
  ward: z.string().min(1).optional(),
  division: z.string().min(1).optional(),
  district: z.string().min(1).optional(),
  upazila: z.string().min(1).optional(),
  unionName: z.string().min(1).optional(),
  guardianPhone: bdPhone.optional(),
  guardianName: z.string().max(100).optional(),
});

const scanSchema = z
  .object({
    qrPayload: z.string().optional(),
    consumerCode: z.string().optional(),
    consumerId: z.string().optional(),
    input: z.string().optional(),
  })
  .refine(
    (data) =>
      data.qrPayload || data.consumerCode || data.consumerId || data.input,
    {
      message: "qrPayload, consumerCode, consumerId, or input is required",
    },
  );

const completeDistributionSchema = z
  .object({
    tokenId: z.string().optional(),
    tokenCode: z.string().optional(),
    tokenQrPayload: z.string().optional(),
    actualKg: z
      .number({ coerce: true })
      .positive("actualKg must be positive")
      .multipleOf(1, "actualKg must be in 1kg step")
      .max(50, "actualKg too large"),
  })
  .refine((data) => data.tokenId || data.tokenCode || data.tokenQrPayload, {
    message: "tokenId, tokenCode, or tokenQrPayload is required",
  });

const createDistributorSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  contactEmail: z.string().email().optional(),
  phone: bdPhone.optional(),
  wardNo: wardNo,
  division: z.string().min(1),
  district: z.string().min(1).optional(),
  upazila: z.string().min(1).optional(),
  unionName: z.string().min(1).optional(),
  officeAddress: z.string().optional(),
  authorityMonths: z.number({ coerce: true }).int().min(1).max(60).optional(),
});

module.exports = {
  loginSchema,
  changePasswordSchema,
  registerConsumerSchema,
  scanSchema,
  completeDistributionSchema,
  createDistributorSchema,
};
