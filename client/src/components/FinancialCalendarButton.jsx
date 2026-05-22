import { useCalendarDrawer } from '../context/CalendarDrawerContext';

const FinancialCalendarButton = () => {
  const { openDrawer } = useCalendarDrawer();

  return (
    <button
      type="button"
      onClick={openDrawer}
      className="p-2 text-slate-400 hover:text-secondary transition-colors relative group"
      aria-label="Open spending calendar"
    >
      <span className="material-symbols-outlined group-hover:drop-shadow-[0_0_8px_rgba(68,226,205,0.6)] transition-all">
        calendar_month
      </span>
    </button>
  );
};

export default FinancialCalendarButton;
