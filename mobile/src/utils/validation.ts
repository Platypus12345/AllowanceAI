export const validateExpense = (amount: number, category: string, description: string) => {
  const errors: Record<string, string> = {};
  if (!amount || isNaN(amount)) errors.amount = 'Amount is required';
  else if (amount <= 0) errors.amount = 'Amount must be greater than 0';
  else if (amount > 100000) errors.amount = 'Amount seems too high. Max ₹1,00,000';
  if (!category) errors.category = 'Please select a category';
  if (!description || description.trim().length < 2) errors.description = 'Description must be at least 2 characters';
  return { isValid: Object.keys(errors).length === 0, errors };
};

export const validateAllowance = (amount: number) => {
  if (!amount || isNaN(amount)) return 'Allowance is required';
  if (amount <= 0) return 'Allowance must be greater than 0';
  if (amount > 1000000) return 'Allowance cannot exceed ₹10,00,000';
  return null;
};

export const validateBudgetGoal = (limit: number, spent: number) => {
  if (limit <= 0) return 'Limit must be greater than 0';
  if (limit < spent) return `You've already spent ₹${spent}. Set limit higher.`;
  if (limit > 500000) return 'Limit seems too high';
  return null;
};
