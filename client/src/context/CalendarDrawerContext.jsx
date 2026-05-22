import { createContext, useContext, useState, useMemo } from 'react';

const CalendarDrawerContext = createContext(null);

export function CalendarDrawerProvider({ children }) {
  const [open, setOpen] = useState(false);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      openDrawer: () => setOpen(true),
      closeDrawer: () => setOpen(false),
    }),
    [open]
  );

  return (
    <CalendarDrawerContext.Provider value={value}>
      {children}
    </CalendarDrawerContext.Provider>
  );
}

export function useCalendarDrawer() {
  const ctx = useContext(CalendarDrawerContext);
  if (!ctx) {
    throw new Error('useCalendarDrawer must be used within CalendarDrawerProvider');
  }
  return ctx;
}
