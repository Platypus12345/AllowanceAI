const MERCHANT_CATEGORY_MAP: Record<string, string> = {
  swiggy: 'Food',
  zomato: 'Food',
  dominos: 'Food',
  mcdonalds: 'Food',
  kfc: 'Food',
  subway: 'Food',
  dunzo: 'Food',
  blinkit: 'Food',
  zepto: 'Food',
  bigbasket: 'Food',
  instacart: 'Food',

  uber: 'Transport',
  ola: 'Transport',
  rapido: 'Transport',
  irctc: 'Transport',
  redbus: 'Transport',
  makemytrip: 'Transport',
  indigo: 'Transport',
  metro: 'Transport',

  amazon: 'Shopping',
  flipkart: 'Shopping',
  myntra: 'Shopping',
  ajio: 'Shopping',
  meesho: 'Shopping',
  nykaa: 'Shopping',
  reliance: 'Shopping',
  dmart: 'Shopping',

  netflix: 'Entertainment',
  spotify: 'Entertainment',
  youtube: 'Entertainment',
  hotstar: 'Entertainment',
  bookmyshow: 'Entertainment',
  prime: 'Entertainment',
  disney: 'Entertainment',
  zee5: 'Entertainment',

  practo: 'Health',
  pharmeasy: 'Health',
  netmeds: 'Health',
  apollo: 'Health',
  medplus: 'Health',
  cult: 'Health',

  default: 'Other',
};

export function getMerchantCategory(merchantName: string): string {
  const lower = merchantName.toLowerCase();
  for (const [key, category] of Object.entries(MERCHANT_CATEGORY_MAP)) {
    if (key === 'default') continue;
    if (lower.includes(key)) return category;
  }
  return 'Other';
}
