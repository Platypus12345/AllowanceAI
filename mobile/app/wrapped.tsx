import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { api } from '@/src/api/http';
import { Colors, Fonts } from '@/constants/theme';
import { ChartSkeleton } from '@/src/components/ui/Skeleton';
import { formatINR } from '@/src/lib/formatINR';

const { width: SCREEN_W } = Dimensions.get('window');

type WrappedData = {
  monthName: string;
  year: number;
  totalSpent: number;
  totalAllowance: number;
  savedAmount: number;
  savingsPercent: number;
  grade: string;
  topCategory: { name: string; amount: number; percent: number; comment?: string };
  biggestSplurge?: { description: string; amount: number; category: string; date: string };
  bestWeek: { weekNumber: number; amount: number };
  worstWeek: { weekNumber: number; amount: number };
  streakAchieved: number;
  badgesEarned: string[];
  aiNarrative: string;
};

export default function WrappedScreen() {
  const router = useRouter();
  const [data, setData] = useState<WrappedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const now = new Date();
  const month = now.getMonth() === 0 ? 12 : now.getMonth();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  useEffect(() => {
    api
      .get('/api/analytics/wrapped', { params: { month, year } })
      .then((res) => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [month, year]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    setIndex(i);
  };

  const renderCard = useCallback(
    ({ item }: { item: number }) => {
      if (!data) return null;
      switch (item) {
        case 0:
          return (
            <View style={styles.card}>
              <Text style={styles.year}>{data.year}</Text>
              <Text style={styles.title}>{data.monthName} Wrapped</Text>
              <Text style={styles.sub}>Your financial story</Text>
            </View>
          );
        case 1:
          return (
            <View style={styles.card}>
              <Text style={styles.label}>You spent</Text>
              <Text style={styles.huge}>₹{formatINR(data.totalSpent)}</Text>
              <Text style={styles.sub}>of ₹{formatINR(data.totalAllowance)} allowance</Text>
              <Text style={[styles.sub, { color: Colors.secondary, marginTop: 16 }]}>
                Saved ₹{formatINR(data.savedAmount)} ({data.savingsPercent}%)
              </Text>
              <Text style={styles.grade}>{data.grade}</Text>
            </View>
          );
        case 2:
          return (
            <View style={styles.card}>
              <Text style={styles.label}>Biggest weakness</Text>
              <Text style={styles.title}>{data.topCategory.name}</Text>
              <Text style={styles.huge}>₹{formatINR(data.topCategory.amount)}</Text>
              <Text style={styles.sub}>{data.topCategory.percent}% of spending</Text>
              {data.topCategory.comment && <Text style={styles.comment}>{data.topCategory.comment}</Text>}
            </View>
          );
        case 3:
          return (
            <View style={styles.card}>
              {data.biggestSplurge ? (
                <>
                  <Text style={styles.label}>Biggest splurge</Text>
                  <Text style={styles.title}>{data.biggestSplurge.description}</Text>
                  <Text style={styles.huge}>₹{formatINR(data.biggestSplurge.amount)}</Text>
                </>
              ) : (
                <Text style={styles.sub}>No splurges — legend.</Text>
              )}
            </View>
          );
        case 4:
          return (
            <View style={styles.rowCard}>
              <BlurView intensity={30} tint="dark" style={[styles.weekBox, { borderLeftColor: Colors.secondary }]}>
                <Text style={styles.label}>Best week</Text>
                <Text style={styles.title}>Week {data.bestWeek.weekNumber}</Text>
                <Text style={styles.sub}>₹{formatINR(data.bestWeek.amount)}</Text>
              </BlurView>
              <BlurView intensity={30} tint="dark" style={[styles.weekBox, { borderLeftColor: Colors.error }]}>
                <Text style={styles.label}>Worst week</Text>
                <Text style={styles.title}>Week {data.worstWeek.weekNumber}</Text>
                <Text style={styles.sub}>₹{formatINR(data.worstWeek.amount)}</Text>
              </BlurView>
            </View>
          );
        case 5:
          return (
            <View style={styles.card}>
              <Text style={styles.label}>Achievements</Text>
              <Text style={styles.sub}>Streak: {data.streakAchieved} days</Text>
              <View style={styles.badges}>
                {(data.badgesEarned?.length ? data.badgesEarned : ['Budget Rookie']).map((b) => (
                  <Text key={b} style={styles.badge}>
                    🏆 {b}
                  </Text>
                ))}
              </View>
            </View>
          );
        default:
          return (
            <View style={styles.card}>
              <Text style={styles.label}>AI Verdict</Text>
              <Text style={styles.narrative}>{data.aiNarrative}</Text>
              <TouchableOpacity style={styles.btn} onPress={() => router.push('/report')}>
                <Text style={styles.btnText}>See full report</Text>
              </TouchableOpacity>
            </View>
          );
      }
    },
    [data, router]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ChartSkeleton />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.sub}>Could not load wrapped.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Text style={styles.sub}>← Back</Text>
      </TouchableOpacity>
      <View style={styles.dots}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <View key={i} style={[styles.dot, index === i && styles.dotActive]} />
        ))}
      </View>
      <FlatList
        ref={listRef}
        data={[0, 1, 2, 3, 4, 5, 6]}
        renderItem={renderCard}
        keyExtractor={(i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  back: { padding: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: 8 },
  dot: { width: 8, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive: { width: 24, backgroundColor: Colors.primaryContainer },
  card: {
    width: SCREEN_W,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  rowCard: {
    width: SCREEN_W,
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    alignItems: 'center',
  },
  weekBox: {
    flex: 1,
    padding: 20,
    borderRadius: 24,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  year: { fontSize: 56, fontFamily: Fonts.spaceBold, color: Colors.primaryContainer },
  title: { fontSize: 28, fontFamily: Fonts.plusExtraBold, color: Colors.onSurface, marginTop: 8, textAlign: 'center' },
  huge: { fontSize: 40, fontFamily: Fonts.spaceBold, color: Colors.error, marginTop: 12 },
  label: { fontSize: 12, fontFamily: Fonts.plusBold, color: Colors.onSurfaceVariant, textTransform: 'uppercase' },
  sub: { fontSize: 14, fontFamily: Fonts.plus, color: Colors.onSurfaceVariant, marginTop: 8, textAlign: 'center' },
  comment: { fontSize: 14, color: Colors.secondary, marginTop: 16, fontStyle: 'italic' },
  grade: { fontSize: 48, fontFamily: Fonts.spaceBold, color: Colors.secondary, marginTop: 24 },
  narrative: { fontSize: 16, fontFamily: Fonts.plus, color: Colors.onSurface, textAlign: 'center', lineHeight: 24 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, justifyContent: 'center' },
  badge: { color: Colors.onSurface, fontFamily: Fonts.plusBold, padding: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12 },
  btn: { marginTop: 24, backgroundColor: Colors.primaryContainer, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 16 },
  btnText: { color: '#fff', fontFamily: Fonts.plusBold },
});
