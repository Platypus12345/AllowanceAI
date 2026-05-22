import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2, X } from 'lucide-react-native';
import type { ParsedBankSms } from '@/src/types/sms';
import type { ExpenseCategory } from '@/src/api/budgetClient';
import { formatINRDecimal } from '@/src/lib/formatINR';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_HEIGHT = Math.round(SCREEN_H * 0.7);

const CATEGORIES: ExpenseCategory[] = [
  'Food',
  'Transport',
  'Shopping',
  'Entertainment',
  'Health',
  'Other',
];

type Props = {
  visible: boolean;
  parsed: ParsedBankSms | null;
  onClose: () => void;
  onIgnore: () => void;
  onAddExpense: (payload: {
    category: ExpenseCategory;
    description: string;
  }) => Promise<void>;
  onUpdateAllowance: (payload: { description: string }) => Promise<void>;
};

export function SMSConfirmSheet({
  visible,
  parsed,
  onClose,
  onIgnore,
  onAddExpense,
  onUpdateAllowance,
}: Props) {
  const [category, setCategory] = useState<ExpenseCategory>('Other');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (parsed) {
      setCategory(parsed.suggestedCategory as ExpenseCategory);
      setDescription(parsed.merchant);
    }
  }, [parsed]);

  if (!parsed) return null;

  const fmt = formatINRDecimal(parsed.amount);

  const subline = parsed.upiId
    ? `via UPI · ${parsed.upiId}`
    : parsed.bankName
      ? `${parsed.bankName}${parsed.last4 ? ` · ···${parsed.last4}` : ''}`
      : parsed.sender;

  const badge =
    parsed.type === 'debit' ? (
      <View className="bg-red-500/20 px-3 py-1 rounded-full border border-red-500/30">
        <Text className="text-red-400 text-xs font-bold tracking-widest">DEBIT</Text>
      </View>
    ) : parsed.type === 'credit' ? (
      <View className="bg-emerald-500/20 px-3 py-1 rounded-full border border-emerald-500/30">
        <Text className="text-emerald-400 text-xs font-bold tracking-widest">CREDIT</Text>
      </View>
    ) : (
      <View className="bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/30">
        <Text className="text-amber-400 text-xs font-bold tracking-widest">REFUND</Text>
      </View>
    );

  const primaryAction = async () => {
    setBusy(true);
    try {
      if (parsed.type === 'credit') {
        await onUpdateAllowance({ description });
      } else {
        await onAddExpense({ category, description });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 justify-end bg-black/60">
        <View style={{ height: SHEET_HEIGHT }} className="rounded-t-[24px] overflow-hidden">
          <BlurView intensity={30} tint="dark" className="flex-1 bg-[rgba(5,13,26,0.97)]">
            <View className="items-center pt-3 pb-2">
              <View className="w-10 h-1 rounded-full bg-white/20" />
            </View>

            <View className="flex-row items-center justify-between px-5 pb-4 border-b border-white/10">
              <View className="flex-row items-center gap-3 flex-1">
                <View className="w-10 h-10 rounded-2xl bg-sky-500/15 items-center justify-center border border-sky-500/25">
                  <Building2 color="#38bdf8" size={22} />
                </View>
                <Text className="text-white font-bold text-base flex-1">New Transaction Detected</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={12} className="p-1">
                <X color="#94a3b8" size={22} />
              </TouchableOpacity>
            </View>

            <ScrollView
              className="flex-1 px-5"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}>
              <View className="items-center py-6">
                <Text className="text-white font-bold" style={{ fontSize: 36 }}>
                  ₹{fmt}
                </Text>
                <View className="mt-3">{badge}</View>
                <Text className="text-slate-300 text-lg font-medium mt-4 text-center">
                  {parsed.merchant}
                </Text>
                <Text className="text-slate-500 text-xs mt-2 text-center px-4">{subline}</Text>
              </View>

              {(parsed.type === 'debit' || parsed.type === 'refund') && (
                <View className="mb-5">
                  <Text className="text-slate-400 text-xs uppercase tracking-widest mb-2">
                    Category
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10, paddingRight: 24 }}>
                    {CATEGORIES.map((c) => {
                      const selected = c === category;
                      return (
                        <TouchableOpacity key={c} onPress={() => setCategory(c)} activeOpacity={0.85}>
                          {selected ? (
                            <LinearGradient
                              colors={['#2563eb', '#06b6d4']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999 }}>
                              <Text className="text-white font-bold text-sm">{c}</Text>
                            </LinearGradient>
                          ) : (
                            <View className="px-4 py-2 rounded-full bg-white/5 border border-white/10">
                              <Text className="text-slate-400 font-medium text-sm">{c}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              <View className="mb-6">
                <Text className="text-slate-400 text-xs uppercase tracking-widest mb-2">
                  Description
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Add a note..."
                  placeholderTextColor="#64748b"
                  multiline
                  className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white min-h-[80px] text-base"
                />
              </View>

              {parsed.type === 'credit' ? (
                <TouchableOpacity
                  disabled={busy}
                  onPress={primaryAction}
                  activeOpacity={0.9}
                  className="mb-3 rounded-2xl overflow-hidden">
                  <LinearGradient
                    colors={['#059669', '#34d399']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ paddingVertical: 16, alignItems: 'center', borderRadius: 16 }}>
                    <Text className="text-white font-bold text-base">
                      {busy ? 'Updating…' : 'Update Allowance'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  disabled={busy}
                  onPress={primaryAction}
                  activeOpacity={0.9}
                  className="mb-3 rounded-2xl overflow-hidden">
                  <LinearGradient
                    colors={['#2563eb', '#06b6d4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ paddingVertical: 16, alignItems: 'center', borderRadius: 16 }}>
                    <Text className="text-white font-bold text-base">
                      {busy ? 'Saving…' : 'Add to Expenses'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={onIgnore} className="py-4 items-center mb-8">
                <Text className="text-slate-400 font-medium">Ignore</Text>
              </TouchableOpacity>
            </ScrollView>
          </BlurView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
