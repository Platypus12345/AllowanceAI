import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, Fonts } from '@/constants/theme';
import {
  fetchSplits,
  fetchFriends,
  postSplit,
  postFriend,
  settleSplit,
  deleteSplit,
  remindSplit,
  type FriendRow,
  type SplitRow,
} from '@/src/api/budgetClient';
import { isValidUPI } from '@/src/utils/validation';
import { useToast } from '@/src/context/ToastContext';
import { formatINR } from '@/src/lib/formatINR';

const CATEGORIES = ['Food', 'Transport', 'Shopping', 'Entertainment', 'Health', 'Other'];

export default function SplitsScreen() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [pending, setPending] = useState<SplitRow[]>([]);
  const [settled, setSettled] = useState<SplitRow[]>([]);
  const [summary, setSummary] = useState({ totalOwedToYou: 0, totalYouOwe: 0, peopleOweYou: 0 });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);

  const [friendId, setFriendId] = useState('');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [yourShare, setYourShare] = useState('');
  const [friendShare, setFriendShare] = useState('');
  const [category, setCategory] = useState('Other');

  const [fName, setFName] = useState('');
  const [fUpi, setFUpi] = useState('');
  const [fPhone, setFPhone] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, fr] = await Promise.all([fetchSplits(), fetchFriends()]);
      setPending(s.pending);
      setSettled(s.settled);
      setSummary({ totalOwedToYou: s.totalOwedToYou, totalYouOwe: s.totalYouOwe, peopleOweYou: s.peopleOweYou });
      setFriends(fr);
      if (fr[0] && !friendId) setFriendId(fr[0]._id);
    } catch {
      toast({ message: 'Failed to load splits', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [friendId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = Number(totalAmount) || 0;
  const eq = total > 0 ? Math.round((total / 2) * 100) / 100 : 0;
  const dispYours = splitType === 'equal' ? total - eq : Number(yourShare) || 0;
  const dispFriend = splitType === 'equal' ? eq : Number(friendShare) || 0;

  const onCreate = async () => {
    if (!friendId || !description || !total) return;
    try {
      await postSplit({
        friendId,
        description,
        totalAmount: total,
        splitType,
        yourShare: dispYours,
        friendShare: dispFriend,
        category,
      });
      toast({ message: 'Split created', type: 'success' });
      setSheetOpen(false);
      load();
    } catch (e: any) {
      toast({ message: e.response?.data?.message || 'Failed', type: 'error' });
    }
  };

  const onAddFriend = async () => {
    if (!fName.trim() || !isValidUPI(fUpi)) return;
    try {
      const f = await postFriend({ name: fName.trim(), upiId: fUpi, phone: fPhone || undefined });
      setFriends((p) => [...p, f]);
      setFriendId(f._id);
      setAddFriendOpen(false);
      setFName('');
      setFUpi('');
      toast({ message: 'Friend saved', type: 'success' });
    } catch (e: any) {
      toast({ message: e.response?.data?.message || 'Failed', type: 'error' });
    }
  };

  const onSettle = (split: SplitRow) => {
    Alert.alert('Settle', `Mark ${formatINR(split.friendShare)} from ${split.friendName} as settled?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Settle',
        onPress: async () => {
          try {
            const res = await settleSplit(split._id);
            toast({ message: 'Settled', type: 'success' });
            if (res.upiPayLink) {
              Alert.alert('Open UPI?', 'Pay friend via UPI now?', [
                { text: 'Skip' },
                { text: 'Open', onPress: () => Linking.openURL(res.upiPayLink) },
              ]);
            }
            load();
          } catch {
            toast({ message: 'Failed to settle', type: 'error' });
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="chevron-left" size={32} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Split Expenses</Text>
        <TouchableOpacity onPress={() => setSheetOpen(true)} style={styles.fab}>
          <MaterialIcons name="add" size={28} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderColor: `${Colors.secondary}40` }]}>
            <Text style={styles.summaryLabel}>Owed to you</Text>
            <Text style={[styles.summaryAmt, { color: Colors.secondary }]}>{formatINR(summary.totalOwedToYou)}</Text>
          </View>
          <View style={[styles.summaryCard, { borderColor: `${Colors.error}40` }]}>
            <Text style={styles.summaryLabel}>You owe</Text>
            <Text style={[styles.summaryAmt, { color: Colors.error }]}>{formatINR(summary.totalYouOwe)}</Text>
          </View>
        </ScrollView>

        <Text style={styles.sectionHead}>Pending</Text>
        {pending.length === 0 ? (
          <Text style={styles.empty}>No pending splits. All settled up!</Text>
        ) : (
          pending.map((s) => (
            <TouchableOpacity key={s._id} style={styles.splitItem} onPress={() => onSettle(s)}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{s.friendName[0]}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.splitName}>{s.friendName}</Text>
                <Text style={styles.splitDesc}>{s.description}</Text>
              </View>
              <Text style={styles.splitAmt}>{formatINR(s.friendShare)}</Text>
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.sectionHead}>Settled</Text>
        {settled.length === 0 ? (
          <Text style={styles.empty}>No settlement history yet.</Text>
        ) : (
          settled.map((s) => (
            <View key={s._id} style={[styles.splitItem, { opacity: 0.6 }]}>
              <MaterialIcons name="check-circle" size={20} color={Colors.secondary} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.splitName}>{s.friendName}</Text>
                <Text style={styles.splitDesc}>{s.description}</Text>
              </View>
              <Text style={styles.splitAmt}>{formatINR(s.friendShare)}</Text>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={sheetOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>New Split</Text>
            <ScrollView horizontal style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 8 }}>
              {friends.map((f) => (
                <TouchableOpacity key={f._id} onPress={() => setFriendId(f._id)} style={[styles.friendChip, friendId === f._id && styles.friendChipActive]}>
                  <Text style={styles.friendChipText}>{f.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => { setSheetOpen(false); setAddFriendOpen(true); }} style={styles.friendChip}>
                <MaterialIcons name="person-add" size={18} color={Colors.primary} />
              </TouchableOpacity>
            </ScrollView>
            <TextInput style={styles.input} placeholder="Description" placeholderTextColor={Colors.onSurfaceVariant} value={description} onChangeText={setDescription} />
            <TextInput style={styles.input} placeholder="Amount" placeholderTextColor={Colors.onSurfaceVariant} keyboardType="numeric" value={totalAmount} onChangeText={setTotalAmount} />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              {(['equal', 'custom'] as const).map((t) => (
                <TouchableOpacity key={t} onPress={() => setSplitType(t)} style={[styles.toggle, splitType === t && styles.toggleOn]}>
                  <Text style={styles.toggleText}>{t === 'equal' ? 'Equal' : 'Custom'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 12 }}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} onPress={() => setCategory(c)} style={[styles.catPill, category === c && styles.catPillOn]}>
                  <Text style={styles.catText}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.primaryBtn} onPress={onCreate}>
              <Text style={styles.primaryBtnText}>Create Split</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSheetOpen(false)} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: Colors.onSurfaceVariant }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={addFriendOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <BlurView intensity={20} tint="dark" style={styles.sheet}>
            <Text style={styles.sheetTitle}>Add Friend</Text>
            <TextInput style={styles.input} placeholder="Name" placeholderTextColor={Colors.onSurfaceVariant} value={fName} onChangeText={setFName} />
            <TextInput style={styles.input} placeholder="UPI ID" placeholderTextColor={Colors.onSurfaceVariant} autoCapitalize="none" value={fUpi} onChangeText={setFUpi} />
            {fUpi ? <MaterialIcons name={isValidUPI(fUpi) ? 'check-circle' : 'error'} size={20} color={isValidUPI(fUpi) ? Colors.secondary : Colors.error} style={{ alignSelf: 'flex-end', marginBottom: 8 }} /> : null}
            <TextInput style={styles.input} placeholder="Phone (optional)" placeholderTextColor={Colors.onSurfaceVariant} value={fPhone} onChangeText={setFPhone} />
            <TouchableOpacity style={styles.primaryBtn} onPress={onAddFriend} disabled={!isValidUPI(fUpi)}>
              <Text style={styles.primaryBtnText}>Save Friend</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAddFriendOpen(false)} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={{ color: Colors.onSurfaceVariant }}>Cancel</Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12 },
  headerTitle: { flex: 1, fontSize: 22, fontFamily: Fonts.plusExtraBold, color: 'white' },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  summaryRow: { paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  summaryCard: { width: 160, padding: 16, borderRadius: 20, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.03)' },
  summaryLabel: { fontSize: 10, fontFamily: Fonts.plusBold, color: Colors.onSurfaceVariant, textTransform: 'uppercase' },
  summaryAmt: { fontSize: 22, fontFamily: Fonts.spaceBold, marginTop: 4 },
  sectionHead: { fontSize: 10, fontFamily: Fonts.plusBold, color: Colors.onSurfaceVariant, marginLeft: 24, marginBottom: 8, letterSpacing: 1 },
  empty: { marginHorizontal: 24, color: Colors.onSurfaceVariant, fontFamily: Fonts.plus, marginBottom: 16 },
  splitItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 8, padding: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 12, backgroundColor: `${Colors.primary}30`, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: Fonts.plusBold, color: Colors.primary },
  splitName: { fontFamily: Fonts.plusBold, color: 'white', fontSize: 15 },
  splitDesc: { fontFamily: Fonts.plus, color: Colors.onSurfaceVariant, fontSize: 11 },
  splitAmt: { fontFamily: Fonts.spaceBold, color: 'white', fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: Colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '85%' },
  sheetTitle: { fontSize: 20, fontFamily: Fonts.plusExtraBold, color: 'white', marginBottom: 16 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, color: 'white', fontFamily: Fonts.plus, marginBottom: 10 },
  friendChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'transparent' },
  friendChipActive: { borderColor: Colors.secondary },
  friendChipText: { color: 'white', fontFamily: Fonts.plusBold, fontSize: 13 },
  toggle: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center' },
  toggleOn: { backgroundColor: `${Colors.primary}30` },
  toggleText: { color: 'white', fontFamily: Fonts.plusBold },
  catPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)' },
  catPillOn: { backgroundColor: `${Colors.secondary}25` },
  catText: { color: 'white', fontSize: 11, fontFamily: Fonts.plusBold },
  primaryBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 16, alignItems: 'center' },
  primaryBtnText: { color: 'white', fontFamily: Fonts.plusBold, fontSize: 16 },
});
