import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { formatINR } from '@/src/lib/formatINR';
import {
  fetchExpenses,
  type ExpenseRow,
  type ExpenseCategory,
} from '@/src/api/budgetClient';
import { Colors, Fonts } from '@/constants/theme';
import TopAppBar from '@/components/TopAppBar';

const CATEGORIES: (ExpenseCategory | 'All')[] = [
  'All',
  'Food',
  'Transport',
  'Shopping',
  'Entertainment',
  'Health',
  'Other',
];

const CATEGORY_ICONS: Record<string, string> = {
  Food: 'restaurant',
  Transport: 'directions-bus',
  Shopping: 'shopping-bag',
  Entertainment: 'movie',
  Health: 'medical-services',
  Other: 'more-horiz',
};

const CATEGORY_COLORS: Record<string, string> = {
  Food: Colors.secondary,
  Transport: Colors.primary,
  Shopping: Colors.primaryContainer,
  Entertainment: Colors.tertiary,
  Health: Colors.secondaryContainer,
  Other: Colors.tertiaryContainer,
};

export default function ExpensesScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const [selected, setSelected] = useState<(typeof CATEGORIES)[number]>('All');
  const [items, setItems] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const ex = await fetchExpenses();
      setItems(ex);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load();
  };

  const filtered = useMemo(() => {
    if (selected === 'All') return items;
    return items.filter((e) => e.category === selected);
  }, [items, selected]);

  if (loading && !refreshing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1 }}>
      <TopAppBar />
      <View style={{ flex: 1, paddingTop: 80 }}>
        {/* Header & Filter Section */}
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 24, fontFamily: Fonts.plusExtraBold, color: Colors.onSurface }}>Spend</Text>
            <TouchableOpacity 
              onPress={() => router.push('/add-expense')}
              style={styles.addButton}
            >
              <MaterialIcons name="add" size={20} color={Colors.onPrimaryContainer} />
              <Text style={styles.addButtonText}>Add New</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {CATEGORIES.map((cat) => {
              const active = cat === selected;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelected(cat)}
                  style={[
                    styles.filterChip,
                    active && styles.filterChipActive
                  ]}
                >
                  <Text style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive
                  ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 100, paddingHorizontal: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {filtered.length === 0 ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Text style={{ color: Colors.onSurfaceVariant, fontFamily: Fonts.plus }}>No expenses found</Text>
            </View>
          ) : (
            filtered.map((item) => {
              const color = CATEGORY_COLORS[item.category] || Colors.outline;
              const icon = CATEGORY_ICONS[item.category] || 'more-horiz';
              return (
                <View key={item._id} style={styles.transactionCard}>
                  <BlurView intensity={20} tint="dark" style={styles.cardBlur}>
                    <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
                      <MaterialIcons name={icon as any} size={24} color={color} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.transactionTitle}>{item.description || item.category}</Text>
                      <Text style={styles.transactionSub}>{item.category} • {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>
                    </View>
                    <Text style={styles.transactionAmount}>₹{formatINR(item.amount)}</Text>
                  </BlurView>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryContainer,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  addButtonText: {
    color: Colors.onPrimaryContainer,
    fontFamily: Fonts.plusBold,
    fontSize: 14,
  },
  filterChip: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(128, 131, 255, 0.2)',
    borderColor: Colors.primary,
  },
  filterChipText: {
    color: Colors.onSurfaceVariant,
    fontFamily: Fonts.plusBold,
    fontSize: 14,
  },
  filterChipTextActive: {
    color: Colors.primary,
  },
  transactionCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionTitle: {
    fontSize: 15,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurface,
  },
  transactionSub: {
    fontSize: 11,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontFamily: Fonts.spaceBold,
    color: Colors.onSurface,
  },
});
