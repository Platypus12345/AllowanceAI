import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { fetchPrediction, fetchBudgetStats, postAiPredict } from '@/src/api/budgetClient';
import { Colors, Fonts } from '@/constants/theme';
import { formatINR } from '@/src/lib/formatINR';

const { width: SCREEN_W } = Dimensions.get('window');

export default function PredictionScreen() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [aiData, setAiData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [stats, pred] = await Promise.all([
          fetchBudgetStats(),
          fetchPrediction()
        ]);
        
        setData({ stats, pred });

        const ai = await postAiPredict({
          allowance: stats.totalAllowance,
          spent: stats.spentAmount,
          remaining: stats.remainingBalance,
          dailyAverage: pred.dailyAverage,
          daysLeft: pred.daysLeft,
          topCategories: stats.chartData.map(c => c.name)
        });
        setAiData(ai);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading || !data) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const { stats, pred } = data;
  const statusColor = pred.willRunOut ? Colors.error : Colors.secondary;
  
  const currentDay = new Date().getDate();
  const daysInMonth = currentDay + pred.daysLeft - 1;

  const actualData = [0];
  const projectedData = [0];

  for (let i = 1; i <= daysInMonth; i += 7) {
    if (i <= currentDay) {
      actualData.push((stats.spentAmount / currentDay) * i);
      projectedData.push((stats.spentAmount / currentDay) * i);
    } else {
      projectedData.push(stats.spentAmount + (pred.dailyAverage * (i - currentDay)));
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" color="white" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Spend Prediction</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        
        {/* Status Hero */}
        <View style={styles.heroCard}>
          <BlurView intensity={20} tint="dark" style={[styles.heroBlur, { borderColor: `${statusColor}30` }]}>
            <View style={[styles.statusIcon, { backgroundColor: `${statusColor}20` }]}>
              <MaterialIcons name={pred.willRunOut ? "warning" : "verified"} color={statusColor} size={32} />
            </View>
            <Text style={styles.heroTitle}>{pred.willRunOut ? 'Budget Warning!' : 'You are on track!'}</Text>
            <Text style={styles.heroSubtitle}>
              {pred.willRunOut 
                ? `You'll run out by ${new Date(pred.projectedRunoutDate).toLocaleDateString()}`
                : 'Spending pattern is healthy'
              }
            </Text>
          </BlurView>
        </View>

        {/* Chart Card */}
        <View style={styles.chartCard}>
          <BlurView intensity={20} tint="dark" style={styles.cardBlur}>
            <View style={styles.cardHeader}>
               <Text style={styles.cardTitle}>Spending Projection</Text>
               <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary }} />
                    <Text style={styles.legendText}>Actual</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.tertiary }} />
                    <Text style={styles.legendText}>Projected</Text>
                  </View>
               </View>
            </View>

            <LineChart
              data={{
                labels: ['W1', 'W2', 'W3', 'W4'],
                datasets: [
                  {
                    data: actualData.slice(0, 4),
                    color: (opacity = 1) => Colors.primary,
                    strokeWidth: 3
                  },
                  {
                    data: projectedData.slice(0, 4),
                    color: (opacity = 1) => Colors.tertiary,
                    strokeWidth: 3,
                    withDots: false
                  }
                ]
              }}
              width={SCREEN_W - 80}
              height={200}
              chartConfig={{
                backgroundColor: 'transparent',
                backgroundGradientFromOpacity: 0,
                backgroundGradientToOpacity: 0,
                color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                decimalPlaces: 0,
                propsForDots: { r: '4', strokeWidth: '0' },
                propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.05)' }
              }}
              bezier
              style={{ marginVertical: 8, borderRadius: 16 }}
            />
          </BlurView>
        </View>

        {/* AI Insights */}
        {aiData && (
          <View style={styles.aiCard}>
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <MaterialIcons name="insights" color={Colors.tertiary} size={20} />
                <Text style={styles.aiTitle}>AI Insights</Text>
             </View>
             <Text style={styles.aiText}>{aiData.prediction}</Text>
             
             <Text style={styles.tipsLabel}>Actionable Tips</Text>
             {aiData.tips?.slice(0, 3).map((tip: string, i: number) => (
                <View key={i} style={styles.tipItem}>
                  <MaterialIcons name="bolt" color={Colors.tertiary} size={14} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
             ))}
          </View>
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
  heroCard: {
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 20,
  },
  heroBlur: {
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontFamily: Fonts.plusExtraBold,
    color: Colors.onSurface,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.plus,
    color: Colors.onSurfaceVariant,
  },
  chartCard: {
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 20,
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
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: Fonts.plusExtraBold,
    color: Colors.onSurface,
  },
  legendText: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  aiCard: {
    backgroundColor: 'rgba(255,182,144,0.05)',
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,182,144,0.1)',
  },
  aiTitle: {
    fontSize: 18,
    fontFamily: Fonts.plusExtraBold,
    color: Colors.onSurface,
  },
  aiText: {
    fontSize: 14,
    fontFamily: Fonts.plus,
    color: Colors.onSurfaceVariant,
    lineHeight: 20,
    marginBottom: 24,
  },
  tipsLabel: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  tipItem: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurface,
    lineHeight: 18,
  },
});
