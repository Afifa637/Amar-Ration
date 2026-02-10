function rationQtyByCategory(cat) {
  if (cat === "A") return 5.0;
  if (cat === "B") return 4.0;
  return 3.0;
}

function makeTokenCode() {
  return `T-${Math.floor(100000 + Math.random() * 900000)}`;
}

module.exports = { rationQtyByCategory, makeTokenCode };
