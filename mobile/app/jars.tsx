import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator, StyleSheet, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { fetchJars, postJar, contributeJar } from '@/src/api/budgetClient';
import { useToast } from '@/src/context/ToastContext';
import { formatINR } from '@/src/lib/formatINR';

export default function JarsScreen() {
  const router = useRouter();
  const toast = useToast();
  const [jars, setJars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [contrib, setContrib] = useState<any>(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [amount, setAmount] = useState('');

  const load = useCallback(async () => {
    try {
      setJars(await fetchJars());
    } catch {
      toast({ message: 'Failed to load jars', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const total = jars.reduce((s, j) => s + (j.currentAmount || 0), 0);

  if (loading) {
    return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={Colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><MaterialIcons name="chevron-left" size={32} color="white" /></TouchableOpacity>
        <Text style={styles.title}>Savings Jars</Text>
        <TouchableOpacity onPress={() => setSheet(true)}><MaterialIcons name="add" size={28} color="white" /></TouchableOpacity>
      </View>
      <Text style={styles.sub}>₹{formatINR(total)} saved across {jars.filter((j) => j.status === 'active').length} jars</Text>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {jars.filter((j) => j.status !== 'completed').map((jar) => (
          <View key={jar._id} style={styles.card}>
            <Text style={styles.jarName}>{jar.icon} {jar.name}</Text>
            <Text style={styles.amt}>₹{formatINR(jar.currentAmount)} / ₹{formatINR(jar.targetAmount)}</Text>
            <View style={styles.barBg}><View style={[styles.barFill, { width: `${jar.percent}%`, backgroundColor: jar.color }]} /></View>
            <Text style={styles.pct}>{jar.percent}%</Text>
            {jar.autoContributeEnabled && <Text style={styles.auto}>Auto ₹{jar.autoContributeAmount}/day</Text>}
            <View style={styles.row}>
              <TouchableOpacity onPress={() => setContrib(jar)}><Text style={styles.link}>Add Money</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => Share.share({ message: `Saving for ${jar.name} — ${jar.percent}% on AllowanceAI` })}><Text style={styles.link}>Share</Text></TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
      <Modal visible={sheet} animationType="slide" transparent>
        <View style={styles.overlay}><View style={styles.sheet}>
          <Text style={styles.sheetTitle}>New Jar</Text>
          <TextInput style={styles.input} placeholder="Name" placeholderTextColor={Colors.onSurfaceVariant} value={name} onChangeText={setName} />
          <TextInput style={styles.input} placeholder="Target ₹" keyboardType="numeric" placeholderTextColor={Colors.onSurfaceVariant} value={target} onChangeText={setTarget} />
          <TouchableOpacity style={styles.btn} onPress={async () => { await postJar({ name, targetAmount: Number(target), category: 'Fun' }); toast({ message: 'Jar created', type: 'success' }); setSheet(false); load(); }}><Text style={styles.btnText}>Create</Text></TouchableOpacity>
        </View></View>
      </Modal>
      <Modal visible={!!contrib} animationType="slide" transparent>
        <View style={styles.overlay}><View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Add to {contrib?.name}</Text>
          <TextInput style={styles.input} keyboardType="numeric" value={amount} onChangeText={setAmount} placeholder="Amount" placeholderTextColor={Colors.onSurfaceVariant} />
          <TouchableOpacity style={styles.btn} onPress={async () => { const r = await contributeJar(contrib._id, Number(amount)); if (r.justCompleted) toast({ message: 'Goal reached!', type: 'success' }); setContrib(null); load(); }}><Text style={styles.btnText}>Add</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12 },
  title: { flex: 1, fontSize: 22, fontFamily: Fonts.plusExtraBold, color: 'white' },
  sub: { paddingHorizontal: 20, color: Colors.secondary, fontFamily: Fonts.plus },
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  jarName: { color: 'white', fontFamily: Fonts.plusBold, fontSize: 16 },
  amt: { color: 'white', fontFamily: Fonts.spaceBold, marginTop: 4 },
  barBg: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, marginTop: 8 },
  barFill: { height: 8, borderRadius: 4 },
  pct: { color: Colors.secondary, fontFamily: Fonts.plus, marginTop: 4 },
  auto: { color: Colors.secondary, fontSize: 10, fontFamily: Fonts.plusBold, marginTop: 6 },
  row: { flexDirection: 'row', gap: 16, marginTop: 10 },
  link: { color: Colors.primary, fontFamily: Fonts.plusBold, fontSize: 12 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  sheetTitle: { color: 'white', fontFamily: Fonts.plusExtraBold, fontSize: 18, marginBottom: 12 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, color: 'white', marginBottom: 10, fontFamily: Fonts.plus },
  btn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  btnText: { color: 'white', fontFamily: Fonts.plusBold },
});
