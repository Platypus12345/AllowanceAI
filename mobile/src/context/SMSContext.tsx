import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform, Alert, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { SMSConfirmSheet } from '@/src/components/SMSConfirmSheet';
import * as budgetClient from '@/src/api/budgetClient';
import type { ExpenseCategory } from '@/src/api/budgetClient';
import type { ParsedBankSms, SmsLogEntry } from '@/src/types/sms';
import {
  mergeParsedFromPersisted,
  toPersistedParsed,
  loadAutoSmsEnabled,
  loadPendingQueue,
  loadProcessedIds,
  loadSmsLog,
  saveAutoSmsEnabled,
  savePendingQueue,
  saveProcessedIds,
  saveSmsLog,
} from '@/src/services/smsStorage';
import {
  scanInboxForNewTransactions,
  registerSmsBackgroundFetch,
  unregisterSmsBackgroundFetch,
  notifyNewBankSms,
  requestNotificationPermissions,
} from '@/src/services/smsListener';
import { checkSmsPermission, requestSmsPermissions } from '@/src/services/smsPermissions';

type SMSContextValue = {
  autoSmsEnabled: boolean;
  setAutoSmsEnabled: (v: boolean) => Promise<void>;
  smsPermissionGranted: boolean;
  refreshSmsPermission: () => Promise<void>;
  requestSmsAccess: () => Promise<boolean>;
  openAppSettings: () => void;
  pendingSMS: ParsedBankSms[];
  smsLog: SmsLogEntry[];
  openConfirmForSmsId: (smsId: string) => void;
  reloadFromStorage: () => Promise<void>;
};

