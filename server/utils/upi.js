const UPI_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/;

function isValidUPI(upiId) {
  if (!upiId || typeof upiId !== 'string') return false;
  return UPI_REGEX.test(upiId.trim());
}

function normalizeUPI(upiId) {
  return upiId.trim().toLowerCase();
}

module.exports = { isValidUPI, normalizeUPI, UPI_REGEX };
