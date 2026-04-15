"use strict";

function makeSessionCode(sessionLike) {
  if (!sessionLike?._id || !sessionLike?.dateKey) return "";
  return `SES-${String(sessionLike.dateKey).replace(/-/g, "")}-${String(sessionLike._id).slice(-6).toUpperCase()}`;
}

module.exports = {
  makeSessionCode,
};
