const UPI_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;

export function isValidUPI(upiId) {
  if (!upiId || typeof upiId !== 'string') return false;
  return UPI_REGEX.test(upiId.trim());
}

export function openUpiLink(url) {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) {
    return { opened: false, message: 'UPI links only work on mobile. Use WhatsApp instead.' };
  }
  window.location.href = url;
  return { opened: true };
}

export const SPLIT_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Entertainment',
  'Health',
  'Other',
];
