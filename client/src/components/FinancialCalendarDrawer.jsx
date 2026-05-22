import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import api from '../api/axios';
import { subscribeFinanceUpdated } from '../utils/financeEvents';
import { formatRupee } from '../utils/formatters';
import { useCalendarDrawer } from '../context/CalendarDrawerContext';
import { computeTooltipPosition, TOOLTIP_ESTIMATED_SIZE } from '../utils/tooltipPosition';

const LEVEL_STYLES = {
  none: 'heatmap-none',
  low: 'heatmap-low',
  moderate: 'heatmap-moderate',
  high: 'heatmap-high',
  danger: 'heatmap-danger',
};

const LEVEL_LABELS = {
  none: 'No spend',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  danger: 'Danger',
};

function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(key) {
  return parseDateKey(key).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const FinancialCalendarDrawer = () => {
  const { open, closeDrawer } = useCalendarDrawer();
  const [loading, setLoading] = useState(false);
  const [calendarData, setCalendarData] = useState(null);
  const [hoveredDay, setHoveredDay] = useState(null);
  const [anchorRect, setAnchorRect] = useState(null);
  const [tooltipCoords, setTooltipCoords] = useState(null);
  const tooltipRef = useRef(null);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const displayMonth = useMemo(() => new Date(year, month - 1, 1), [month, year]);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/stats/calendar', { params: { month, year } });
      setCalendarData(res.data);
    } catch (err) {
      console.error('Failed to load calendar stats', err);
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    if (open) fetchCalendar();
  }, [open, fetchCalendar]);

  useEffect(() => {
    if (!open) return undefined;
    return subscribeFinanceUpdated(fetchCalendar);
  }, [open, fetchCalendar]);

  useEffect(() => {
    if (!open) return undefined;

    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closeDrawer]);

  const dayMap = useMemo(() => {
    const map = {};
    calendarData?.days?.forEach((d) => {
      map[d.date] = d;
    });
    return map;
  }, [calendarData]);

  const modifiers = useMemo(() => {
    const result = { none: [], low: [], moderate: [], high: [], danger: [] };
    if (!calendarData?.days) return result;

    calendarData.days.forEach((day) => {
      const date = parseDateKey(day.date);
      const level = day.level || 'none';
      if (result[level]) result[level].push(date);
    });
    return result;
  }, [calendarData]);

  const updateTooltipPosition = useCallback((rect) => {
    if (!rect) return;
    const el = tooltipRef.current;
    const size = el
      ? { width: el.offsetWidth, height: el.offsetHeight }
      : TOOLTIP_ESTIMATED_SIZE;
    setTooltipCoords(computeTooltipPosition(rect, size));
  }, []);

  useLayoutEffect(() => {
    if (!hoveredDay || !anchorRect) return;
    updateTooltipPosition(anchorRect);
  }, [hoveredDay, anchorRect, updateTooltipPosition]);

  useEffect(() => {
    if (!hoveredDay) return undefined;
    const onResize = () => updateTooltipPosition(anchorRect);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [hoveredDay, anchorRect, updateTooltipPosition]);

  const handleDayMouseEnter = (day, _modifiers, e) => {
    const key = toDateKey(day);
    const data = dayMap[key] || {
      date: key,
      spent: 0,
      transactions: 0,
      allowanceAdded: 0,
      level: 'none',
      mood: 'No Spending',
      savingsScore: 100,
      categories: {},
      biggestExpense: null,
    };
    setHoveredDay(data);
    const rect = e.currentTarget?.getBoundingClientRect?.();
    if (rect) {
      setAnchorRect(rect);
      setTooltipCoords(computeTooltipPosition(rect, TOOLTIP_ESTIMATED_SIZE));
    }
  };

  const handleDayMouseLeave = () => {
    setHoveredDay(null);
    setAnchorRect(null);
    setTooltipCoords(null);
  };

  const handleMonthChange = (date) => {
    setMonth(date.getMonth() + 1);
    setYear(date.getFullYear());
    handleDayMouseLeave();
  };

  const insights = calendarData?.insights;

  const overlay = (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            key="heatmap-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overlay-backdrop"
            onClick={closeDrawer}
            aria-label="Close calendar"
          />

          <motion.aside
            key="heatmap-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Financial activity calendar"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="overlay-drawer"
          >
            <header className="heatmap-drawer-header">
              <div>
                <h2 className="font-plus font-black text-lg text-on-surface">Spending Heatmap</h2>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="p-2 rounded-xl hover:bg-white/10 text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="overlay-drawer-body">
              {loading && !calendarData ? (
                <div className="flex flex-col items-center py-16 animate-pulse">
                  <span className="material-symbols-outlined text-5xl text-primary/30 mb-3 filled">
                    calendar_month
                  </span>
                  <p className="text-on-surface-variant text-sm">Loading your patterns...</p>
                </div>
              ) : (
                <>
                  {insights && (
                    <div className="space-y-3">
                      {insights.safeSpendingStreak > 0 && (
                        <div className="glass-card rounded-2xl px-4 py-3 flex items-center gap-3 border-l-4 border-l-secondary">
                          <span className="text-xl">🔥</span>
                          <p className="text-sm font-plus font-semibold text-on-surface">
                            {insights.safeSpendingStreak} safe spending day
                            {insights.safeSpendingStreak === 1 ? '' : 's'} in a row
                          </p>
                        </div>
                      )}

                      {insights.worstDay && (
                        <div className="glass-card rounded-2xl px-4 py-3 border-l-4 border-l-error/80">
                          <p className="text-[10px] font-plus font-black uppercase tracking-widest text-slate-500 mb-1">
                            Highest spending
                          </p>
                          <p className="text-sm font-space font-bold text-error">
                            {formatRupee(insights.worstDay.spent)} on{' '}
                            {formatDisplayDate(insights.worstDay.date)}
                          </p>
                        </div>
                      )}

                      <div className="glass-card rounded-2xl px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-plus font-black uppercase tracking-widest text-slate-500">
                            This month
                          </p>
                          <p className="text-sm font-plus font-bold text-primary-container mt-0.5">
                            {insights.monthlyMood}
                          </p>
                        </div>
                        <span className="material-symbols-outlined text-tertiary filled">psychology</span>
                      </div>

                      {insights.categorySpike && (
                        <div className="glass-card rounded-2xl px-4 py-3 border border-tertiary/20 text-sm text-on-surface-variant leading-relaxed">
                          <span className="material-symbols-outlined text-tertiary text-base align-middle mr-1 filled">
                            trending_up
                          </span>
                          {insights.categorySpike.message}
                        </div>
                      )}

                      {insights.predictiveAlert && (
                        <div className="glass-card rounded-2xl px-4 py-3 border border-error/30 bg-error-container/10 text-sm text-error leading-relaxed">
                          <span className="material-symbols-outlined text-base align-middle mr-1 filled">
                            warning
                          </span>
                          {insights.predictiveAlert.message}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="finance-calendar-wrapper glass-card rounded-[1.75rem] p-4 glow-primary relative">
                    <DayPicker
                      mode="single"
                      month={displayMonth}
                      onMonthChange={handleMonthChange}
                      modifiers={modifiers}
                      modifiersClassNames={LEVEL_STYLES}
                      onDayMouseEnter={handleDayMouseEnter}
                      onDayMouseLeave={handleDayMouseLeave}
                      showOutsideDays
                      className="finance-day-picker"
                    />

                    <div className="flex flex-wrap items-center justify-center gap-3 mt-4 pt-3 border-t border-white/5">
                      {Object.entries(LEVEL_LABELS).map(([level, label]) => (
                        <div
                          key={level}
                          className="flex items-center gap-1.5 text-[10px] text-on-surface-variant"
                        >
                          <span className={`heatmap-legend-dot ${LEVEL_STYLES[level]}`} />
                          {label}
                        </div>
                      ))}
                    </div>
                  </div>

                  {calendarData?.dailyLimit > 0 && (
                    <p className="text-center text-xs text-on-surface-variant pb-2">
                      Safe daily spending:{' '}
                      <span className="font-space font-bold text-secondary">
                        {formatRupee(calendarData.dailyLimit)}/day
                      </span>
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.aside>

          {hoveredDay && tooltipCoords && (
            <motion.div
              ref={tooltipRef}
              key={`heatmap-tooltip-${hoveredDay.date}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
              className="heatmap-tooltip transform-gpu"
              style={{
                left: tooltipCoords.x,
                top: tooltipCoords.y,
                transformOrigin: tooltipCoords.transformOrigin,
                willChange: 'transform, opacity',
              }}
            >
              <div className="heatmap-tooltip-card tooltip-card w-[min(280px,calc(100vw-32px))] max-w-[280px] overflow-hidden rounded-2xl p-4 border border-white/15 bg-surface-container-highest/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.45),0_0_24px_rgba(128,131,255,0.12)]">
                <h3 className="font-plus font-bold text-sm text-on-surface mb-3 border-b border-white/10 pb-2">
                  {formatDisplayDate(hoveredDay.date)}
                </h3>
                <div className="space-y-1.5 text-xs">
                  <p className="flex justify-between gap-4">
                    <span className="text-on-surface-variant">Spent</span>
                    <span className="font-space font-bold text-error">
                      {formatRupee(hoveredDay.spent || 0)}
                    </span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span className="text-on-surface-variant">Transactions</span>
                    <span className="font-space font-semibold">{hoveredDay.transactions || 0}</span>
                  </p>
                  {hoveredDay.biggestExpense && (
                    <p className="flex justify-between gap-4">
                      <span className="text-on-surface-variant">Biggest</span>
                      <span className="font-plus font-semibold text-right text-on-surface max-w-[140px] truncate">
                        {hoveredDay.biggestExpense.description}{' '}
                        <span className="text-tertiary">
                          {formatRupee(hoveredDay.biggestExpense.amount)}
                        </span>
                      </span>
                    </p>
                  )}
                  {hoveredDay.allowanceAdded > 0 && (
                    <p className="flex justify-between gap-4">
                      <span className="text-on-surface-variant">Allowance Added</span>
                      <span className="font-space font-bold text-secondary">
                        {formatRupee(hoveredDay.allowanceAdded)}
                      </span>
                    </p>
                  )}
                  <p className="flex justify-between gap-4">
                    <span className="text-on-surface-variant">Daily Limit</span>
                    <span className="font-space font-bold text-secondary">
                      {formatRupee(hoveredDay.recommendedDailyLimit ?? calendarData?.dailyLimit ?? 0)}
                    </span>
                  </p>
                  <p className="flex justify-between gap-4">
                    <span className="text-on-surface-variant">Status</span>
                    <span
                      className={`font-plus font-bold ${
                        hoveredDay.spendingStatus === 'DANGER' || hoveredDay.level === 'danger'
                          ? 'text-error'
                          : hoveredDay.spendingStatus === 'SAFE' || hoveredDay.level === 'low'
                            ? 'text-secondary'
                            : 'text-tertiary'
                      }`}
                    >
                      {hoveredDay.spendingStatus || hoveredDay.mood}
                      {(hoveredDay.spendingStatus === 'SAFE' || hoveredDay.level === 'low') && ' ✅'}
                    </span>
                  </p>
                  <p className="flex justify-between gap-4 pt-1 border-t border-white/5">
                    <span className="text-on-surface-variant">Savings Score</span>
                    <span className="font-space font-bold text-primary-container">
                      {hoveredDay.savingsScore ?? 100}%
                    </span>
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(overlay, document.body);
};

export default FinancialCalendarDrawer;
