import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Linking, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { fetchWishlist, previewWishlistUrl, postWishlistItem, checkWishlistItem } from '@/src/api/budgetClient';
import { useToast } from '@/src/context/ToastContext';
import { formatINR } from '@/src/lib/formatINR';

export default function WishlistScreen() {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [dailyLimit, setDailyLimit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await fetchWishlist();
      setItems(data.items || []);
      setDailyLimit(data.dailyLimit || 0);
    } catch {
      toast({ message: 'Failed to load', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}><ActivityIndicator color={Colors.primary} /></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><MaterialIcons name="chevron-left" size={32} color="white" /></TouchableOpacity>
        <Text style={styles.title}>Wishlist</Text>
        <TouchableOpacity onPress={() => setAddOpen(true)}><MaterialIcons name="add" size={28} color="white" /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {items.map((item) => (
          <View key={item._id} style={styles.card}>
            <Text style={styles.platform}>{item.platform}</Text>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={[styles.price, item.atTarget && { color: Colors.secondary }]}>
              {item.currentPrice != null ? `₹${formatINR(item.currentPrice)}` : '—'}
            </Text>
            <Text style={styles.target}>Target ₹{formatINR(item.targetPrice)}</Text>
            {item.dropPercent > 0 && <Text style={styles.drop}>↓ {item.dropPercent}%</Text>}
            {item.affordable && <Text style={styles.ok}>Affordable today</Text>}
            {!item.inStock && <Text style={styles.warn}>Out of stock</Text>}
            <View style={styles.row}>
              <TouchableOpacity style={styles.buy} onPress={() => Linking.openURL(item.productUrl)}><Text style={styles.buyText}>Buy Now</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => checkWishlistItem(item._id).then(load)}><MaterialIcons name="refresh" size={20} color={Colors.primary} /></TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
      <Modal visible={addOpen} animationType="slide" transparent>
        <View style={styles.overlay}><View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Add item</Text>
          <TextInput style={styles.input} placeholder="Product URL" placeholderTextColor={Colors.onSurfaceVariant} value={url} onChangeText={setUrl} autoCapitalize="none" />
          <TouchableOpacity style={styles.btnSec} onPress={async () => {
            try {
              const p = await previewWishlistUrl(url);
              setName(p.name || ''); setCurrent(p.currentPrice != null ? String(p.currentPrice) : '');
            } catch { toast({ message: 'Preview failed — enter manually', type: 'warning' }); }
          }}><Text style={styles.btnText}>Preview</Text></TouchableOpacity>
          <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} placeholderTextColor={Colors.onSurfaceVariant} />
          <TextInput style={styles.input} placeholder="Current price" keyboardType="numeric" value={current} onChangeText={setCurrent} placeholderTextColor={Colors.onSurfaceVariant} />
          <TextInput style={styles.input} placeholder="Target price" keyboardType="numeric" value={target} onChangeText={setTarget} placeholderTextColor={Colors.onSurfaceVariant} />
          {current && dailyLimit > 0 && (
            <Text style={{ color: Colors.onSurfaceVariant, fontFamily: Fonts.plus, marginBottom: 8 }}>
              {(Number(current) / dailyLimit).toFixed(1)} days of daily limit
            </Text>
          )}
          <TouchableOpacity style={styles.btn} onPress={async () => {
            await postWishlistItem({ productUrl: url, name, targetPrice: Number(target), currentPrice: current ? Number(current) : undefined });
            toast({ message: 'Added', type: 'success' }); setAddOpen(false); load();
          }}><Text style={styles.btnText}>Add to Wishlist</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12 },
  title: { flex: 1, fontSize: 22, fontFamily: Fonts.plusExtraBold, color: 'white' },
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  platform: { fontSize: 10, color: Colors.primary, fontFamily: Fonts.plusBold },
  name: { color: 'white', fontFamily: Fonts.plusBold, marginTop: 4 },
  price: { fontSize: 20, fontFamily: Fonts.spaceBold, color: 'white', marginTop: 4 },
  target: { color: Colors.onSurfaceVariant, fontSize: 12, fontFamily: Fonts.plus },
  drop: { color: Colors.secondary, fontSize: 11, fontFamily: Fonts.plus },
  ok: { color: Colors.secondary, fontSize: 10, fontFamily: Fonts.plusBold, marginTop: 4 },
  warn: { color: '#fbbf24', fontSize: 10, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  buy: { flex: 1, backgroundColor: `${Colors.primary}40`, padding: 10, borderRadius: 10, alignItems: 'center' },
  buyText: { color: Colors.primary, fontFamily: Fonts.plusBold },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  sheetTitle: { color: 'white', fontFamily: Fonts.plusExtraBold, fontSize: 18, marginBottom: 12 },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, color: 'white', marginBottom: 10, fontFamily: Fonts.plus },
  btn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 14, alignItems: 'center' },
  btnSec: { backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 12, alignItems: 'center', marginBottom: 8 },
  btnText: { color: 'white', fontFamily: Fonts.plusBold },
});
