export const FINANCE_UPDATED_EVENT = 'financeDataUpdated';

export function dispatchFinanceUpdated() {
  window.dispatchEvent(new Event(FINANCE_UPDATED_EVENT));
}

export function subscribeFinanceUpdated(handler) {
  window.addEventListener(FINANCE_UPDATED_EVENT, handler);
  return () => window.removeEventListener(FINANCE_UPDATED_EVENT, handler);
}
