/** Indian numbering (en-IN) for rupee amounts. */
export function formatINR(amount: number): string {
  if (!Number.isFinite(amount)) return '0';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(
    Math.round(amount)
  );
}

export function formatINRDecimal(amount: number, fractionDigits = 2): string {
  if (!Number.isFinite(amount)) return '0';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}
