import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, useWindowDimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import { fetchAnalytics } from '@/src/api/budgetClient';
import { formatINR } from '@/src/lib/formatINR';
import { Colors, Fonts } from '@/constants/theme';

export default function AnalyticsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetchAnalytics();
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  const chartData = {
    labels: data.map(d => d.month.substring(0, 3)),
    datasets: [
      {
        data: data.map(d => d.total),
      },
    ],
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" color="white" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Advanced Analytics</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ padding: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {/* Chart Card */}
          <View style={styles.chartCard}>
            <BlurView intensity={20} tint="dark" style={styles.cardBlur}>
              <Text style={styles.chartTitle}>Monthly Spending Trends</Text>
              <BarChart
                data={chartData}
                width={width - 80}
                height={220}
                yAxisLabel="₹"
                yAxisSuffix=""
                chartConfig={{
                  backgroundColor: 'transparent',
                  backgroundGradientFrom: 'transparent',
                  backgroundGradientTo: 'transparent',
                  decimalPlaces: 0,
                  color: (opacity = 1) => Colors.primary,
                  labelColor: (opacity = 1) => Colors.onSurfaceVariant,
                  barPercentage: 0.6,
                  propsForBackgroundLines: {
                    stroke: 'rgba(255,255,255,0.05)',
                  },
                }}
                verticalLabelRotation={0}
                style={{
                  marginVertical: 16,
                  borderRadius: 16,
                }}
                fromZero
              />
            </BlurView>
          </View>

          <Text style={styles.sectionTitle}>Monthly Breakdown</Text>
          {data.map((item, idx) => (
            <View key={idx} style={styles.breakdownCard}>
              <BlurView intensity={10} tint="dark" style={styles.breakdownBlur}>
                <View style={[styles.monthIcon, { backgroundColor: `${Colors.primary}20` }]}>
                  <MaterialIcons name="event-note" color={Colors.primary} size={20} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.monthLabel}>{item.month} {item.year}</Text>
                  <Text style={styles.monthSub}>Total Expenses</Text>
                </View>
                <Text style={styles.monthTotal}>₹{formatINR(item.total)}</Text>
              </BlurView>
            </View>
          ))}
        </ScrollView>
      )}
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
  chartCard: {
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardBlur: {
    padding: 20,
    alignItems: 'center',
  },
  chartTitle: {
    alignSelf: 'flex-start',
    fontSize: 15,
    fontFamily: Fonts.plusExtraBold,
    color: Colors.onSurface,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  breakdownCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  breakdownBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  monthIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 15,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurface,
  },
  monthSub: {
    fontSize: 11,
    fontFamily: Fonts.plus,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  monthTotal: {
    fontSize: 18,
    fontFamily: Fonts.spaceBold,
    color: Colors.onSurface,
  },
});
