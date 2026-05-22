import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import {
  postExpense,
  type ExpenseCategory,
} from '@/src/api/budgetClient';
import { validateExpense } from '@/src/utils/validation';
import { useToast } from '@/src/context/ToastContext';
import * as Haptics from 'expo-haptics';

const CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Transport',
  'Shopping',
  'Entertainment',
  'Health',
  'Other',
];

export default function AddExpenseModal() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Food');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const saveExpense = async (n: number, desc: string, force?: boolean) => {
    await postExpense({
      amount: n,
      category,
      description: desc,
      force,
    } as Parameters<typeof postExpense>[0] & { force?: boolean });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast({ message: 'Expense added! ✅', type: 'success' });
    router.back();
  };

  const onSubmit = async () => {
    const n = parseFloat(amount.replace(/,/g, ''));
    const desc = description.trim() || category;
    const { isValid, errors: vErr } = validateExpense(n, category, desc);
    if (!isValid) {
      setErrors(vErr);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await saveExpense(n, desc);
    } catch (e: unknown) {
      const ax = e as { response?: { status?: number; data?: { duplicate?: boolean; message?: string } } };
      if (ax.response?.status === 409 && ax.response?.data?.duplicate) {
        Alert.alert('Duplicate?', 'Looks like a duplicate. Add anyway?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Add anyway',
            onPress: async () => {
              try {
                await saveExpense(n, desc, true);
              } catch {
                toast({ message: 'Failed to add expense', type: 'error' });
              }
            },
          },
        ]);
      } else {
        const msg = ax.response?.data?.message || 'Could not save expense.';
        toast({ message: msg, type: 'error' });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      className="flex-1 bg-[#050d1a]"
      style={{ paddingBottom: insets.bottom }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-white/10">
          <Text className="text-white text-xl font-bold">Add expense</Text>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <X color="#94a3b8" size={26} />
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1 px-4 pt-4"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <Text className="text-slate-400 text-xs uppercase tracking-widest mb-2">Amount (₹)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor="#64748b"
            className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white text-lg mb-6"
          />

          <Text className="text-slate-400 text-xs uppercase tracking-widest mb-2">Category</Text>
          <View className="flex-row flex-wrap gap-2 mb-6">
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCategory(c)}
                className={`px-4 py-2 rounded-full border ${
                  category === c
                    ? 'bg-sky-500/30 border-sky-400'
                    : 'bg-white/5 border-white/10'
                }`}>
                <Text
                  className={category === c ? 'text-white font-bold' : 'text-slate-400 font-medium'}>
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-slate-400 text-xs uppercase tracking-widest mb-2">Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What was this for?"
            placeholderTextColor="#64748b"
            className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white min-h-[88px] mb-8"
            multiline
          />

          <TouchableOpacity
            disabled={saving}
            onPress={() => void onSubmit()}
            activeOpacity={0.9}
            className="rounded-2xl overflow-hidden">
            <BlurView
              intensity={25}
              tint="dark"
              className="bg-sky-500 py-4 items-center rounded-2xl border border-sky-400/40">
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-bold text-base">Save expense</Text>
              )}
            </BlurView>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
