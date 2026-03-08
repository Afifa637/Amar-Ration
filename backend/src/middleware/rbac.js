function allowUserTypes(...types) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!types.includes(req.user.userType)) return res.status(403).json({ message: "Forbidden" });
    next();
  };
}
module.exports = { allowUserTypes };