const SMSContext = createContext<SMSContextValue | null>(null);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function SMSProvider({ children }: { children: React.ReactNode }) {
  const [autoSmsEnabled, setAutoState] = useState(true);
  const [smsPermissionGranted, setSmsPermissionGranted] = useState(false);
  const [pendingPersisted, setPendingPersisted] = useState<Omit<ParsedBankSms, 'raw'>[]>([]);
  const [smsLog, setSmsLog] = useState<SmsLogEntry[]>([]);
  const [sheetItem, setSheetItem] = useState<ParsedBankSms | null>(null);
  const appState = useRef(AppState.currentState);

  const pendingSMS = useMemo(
    () => pendingPersisted.map((p) => mergeParsedFromPersisted(p)),
    [pendingPersisted]
  );

  const reloadFromStorage = useCallback(async () => {
    const [pend, log, auto] = await Promise.all([
      loadPendingQueue(),
      loadSmsLog(),
      loadAutoSmsEnabled(),
    ]);
    setPendingPersisted(pend);
    let mergedLog = [...log];
    const logIds = new Set(mergedLog.map((l) => l.id));
    for (const p of pend) {
      if (!logIds.has(p.smsId)) {
        logIds.add(p.smsId);
        mergedLog = [
          {
            id: p.smsId,
            amount: p.amount,
            merchant: p.merchant,
            type: p.type,
            status: 'pending' as const,
            date: p.date,
          },
          ...mergedLog,
        ];
      }
    }
    if (mergedLog.length !== log.length) {
      await saveSmsLog(mergedLog);
    }
    setSmsLog(mergedLog);
    setAutoState(auto);
  }, []);

  const refreshSmsPermission = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setSmsPermissionGranted(false);
      return;
    }
    const ok = await checkSmsPermission();
    setSmsPermissionGranted(ok);
  }, []);

  const openAppSettings = useCallback(() => {
    Linking.openSettings();
  }, []);

  const persistProcessed = useCallback(async (next: string[]) => {
    await saveProcessedIds(next);
  }, []);

  const persistPending = useCallback(async (next: Omit<ParsedBankSms, 'raw'>[]) => {
    setPendingPersisted(next);
    await savePendingQueue(next);
  }, []);

  const persistLog = useCallback(async (next: SmsLogEntry[]) => {
    setSmsLog(next);
    await saveSmsLog(next);
  }, []);

  const setAutoSmsEnabled = useCallback(
    async (v: boolean) => {
      setAutoState(v);
      await saveAutoSmsEnabled(v);
      if (Platform.OS === 'android') {
        if (v) {
          await requestNotificationPermissions();
          await registerSmsBackgroundFetch();
        } else {
          await unregisterSmsBackgroundFetch();
        }
      }
    },
    []
  );

  const openConfirmForSmsId = useCallback(
    (smsId: string) => {
      const p = pendingSMS.find((x) => x.smsId === smsId);
      if (p) setSheetItem(p);
    },
    [pendingSMS]
  );

  const runScan = useCallback(async () => {
    if (Platform.OS !== 'android' || !autoSmsEnabled) return;
    const granted = await checkSmsPermission();
    if (!granted) return;

    const proc = new Set(await loadProcessedIds());
    const pendRows = await loadPendingQueue();
    const pendIds = new Set(pendRows.map((p) => p.smsId));
    const items = await scanInboxForNewTransactions(proc, pendIds);
    if (items.length === 0) return;

    let nextPending = [...pendRows];
    const currentLog = await loadSmsLog();
    let nextLog = [...currentLog];
    let changed = false;

    for (const it of items) {
      if (nextPending.some((p) => p.smsId === it.smsId)) continue;
      nextPending = [toPersistedParsed(it), ...nextPending];
      changed = true;
      if (!nextLog.some((l) => l.id === it.smsId)) {
        nextLog = [
          {
            id: it.smsId,
            amount: it.amount,
            merchant: it.merchant,
            type: it.type,
            status: 'pending',
            date: it.date,
          },
          ...nextLog,
        ];
      }
    }

    if (changed) {
      await persistPending(nextPending);
      await persistLog(nextLog);
      await notifyNewBankSms(items[0]);
      setSheetItem((cur) => cur ?? mergeParsedFromPersisted(toPersistedParsed(items[0])));
    }
  }, [autoSmsEnabled, persistPending, persistLog]);

  const requestSmsAccess = useCallback(async () => {
    const ok = await requestSmsPermissions();
    await refreshSmsPermission();
    if (ok && autoSmsEnabled) {
      setTimeout(() => {
        void runScan();
      }, 300);
    }
    return ok;
  }, [refreshSmsPermission, autoSmsEnabled, runScan]);

  useEffect(() => {
    reloadFromStorage();
    refreshSmsPermission();
  }, [reloadFromStorage, refreshSmsPermission]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    (async () => {
      if (autoSmsEnabled) {
        await requestNotificationPermissions();
        await registerSmsBackgroundFetch();
      } else {
        await unregisterSmsBackgroundFetch();
      }
    })();
  }, [autoSmsEnabled]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        reloadFromStorage();
        refreshSmsPermission();
        runScan();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [reloadFromStorage, refreshSmsPermission, runScan]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !autoSmsEnabled || !smsPermissionGranted) return;
    runScan();
    const t = setInterval(runScan, 45_000);
    return () => clearInterval(t);
  }, [autoSmsEnabled, smsPermissionGranted, runScan]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { smsId?: string };
      if (data?.smsId) {
        setTimeout(() => openConfirmForSmsId(String(data.smsId)), 400);
      }
    });
    return () => sub.remove();
  }, [openConfirmForSmsId]);

  const markProcessed = useCallback(async (smsId: string) => {
    const current = await loadProcessedIds();
    if (current.includes(smsId)) return;
    const next = [...current, smsId];
    await persistProcessed(next);
  }, [persistProcessed]);

  const updateLogStatus = useCallback(
    async (
      smsId: string,
      status: SmsLogEntry['status'],
      patch: Partial<SmsLogEntry> = {},
      fallback?: Omit<SmsLogEntry, 'status'>
    ) => {
      const current = await loadSmsLog();
      const idx = current.findIndex((e) => e.id === smsId);
      let next: SmsLogEntry[];
      if (idx === -1 && fallback) {
        next = [{ ...fallback, status, ...patch }, ...current];
      } else if (idx === -1) {
        next = current;
      } else {
        next = current.map((e) => (e.id === smsId ? { ...e, status, ...patch } : e));
      }
      await persistLog(next);
    },
    [persistLog]
  );

  const handleCloseSheet = useCallback(() => {
    setSheetItem(null);
  }, []);

  const handleIgnore = useCallback(async () => {
    if (!sheetItem) return;
    const id = sheetItem.smsId;
    await markProcessed(id);
    await updateLogStatus(id, 'ignored', {}, {
      id,
      amount: sheetItem.amount,
      merchant: sheetItem.merchant,
      type: sheetItem.type,
      date: sheetItem.date,
    });
    const pend = await loadPendingQueue();
    const nextPend = pend.filter((p) => p.smsId !== id);
    await persistPending(nextPend);
    const nxt = nextPend[0] ? mergeParsedFromPersisted(nextPend[0]) : null;
    setSheetItem(nxt);
  }, [sheetItem, markProcessed, updateLogStatus, persistPending]);

  const handleAddExpense = useCallback(
    async ({ category, description }: { category: ExpenseCategory; description: string }) => {
      if (!sheetItem) return;
      const id = sheetItem.smsId;
      try {
        const amount =
          sheetItem.type === 'refund' ? -Math.abs(sheetItem.amount) : Math.abs(sheetItem.amount);
        const created = await budgetClient.postExpense({
          amount,
          category,
          description: description || sheetItem.merchant,
        });
        await markProcessed(id);
        const pend = await loadPendingQueue();
        const rest = pend.filter((p) => p.smsId !== id);
        await persistPending(rest);
        await updateLogStatus(
          id,
          'added',
          {
            category,
            description: description || sheetItem.merchant,
            linkedExpenseId: created._id,
          },
          {
            id,
            amount: sheetItem.amount,
            merchant: sheetItem.merchant,
            type: sheetItem.type,
            date: sheetItem.date,
          }
        );
        const nxt = rest[0] ? mergeParsedFromPersisted(rest[0]) : null;
        setSheetItem(nxt);
      } catch (e: unknown) {
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Request failed';
        Alert.alert('Could not save expense', msg);
      }
    },
    [sheetItem, markProcessed, updateLogStatus, persistPending]
  );

  const handleUpdateAllowance = useCallback(
    async ({ description }: { description: string }) => {
      if (!sheetItem) return;
      const id = sheetItem.smsId;
      try {
        const stats = await budgetClient.fetchBudgetStats();
        const nextAllowance = (stats.totalAllowance ?? 0) + Math.abs(sheetItem.amount);
        await budgetClient.putAllowance(nextAllowance);
        await markProcessed(id);
        const pend = await loadPendingQueue();
        const rest = pend.filter((p) => p.smsId !== id);
        await persistPending(rest);
        await updateLogStatus(
          id,
          'added',
          { description: description || sheetItem.merchant },
          {
            id,
            amount: sheetItem.amount,
            merchant: sheetItem.merchant,
            type: sheetItem.type,
            date: sheetItem.date,
          }
        );
        const nxt = rest[0] ? mergeParsedFromPersisted(rest[0]) : null;
        setSheetItem(nxt);
      } catch (e: unknown) {
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as Error).message) : 'Request failed';
        Alert.alert('Could not update allowance', msg);
      }
    },
    [sheetItem, markProcessed, updateLogStatus, persistPending]
  );

  const value = useMemo<SMSContextValue>(
    () => ({
      autoSmsEnabled,
      setAutoSmsEnabled,
      smsPermissionGranted,
      refreshSmsPermission,
      requestSmsAccess,
      openAppSettings,
      pendingSMS,
      smsLog,
      openConfirmForSmsId,
      reloadFromStorage,
    }),
    [
      autoSmsEnabled,
      setAutoSmsEnabled,
      smsPermissionGranted,
      refreshSmsPermission,
      requestSmsAccess,
      openAppSettings,
      pendingSMS,
      smsLog,
      openConfirmForSmsId,
      reloadFromStorage,
    ]
  );

  return (
    <SMSContext.Provider value={value}>
      {children}
      <SMSConfirmSheet
        visible={!!sheetItem}
        parsed={sheetItem}
        onClose={handleCloseSheet}
        onIgnore={handleIgnore}
        onAddExpense={handleAddExpense}
        onUpdateAllowance={handleUpdateAllowance}
      />
    </SMSContext.Provider>
  );
}

export function useSMS() {
  const ctx = useContext(SMSContext);
  if (!ctx) throw new Error('useSMS must be used within SMSProvider');
  return ctx;
}
