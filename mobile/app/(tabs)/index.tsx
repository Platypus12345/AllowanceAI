import { useCallback, useEffect, useState } from 'react';
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
import { useSMS } from '@/src/context/SMSContext';
import { formatINR } from '@/src/lib/formatINR';
import {
  fetchBudgetStats,
  fetchExpenses,
  type ExpenseRow,
  type BudgetStats,
} from '@/src/api/budgetClient';
import TopAppBar from '@/components/TopAppBar';
import { Colors, Fonts } from '@/constants/theme';
import { fetchGamificationStats, fetchMe } from '@/src/api/budgetClient';
import { StatCardSkeleton, ExpenseItemSkeleton } from '@/src/components/ui/Skeleton';
import { useRouter } from 'expo-router';

export default function DashboardScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<BudgetStats | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('User');
  const [level, setLevel] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const tabBarHeight = useBottomTabBarHeight();

  const fetchData = useCallback(async () => {
    try {
      const [s, e, me, gami] = await Promise.all([
        fetchBudgetStats(),
        fetchExpenses(),
        fetchMe().catch(() => null),
        fetchGamificationStats().catch(() => ({ level: 1 })),
      ]);
      setStats(s);
      setExpenses(e);
      if (me?.name) setUserName(me.name);
      setLevel(gami?.level ?? 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView edges={['left', 'right']} style={{ flex: 1 }}>
        <TopAppBar userName={userName} level={level} />
        <ScrollView contentContainerStyle={{ paddingTop: 80, paddingBottom: tabBarHeight + 100, paddingHorizontal: 20 }}>
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <ExpenseItemSkeleton />
          <ExpenseItemSkeleton />
          <ExpenseItemSkeleton />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1 }}>
      <TopAppBar userName={userName} level={level} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 80, paddingBottom: tabBarHeight + 100, paddingHorizontal: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        <TouchableOpacity
          onPress={() => router.push('/wrapped')}
          style={{
            marginBottom: 16,
            padding: 16,
            borderRadius: 16,
            backgroundColor: 'rgba(128, 131, 255, 0.15)',
            borderWidth: 1,
            borderColor: 'rgba(128, 131, 255, 0.3)',
          }}
        >
          <Text style={{ fontFamily: Fonts.plusBold, color: Colors.onSurface }}>View Monthly Wrapped 🎁</Text>
        </TouchableOpacity>

        {/* Greeting Section */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 32, fontFamily: Fonts.plusExtraBold, color: Colors.onSurface }}>
            Hi, {userName.split(' ')[0]} 👋
          </Text>
          <Text style={{ fontSize: 16, fontFamily: Fonts.plus, color: Colors.onSurfaceVariant, marginTop: 4 }}>
            You've spent <Text style={{ fontFamily: Fonts.spaceBold, color: Colors.error }}>₹{formatINR(stats?.spentAmount || 0)}</Text> today.
          </Text>
        </View>

        {/* Survival Status Hero Card */}
        <View style={styles.heroCard}>
          <BlurView intensity={30} tint="dark" style={styles.heroBlur}>
            <View style={{ flex: 1, padding: 20 }}>
              <View style={[
                styles.statusBadge,
                stats?.survival?.status === 'danger' && { backgroundColor: 'rgba(255, 180, 171, 0.15)' },
                stats?.survival?.status === 'tight' && { backgroundColor: 'rgba(255, 182, 144, 0.15)' },
              ]}>
                <MaterialIcons
                  name={
                    stats?.survival?.status === 'danger'
                      ? 'error'
                      : stats?.survival?.status === 'tight'
                        ? 'warning'
                        : 'check-circle'
                  }
                  size={14}
                  color={
                    stats?.survival?.status === 'danger'
                      ? Colors.error
                      : stats?.survival?.status === 'tight'
                        ? Colors.tertiary
                        : Colors.secondary
                  }
                />
                <Text style={[
                  styles.statusBadgeText,
                  stats?.survival?.status === 'danger' && { color: Colors.error },
                  stats?.survival?.status === 'tight' && { color: Colors.tertiary },
                ]}>
                  {stats?.survival?.badgeLabel || 'SAFE'}
                </Text>
              </View>
              <Text style={styles.heroTitle}>
                {stats?.survival?.message || 'Loading survival status...'}
              </Text>
              <Text style={styles.heroDesc}>
                {stats?.survival?.leftoverMessage ||
                  `₹${formatINR(stats?.remainingBalance || 0)} remaining this month.`}
              </Text>
            </View>
            <View style={styles.heroGraphContainer}>
               <View style={[
                 styles.radialProgress,
                 {
                   borderTopColor:
                     stats?.survival?.ringColor ||
                     (stats?.survival?.status === 'danger'
                       ? Colors.error
                       : stats?.survival?.status === 'tight'
                         ? Colors.tertiary
                         : Colors.secondary),
                 },
               ]}>
                 <Text style={styles.radialText}>{stats?.survival?.safetyScore ?? 0}%</Text>
                 <Text style={styles.radialSubtext}>Safety</Text>
               </View>
            </View>
          </BlurView>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Total Allowance', value: stats?.totalAllowance || 0, color: Colors.primary },
            { label: 'Spent Amount', value: stats?.spentAmount || 0, color: Colors.error },
            { label: 'Remaining', value: stats?.remainingBalance || 0, color: Colors.secondary },
            { label: 'Daily Limit', value: Math.max(0, stats?.dailyLimit || 0), color: Colors.onSurface },
          ].map((item, idx) => (
            <View key={idx} style={styles.statItem}>
              <BlurView intensity={20} tint="dark" style={styles.statBlur}>
                <Text style={styles.statLabel}>{item.label}</Text>
                <Text style={[styles.statValue, { color: item.color }]}>₹{formatINR(item.value)}</Text>
              </BlurView>
            </View>
          ))}
        </View>

        {/* Daily Challenge Card */}
        <View style={styles.challengeCard}>
          <View style={styles.challengeContent}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.challengeLabel}>Daily Challenge</Text>
                <View style={styles.challengeIcon}>
                  <MaterialIcons name="bolt" size={16} color={Colors.tertiary} />
                </View>
              </View>
              <Text style={styles.challengeText}>
                Don't spend on <Text style={{ color: Colors.tertiary, fontWeight: 'bold' }}>Snacks</Text> today and earn <Text style={{ color: Colors.secondary, fontWeight: 'bold' }}>50 Exp</Text>!
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: '33%' }]} />
              </View>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={{ marginTop: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontFamily: Fonts.plusExtraBold, color: Colors.onSurface }}>Recent Activity</Text>
            <TouchableOpacity><Text style={{ color: Colors.primary, fontSize: 14, fontWeight: '600' }}>View all</Text></TouchableOpacity>
          </View>
          <View style={styles.activityContainer}>
            <BlurView intensity={20} tint="dark" style={styles.activityBlur}>
              {expenses.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: Colors.onSurfaceVariant, fontFamily: Fonts.plus }}>No expenses yet</Text>
                </View>
              ) : (
                expenses.slice(0, 5).map((expense, idx) => (
                  <View key={expense._id} style={[styles.activityItem, idx === 0 && { borderTopWidth: 0 }]}>
                     <View style={styles.activityIcon}>
                       <MaterialIcons name="restaurant" size={24} color={Colors.secondary} />
                     </View>
                     <View style={{ flex: 1, marginLeft: 12 }}>
                       <Text style={styles.activityTitle}>{expense.description || expense.category}</Text>
                       <Text style={styles.activitySub}>{expense.category} • Today</Text>
                     </View>
                     <Text style={styles.activityAmount}>₹{formatINR(expense.amount)}</Text>
                  </View>
                ))
              )}
            </BlurView>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    height: 180,
    borderRadius: 40,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroBlur: {
    flex: 1,
    flexDirection: 'row',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(68, 226, 205, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusBadgeText: {
    color: Colors.secondary,
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    textTransform: 'uppercase',
    marginLeft: 4,
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: Fonts.plusExtraBold,
    color: Colors.onSurface,
    lineHeight: 24,
    marginBottom: 8,
  },
  heroDesc: {
    fontSize: 12,
    color: Colors.onSurfaceVariant,
    fontFamily: Fonts.plus,
  },
  heroGraphContainer: {
    width: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 10,
  },
  radialProgress: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 8,
    borderColor: 'rgba(255,255,255,0.05)',
    borderTopColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radialText: {
    fontSize: 18,
    fontFamily: Fonts.spaceBold,
    color: Colors.onSurface,
  },
  radialSubtext: {
    fontSize: 8,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  statItem: {
    width: '50%',
    padding: 8,
  },
  statBlur: {
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statLabel: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontFamily: Fonts.spaceBold,
  },
  challengeCard: {
    marginTop: 20,
    borderRadius: 32,
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: Colors.tertiary,
    backgroundColor: 'rgba(255,182,144,0.05)',
  },
  challengeContent: {
    padding: 20,
  },
  challengeLabel: {
    fontSize: 14,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurface,
  },
  challengeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,182,144,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  challengeText: {
    fontSize: 14,
    fontFamily: Fonts.plus,
    color: Colors.onSurface,
    marginBottom: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.tertiary,
    borderRadius: 3,
  },
  activityContainer: {
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activityBlur: {
    paddingVertical: 10,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(68, 226, 205, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: 15,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurface,
  },
  activitySub: {
    fontSize: 11,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  activityAmount: {
    fontSize: 16,
    fontFamily: Fonts.spaceBold,
    color: Colors.onSurface,
  },
});
