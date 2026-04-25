function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.MAIL_FROM,
  );
}

function shouldUseSmtpAuth() {
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();
  return Boolean(user || pass);
}

let transporterCache = null;
let nodemailerCache = null;

function loadNodemailer() {
  if (nodemailerCache) return nodemailerCache;
  try {
    // Lazy require so backend can run even when nodemailer is not installed
    nodemailerCache = require("nodemailer");
    return nodemailerCache;
  } catch {
    return null;
  }
}

function isValidRecipientEmail(value) {
  const email = String(value || "")
    .trim()
    .toLowerCase();
  if (!email) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  // Prevent accidental delivery attempts to temporary login-only domain
  if (email.endsWith("@amar-ration.local")) return false;
  return true;
}

function getTransporter() {
  if (transporterCache) return transporterCache;

  if (!isEmailConfigured()) {
    return null;
  }

  const nodemailer = loadNodemailer();
  if (!nodemailer) {
    return null;
  }

  transporterCache = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    ...(shouldUseSmtpAuth()
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        }
      : {}),
  });

  return transporterCache;
}

function getDistributorLoginUrl() {
  if (process.env.DISTRIBUTOR_LOGIN_URL) {
    return String(process.env.DISTRIBUTOR_LOGIN_URL).trim();
  }

  if (process.env.BACKEND_PUBLIC_URL) {
    try {
      const backendUrl = new URL(String(process.env.BACKEND_PUBLIC_URL));
      return `${backendUrl.origin}/login/distributor`;
    } catch {
      return null;
    }
  }

  return null;
}

