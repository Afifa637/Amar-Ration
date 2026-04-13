function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.MAIL_FROM,
  );
}

let transporterCache = null;

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

  let nodemailer;
  try {
    // Lazy require so backend can run even when nodemailer is not installed
    nodemailer = require("nodemailer");
  } catch {
    return null;
  }

  transporterCache = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
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
      <p style="color:#b91c1c;"><b>Security:</b> এই লগইন তথ্য অ্যাডমিন-নিয়ন্ত্রিত। পরিবর্তনের জন্য অ্যাডমিনের সাথে যোগাযোগ করুন।</p>
      <p style="font-size: 12px; color: #6b7280;">এই ইমেইলটি সিস্টেম থেকে স্বয়ংক্রিয়ভাবে পাঠানো হয়েছে।</p>
    </div>
  `;
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

  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    html,
    text: `Amar Ration distributor credentials\nEmail: ${loginEmail}\nPassword: ${password}\nWard: ${wardNo || ""} ${ward || ""}`,
  });

  return {
    sent: true,
    messageId: info.messageId,
  };
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
}

module.exports = {
  isEmailConfigured,
  sendDistributorCredentialEmail,
  sendDistributorStatusEmail,
  sendDistributorPasswordChangeAlertEmail,
};
