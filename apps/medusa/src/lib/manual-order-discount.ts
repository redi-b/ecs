export type DiscountableLine = { id: string; quantity: number; unitPrice: number };

export function allocateManualOrderDiscount(
  lines: DiscountableLine[],
  discount: { type: "fixed" | "percentage"; value: number },
) {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const requested =
    discount.type === "percentage" ? subtotal * (discount.value / 100) : discount.value;
  const amount = Math.round(requested * 100) / 100;
  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > subtotal ||
    (discount.type === "percentage" && discount.value > 100)
  ) {
    throw new Error("invalid_manual_order_discount");
  }

  let allocated = 0;
  const adjustments = lines
    .map((line, index) => {
      const lineTotal = line.unitPrice * line.quantity;
      const lineAmount =
        index === lines.length - 1
          ? Math.round((amount - allocated) * 100) / 100
          : Math.round(amount * (lineTotal / subtotal) * 100) / 100;
      allocated += lineAmount;
      return { amount: lineAmount, itemId: line.id };
    })
    .filter((adjustment) => adjustment.amount > 0);

  return { adjustments, amount, subtotal };
}
