import { formatRupee } from '../utils/formatters';
import api from '../api/axios';
import { dispatchFinanceUpdated } from '../utils/financeEvents';
import { toast } from '../utils/toastBus';

const ExpenseList = ({ expenses, onExpenseDeleted }) => {
  const handleDelete = async (id) => {
    try {
      await api.delete(`/expenses/${id}`);
      if (onExpenseDeleted) onExpenseDeleted();
      dispatchFinanceUpdated();
      toast({ message: 'Expense removed', type: 'success' });
    } catch (error) {
      console.error('Failed to delete', error);
      toast({ message: 'Failed to delete expense', type: 'error' });
    }
  };

  const categories = {
    'Food': { icon: 'restaurant', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
    'Transport': { icon: 'directions_bus', color: 'text-blue-400', bg: 'bg-blue-400/10' },
    'Shopping': { icon: 'shopping_bag', color: 'text-violet-400', bg: 'bg-violet-400/10' },
    'Entertainment': { icon: 'movie', color: 'text-pink-400', bg: 'bg-pink-400/10' },
    'Health': { icon: 'medical_services', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    'Other': { icon: 'more_horiz', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  };

  return (
    <div className="flex flex-col h-full divide-y divide-white/5">
      {expenses.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <span className="material-symbols-outlined text-4xl text-outline opacity-20 mb-2">receipt_long</span>
          <p className="text-on-surface-variant font-plus text-sm">No expenses yet. Time to go shopping?</p>
        </div>
      ) : (
        expenses.map(expense => {
          const cat = categories[expense.category] || categories['Other'];
          return (
            <div key={expense._id} className="group flex items-center gap-4 px-6 py-4 hover:bg-white/5 transition-colors">
              <div className={`w-12 h-12 rounded-2xl ${cat.bg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined ${cat.color} text-2xl filled`}>{cat.icon}</span>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-plus font-bold text-on-surface truncate leading-tight">
                  {expense.description || expense.category}
                </p>
                <p className="text-[10px] font-label-caps text-on-surface-variant uppercase tracking-wider mt-1">
                  {new Date(expense.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • {expense.category}
                </p>
              </div>

              <div className="text-right">
                <p className="font-space font-bold text-on-surface">
                  {formatRupee(expense.amount)}
                </p>
                <button 
                  onClick={() => handleDelete(expense._id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-error hover:scale-110 active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default ExpenseList;