function buildCredentialHtml({
  name,
  loginEmail,
  password,
  ward,
  wardNo,
  authorityStatus,
}) {
  const loginUrl = getDistributorLoginUrl();

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 8px;">আমার রেশন — ডিস্ট্রিবিউটর অ্যাকাউন্ট</h2>
      <p style="margin-top: 0;">প্রিয় ${name || "ডিস্ট্রিবিউটর"}, আপনার অ্যাকাউন্ট তথ্য নিচে দেওয়া হলো:</p>

      <table style="border-collapse: collapse; width: 100%; margin: 12px 0;">
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 8px; width: 160px;"><b>Login Email</b></td>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${loginEmail}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 8px;"><b>Temporary Password</b></td>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${password}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 8px;"><b>Ward</b></td>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${wardNo || "—"} ${ward ? `(${ward})` : ""}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 8px;"><b>Authority Status</b></td>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${authorityStatus || "Pending"}</td>
        </tr>
      </table>

      ${loginUrl ? `<p>লগইন করুন: <a href="${loginUrl}">${loginUrl}</a></p>` : "<p>লগইন URL কনফিগার করা নেই। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।</p>"}
      <p style="color:#b91c1c;"><b>Security:</b> প্রথম লগইনের পর আপনাকে অবিলম্বে পাসওয়ার্ড পরিবর্তন করতে বলা হবে।</p>
      <p style="font-size: 12px; color: #6b7280;">এই ইমেইলটি সিস্টেম থেকে স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে।</p>
    </div>
  `;
}

async function trySendWithEtherealFallback({ to, subject, html, text }) {
  if (String(process.env.NODE_ENV || "development") === "production") {
    return null;
  }

  const nodemailer = loadNodemailer();
  if (!nodemailer) return null;

  try {
    const account = await nodemailer.createTestAccount();
    const fallbackTransporter = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: {
        user: account.user,
        pass: account.pass,
      },
    });

    const info = await fallbackTransporter.sendMail({
      from: process.env.MAIL_FROM || "Amar Ration <no-reply@example.local>",
      to,
      subject,
      html,
      text,
    });

    return {
      sent: true,
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info) || null,
      fallback: "ETHEREAL",
    };
  } catch {
    return null;
  }
}

async function sendDistributorCredentialEmail({
  to,
  name,
  loginEmail,
  password,
  ward,
  wardNo,
  authorityStatus,
}) {
  if (!isValidRecipientEmail(to)) {
    return {
      sent: false,
      reason: "INVALID_RECIPIENT_EMAIL",
    };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return {
      sent: false,
      reason: "SMTP_NOT_CONFIGURED",
    };
  }

  const subject = "Amar Ration | Distributor Login Credentials";
  const html = buildCredentialHtml({
    name,
    loginEmail,
    password,
    ward,
    wardNo,
    authorityStatus,
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      html,
      text:
        `Amar Ration distributor credentials\nEmail: ${loginEmail}\nPassword: ${password}\nWard: ${wardNo || ""} ${ward || ""}\n` +
        "First login requires immediate password reset.",
    });

    return {
      sent: true,
      messageId: info.messageId,
    };
  } catch (error) {
    const fallback = await trySendWithEtherealFallback({
      to,
      subject,
      html,
      text:
        `Amar Ration distributor credentials\nEmail: ${loginEmail}\nPassword: ${password}\nWard: ${wardNo || ""} ${ward || ""}\n` +
        "First login requires immediate password reset.",
    });
    if (fallback?.sent) {
      return {
        sent: true,
        messageId: fallback.messageId,
        previewUrl: fallback.previewUrl || null,
        reason: "SMTP_PRIMARY_FAILED_USING_ETHEREAL_FALLBACK",
      };
    }

    return {
      sent: false,
      reason: `SMTP_SEND_FAILED:${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

function buildStatusHtml({ name, loginEmail, ward, wardNo, status, reason }) {
  const loginUrl = getDistributorLoginUrl();

  const statusText =
    status === "Active"
      ? "Approved"
      : status === "Suspended"
        ? "Suspended"
        : status === "Revoked"
          ? "Disabled"
          : status;

  const heading =
    status === "Active"
      ? "আপনার ডিস্ট্রিবিউটর অ্যাকাউন্ট অনুমোদিত হয়েছে"
      : "আপনার ডিস্ট্রিবিউটর অ্যাকাউন্টে পরিবর্তন হয়েছে";

  const body =
    status === "Active"
      ? "অভিনন্দন। আপনি এখন ডিস্ট্রিবিউটর পোর্টালে লগইন করতে পারবেন।"
      : "বর্তমানে আপনার ডিস্ট্রিবিউটর লগইন স্থগিত/নিষ্ক্রিয় করা হয়েছে। বিস্তারিতের জন্য অ্যাডমিনের সাথে যোগাযোগ করুন।";

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 8px;">আমার রেশন — স্ট্যাটাস আপডেট</h2>
      <p style="margin-top: 0;">প্রিয় ${name || "ডিস্ট্রিবিউটর"}, ${heading}</p>
      <p>${body}</p>

      <table style="border-collapse: collapse; width: 100%; margin: 12px 0;">
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 8px; width: 160px;"><b>Login Email</b></td>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${loginEmail}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 8px;"><b>Status</b></td>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${statusText}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 8px;"><b>Ward</b></td>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${wardNo || "—"} ${ward ? `(${ward})` : ""}</td>
        </tr>
        ${reason ? `<tr><td style="border: 1px solid #e5e7eb; padding: 8px;"><b>Note</b></td><td style="border: 1px solid #e5e7eb; padding: 8px;">${reason}</td></tr>` : ""}
      </table>

      ${status === "Active" ? (loginUrl ? `<p>লগইন করুন: <a href="${loginUrl}">${loginUrl}</a></p>` : "<p>লগইন URL কনফিগার করা নেই। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।</p>") : ""}
      <p style="font-size: 12px; color: #6b7280;">এই ইমেইলটি সিস্টেম থেকে স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে।</p>
    </div>
  `;
}

async function sendDistributorStatusEmail({
  to,
  name,
  loginEmail,
  ward,
  wardNo,
  status,
  reason,
}) {
  if (!isValidRecipientEmail(to)) {
    return {
      sent: false,
      reason: "INVALID_RECIPIENT_EMAIL",
    };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return {
      sent: false,
      reason: "SMTP_NOT_CONFIGURED",
    };
  }

  const subject =
    status === "Active"
      ? "Amar Ration | Distributor Approved"
      : "Amar Ration | Distributor Status Update";

  const html = buildStatusHtml({
    name,
    loginEmail,
    ward,
    wardNo,
    status,
    reason,
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      html,
      text: `Amar Ration distributor status update\nLogin Email: ${loginEmail}\nStatus: ${status}${reason ? `\nNote: ${reason}` : ""}`,
    });

    return {
      sent: true,
      messageId: info.messageId,
    };
  } catch (error) {
    return {
      sent: false,
      reason: `SMTP_SEND_FAILED:${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

function buildPasswordChangeAlertHtml({
  name,
  loginEmail,
  changedBy,
  changedAt,
  yesUrl,
  notMeUrl,
}) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 8px;">আমার রেশন — Password Security Alert</h2>
      <p style="margin-top: 0;">প্রিয় ${name || "ডিস্ট্রিবিউটর"}, আপনার অ্যাকাউন্ট পাসওয়ার্ড পরিবর্তন হয়েছে।</p>

      <table style="border-collapse: collapse; width: 100%; margin: 12px 0;">
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 8px; width: 160px;"><b>Login Email</b></td>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${loginEmail || "—"}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 8px;"><b>Changed By</b></td>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${changedBy || "System"}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 8px;"><b>Time</b></td>
          <td style="border: 1px solid #e5e7eb; padding: 8px;">${changedAt || "—"}</td>
        </tr>
      </table>

      <p style="margin: 10px 0 6px;">এটি কি আপনি করেছেন?</p>
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:12px;">
        <a href="${yesUrl}" style="display:inline-block; background:#047857; color:#fff; text-decoration:none; padding:10px 14px; border-radius:8px; font-weight:600;">✅ হ্যাঁ, এটা আমি করেছি</a>
        <a href="${notMeUrl}" style="display:inline-block; background:#b91c1c; color:#fff; text-decoration:none; padding:10px 14px; border-radius:8px; font-weight:600;">🚨 না, এটা আমি নই</a>
      </div>

      <p style="color:#b91c1c;"><b>যদি আপনি "না" বেছে নেন, আপনার ডিস্ট্রিবিউটর অ্যাকাউন্ট তাৎক্ষণিকভাবে স্থগিত হবে এবং অ্যাডমিনকে জানানো হবে।</b></p>
      <p style="font-size: 12px; color: #6b7280;">এই ইমেইলটি সিস্টেম থেকে স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে।</p>
    </div>
  `;
}

async function sendDistributorPasswordChangeAlertEmail({
  to,
  name,
  loginEmail,
  changedBy,
  changedAt,
  yesUrl,
  notMeUrl,
}) {
  if (!isValidRecipientEmail(to)) {
    return {
      sent: false,
      reason: "INVALID_RECIPIENT_EMAIL",
    };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return {
      sent: false,
      reason: "SMTP_NOT_CONFIGURED",
    };
  }

  const subject = "Amar Ration | Password Change Alert";
  const html = buildPasswordChangeAlertHtml({
    name,
    loginEmail,
    changedBy,
    changedAt,
    yesUrl,
    notMeUrl,
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      html,
      text:
        `Password changed for ${loginEmail || "your account"}.\n` +
        `If this was you, confirm: ${yesUrl}\n` +
        `If this was NOT you, report immediately: ${notMeUrl}`,
    });

    return {
      sent: true,
      messageId: info.messageId,
    };
  } catch (error) {
    return {
      sent: false,
      reason: `SMTP_SEND_FAILED:${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

function buildFieldUserApprovalHtml({ name, loginEmail, password, wardNo, ward, division }) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 8px; color: #1f77b4;">আমার রেশন — ফিল্ড ডিস্ট্রিবিউটর অ্যাকাউন্ট অনুমোদিত</h2>
      <p style="margin-top: 0;">প্রিয় <strong>${name || "ব্যবহারকারী"}</strong>,</p>
      <p>আপনার ফিল্ড ডিস্ট্রিবিউটর আবেদন অনুমোদিত হয়েছে। নিচের তথ্য দিয়ে আমার রেশন অ্যাপ থেকে লগইন করুন:</p>

      <table style="border-collapse: collapse; width: 100%; margin: 16px 0; border: 1px solid #e5e7eb;">
        <tr style="background: #f9fafb;">
          <td style="border: 1px solid #e5e7eb; padding: 10px; width: 170px; font-weight: bold;">ইউজারনেম (Email)</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px; font-family: monospace; letter-spacing: 0.5px;">${loginEmail}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">পাসওয়ার্ড</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px; font-family: monospace; font-size: 18px; letter-spacing: 2px; color: #1f77b4;"><strong>${password}</strong></td>
        </tr>
        <tr style="background: #f9fafb;">
          <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">বিভাগ</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${division || "—"}</td>
        </tr>
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 10px; font-weight: bold;">ওয়ার্ড</td>
          <td style="border: 1px solid #e5e7eb; padding: 10px;">${wardNo || "—"}${ward ? ` (${ward})` : ""}</td>
        </tr>
      </table>

      <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px; margin: 16px 0;">
        <strong>⚠️ গুরুত্বপূর্ণ:</strong> প্রথমবার লগইনের পর আপনাকে অবিলম্বে পাসওয়ার্ড পরিবর্তন করতে হবে।
        এই পাসওয়ার্ড কারও সাথে শেয়ার করবেন না।
      </div>

      <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
        এই ইমেইলটি সিস্টেম থেকে স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে। উত্তর দেওয়ার প্রয়োজন নেই।
      </p>
    </div>
  `;
}

async function sendFieldUserApprovalEmail({ to, name, loginEmail, password, wardNo, ward, division }) {
  if (!isValidRecipientEmail(to)) {
    return { sent: false, reason: "INVALID_RECIPIENT_EMAIL" };
  }

  const transporter = getTransporter();
  if (!transporter) {
    const fallback = await trySendWithEtherealFallback({
      to,
      subject: "আমার রেশন | ফিল্ড ডিস্ট্রিবিউটর অ্যাকাউন্ট অনুমোদিত",
      html: buildFieldUserApprovalHtml({ name, loginEmail, password, wardNo, ward, division }),
      text: `আমার রেশন - ফিল্ড ডিস্ট্রিবিউটর অ্যাকাউন্ট অনুমোদিত\nইউজারনেম: ${loginEmail}\nপাসওয়ার্ড: ${password}\nবিভাগ: ${division || ""}\nওয়ার্ড: ${wardNo || ""}\nপ্রথম লগইনে পাসওয়ার্ড পরিবর্তন করুন।`,
    });
    if (fallback?.sent) return { sent: true, messageId: fallback.messageId, previewUrl: fallback.previewUrl || null, reason: "ETHEREAL_FALLBACK" };
    return { sent: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  const subject = "আমার রেশন | ফিল্ড ডিস্ট্রিবিউটর অ্যাকাউন্ট অনুমোদিত";
  const html = buildFieldUserApprovalHtml({ name, loginEmail, password, wardNo, ward, division });
  const text = `আমার রেশন - ফিল্ড ডিস্ট্রিবিউটর অ্যাকাউন্ট অনুমোদিত\nইউজারনেম: ${loginEmail}\nপাসওয়ার্ড: ${password}\nবিভাগ: ${division || ""}\nওয়ার্ড: ${wardNo || ""}\nপ্রথম লগইনে পাসওয়ার্ড পরিবর্তন করুন।`;

  try {
    const info = await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, html, text });
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    const fallback = await trySendWithEtherealFallback({ to, subject, html, text });
    if (fallback?.sent) return { sent: true, messageId: fallback.messageId, previewUrl: fallback.previewUrl || null, reason: "SMTP_PRIMARY_FAILED_USING_ETHEREAL_FALLBACK" };
    return { sent: false, reason: `SMTP_SEND_FAILED:${error instanceof Error ? error.message : "unknown"}` };
  }
}

module.exports = {
  isEmailConfigured,
  sendDistributorCredentialEmail,
  sendDistributorStatusEmail,
  sendDistributorPasswordChangeAlertEmail,
  sendFieldUserApprovalEmail,
};
