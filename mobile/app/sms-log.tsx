import { useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { useSMS } from '@/src/context/SMSContext';
import type { SmsLogEntry } from '@/src/types/sms';
import { formatINR } from '@/src/lib/formatINR';
import { Colors, Fonts } from '@/constants/theme';

function PulsingDot() {
  const op = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(op, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(op, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [op]);
  return <Animated.View style={[styles.pulsingDot, { opacity: op }]} />;
}

function TypeBadge({ type }: { type: SmsLogEntry['type'] }) {
  const config = {
    credit: { color: Colors.secondary, label: 'CREDIT' },
    refund: { color: Colors.tertiary, label: 'REFUND' },
    debit: { color: Colors.error, label: 'DEBIT' },
  }[type] || { color: Colors.onSurfaceVariant, label: type.toUpperCase() };

  return (
    <View style={[styles.badge, { backgroundColor: `${config.color}15`, borderColor: `${config.color}30` }]}>
      <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

export default function SmsLogScreen() {
  const router = useRouter();
  const { smsLog, openConfirmForSmsId, reloadFromStorage } = useSMS();

  useEffect(() => {
    reloadFromStorage();
  }, [reloadFromStorage]);

  const sorted = [...smsLog].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return b.date - a.date;
  });

  const onRowPress = (row: SmsLogEntry) => {
    if (row.status === 'pending') {
      openConfirmForSmsId(row.id);
      router.back();
      return;
    }
    if (row.status === 'added' && row.linkedExpenseId) {
      Alert.alert(
        'Linked expense',
        `This SMS was saved as expense id ${row.linkedExpenseId}.`,
        [{ text: 'OK' }]
      );
      return;
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" color="white" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SMS Tracking Log</Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoCard}>
           <MaterialIcons name="security" color={Colors.primary} size={24} />
           <Text style={styles.infoText}>AllowanceAI only reads bank SMS to track your expenses automatically. No personal data is ever shared.</Text>
        </View>

        {sorted.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="sms-failed" color="rgba(255,255,255,0.1)" size={64} />
            <Text style={styles.emptyText}>No bank SMS detected yet.</Text>
          </View>
        ) : (
          sorted.map((row) => (
            <TouchableOpacity key={row.id} activeOpacity={0.8} onPress={() => onRowPress(row)} style={styles.logCard}>
               <BlurView intensity={15} tint="dark" style={styles.cardBlur}>
                  <View style={styles.cardHeader}>
                     <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {row.status === 'pending' && <PulsingDot />}
                        <Text style={styles.amountText}>₹{formatINR(row.amount)}</Text>
                     </View>
                     <TypeBadge type={row.type} />
                  </View>
                  
                  <Text style={styles.merchantText} numberOfLines={1}>{row.merchant}</Text>
                  
                  <View style={styles.cardFooter}>
                     <Text style={styles.dateText}>{new Date(row.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</Text>
                     <View style={styles.statusPill}>
                        <Text style={[styles.statusText, { color: row.status === 'pending' ? Colors.tertiary : (row.status === 'added' ? Colors.secondary : Colors.onSurfaceVariant) }]}>
                          {row.status.toUpperCase()}
                        </Text>
                     </View>
                  </View>
               </BlurView>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.onSurface,
    fontSize: 20,
    fontFamily: Fonts.plusExtraBold,
    marginLeft: 8,
  },
  infoCard: {
    flexDirection: 'row',
    gap: 16,
    backgroundColor: 'rgba(128, 131, 255, 0.05)',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(128, 131, 255, 0.1)',
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    color: Colors.onSurfaceVariant,
    fontSize: 12,
    fontFamily: Fonts.plus,
    lineHeight: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 100,
    opacity: 0.5,
  },
  emptyText: {
    color: Colors.onSurfaceVariant,
    fontSize: 14,
    fontFamily: Fonts.plus,
    marginTop: 16,
  },
  logCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardBlur: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  amountText: {
    fontSize: 22,
    fontFamily: Fonts.spaceBold,
    color: Colors.onSurface,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.tertiary,
    marginRight: 10,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    letterSpacing: 1,
  },
  merchantText: {
    fontSize: 15,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  dateText: {
    fontSize: 11,
    fontFamily: Fonts.plus,
    color: Colors.outline,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    letterSpacing: 1,
  },
});
