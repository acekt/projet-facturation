function calculateItemTotal(quantity, unitPrice) {
  return Math.round((Number(quantity) || 0) * (Number(unitPrice) || 0));
}
console.log(calculateItemTotal(1, 0));
