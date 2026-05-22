import { useState } from 'react';
import api from '../api/axios';
import { dispatchFinanceUpdated } from '../utils/financeEvents';
import { Plus } from 'lucide-react';
import { validateExpense } from '../utils/validation';
import { toast } from '../utils/toastBus';

const categories = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Other'];

const ExpenseForm = ({ onExpenseAdded }) => {
  const [amountVal, setAmountVal] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const submitExpense = async (payload) => {
    await api.post('/expenses', payload);
    setAmountVal('');
    setDescription('');
    setErrors({});
    if (onExpenseAdded) onExpenseAdded();
    dispatchFinanceUpdated();
    toast({ message: 'Expense added! ✅', type: 'success' });
  };

  const handleSubmit = async (e, force = false) => {
    e.preventDefault();
    const amount = Number(amountVal);
    const { isValid, errors: validationErrors } = validateExpense(amount, category, description);
    if (!isValid) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      await submitExpense({ amount, category, description: description.trim(), force });
    } catch (error) {
      if (error.response?.status === 409 && error.response?.data?.duplicate) {
        const confirmed = window.confirm('Looks like a duplicate. Add anyway?');
        if (confirmed) {
          try {
            await submitExpense({ amount, category, description: description.trim(), force: true });
          } catch (retryErr) {
            toast({ message: 'Failed to add expense', type: 'error' });
          }
        }
      } else {
        toast({
          message: error.response?.data?.message || 'Failed to add expense',
          type: 'error',
        });
      }
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card p-5 flex flex-col gap-4 card-tilt">
      <h3 className="font-semibold text-lg text-white mb-2">Add Expense</h3>
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-2.5 text-slate-400">₹</span>
          <input
            type="number"
            value={amountVal}
            onChange={(e) => setAmountVal(e.target.value)}
            className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2 pl-8 pr-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
            placeholder="Amount"
          />
          {errors.amount && <p className="text-xs text-error mt-1">{errors.amount}</p>}
        </div>
        <div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-slate-900/50 border border-white/10 rounded-xl py-2 px-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
          >
            {categories.map((c) => (
              <option key={c} value={c} className="bg-slate-900">
                {c}
              </option>
            ))}
          </select>
          {errors.category && <p className="text-xs text-error mt-1">{errors.category}</p>}
        </div>
      </div>
      <div>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2 px-4 text-white focus:outline-none focus:border-blue-500 transition-colors"
          placeholder="What was this for?"
        />
        {errors.description && <p className="text-xs text-error mt-1">{errors.description}</p>}
      </div>
      <button type="submit" disabled={loading} className="btn-primary flex items-center justify-center gap-2 mt-2">
        <Plus className="w-5 h-5" />
        Add Expense
      </button>
    </form>
  );
};

export default ExpenseForm;
