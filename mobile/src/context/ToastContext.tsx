import React, { createContext, useCallback, useContext, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ToastType = 'success' | 'error' | 'warning' | 'info';

type ToastItem = { id: number; message: string; type: ToastType };

const ToastContext = createContext<((opts: { message: string; type?: ToastType; duration?: number }) => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const insets = useSafeAreaInsets();

  const showToast = useCallback(({ message, type = 'info', duration = 3000 }) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const borderColor = (type: ToastType) => {
    if (type === 'success') return '#10b981';
    if (type === 'error') return '#ef4444';
    if (type === 'warning') return '#f59e0b';
    return '#8083ff';
  };

  const icon = (type: ToastType) => {
    if (type === 'success') return '✅';
    if (type === 'error') return '❌';
    if (type === 'warning') return '⚠️';
    return 'ℹ️';
  };

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <View style={[styles.container, { top: insets.top + 8 }]} pointerEvents="box-none">
        {toasts.map((t) => (
          <BlurView key={t.id} intensity={40} tint="dark" style={[styles.toast, { borderLeftColor: borderColor(t.type) }]}>
            <Text style={styles.icon}>{icon(t.type)}</Text>
            <Text style={styles.message}>{t.message}</Text>
          </BlurView>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast requires ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    overflow: 'hidden',
    borderLeftWidth: 4,
    backgroundColor: 'rgba(45, 52, 73, 0.6)',
  },
  icon: { fontSize: 18 },
  message: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
});
