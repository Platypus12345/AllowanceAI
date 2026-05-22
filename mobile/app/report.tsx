import { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BarChart } from 'react-native-chart-kit';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { fetchReport } from '@/src/api/budgetClient';
import { formatINR } from '@/src/lib/formatINR';
import { Colors, Fonts } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

const getGradeConfig = (grade: string) => {
  switch (grade) {
    case 'A': return { color: Colors.secondary, glow: 'rgba(68, 226, 205, 0.3)', label: 'EXCELLENT' };
    case 'B': return { color: Colors.primary, glow: 'rgba(128, 131, 255, 0.3)', label: 'GOOD' };
    case 'C': return { color: Colors.tertiary, glow: 'rgba(255, 182, 144, 0.3)', label: 'AVERAGE' };
    case 'D': return { color: Colors.error, glow: 'rgba(255, 128, 128, 0.3)', label: 'POOR' };
    case 'F': return { color: Colors.error, glow: 'rgba(255, 128, 128, 0.3)', label: 'FAILED' };
    default: return { color: Colors.outline, glow: 'transparent', label: 'N/A' };
  }
};

export default function ReportCardScreen() {
  const router = useRouter();
  const viewShotRef = useRef<any>(null);
  
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchReport();
        setReport(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const shareReport = async () => {
    if (!viewShotRef.current) return;
    try {
      const uri = await viewShotRef.current.capture();
      await Sharing.shareAsync(uri, { UTI: 'public.png', mimeType: 'image/png' });
    } catch (e) {
      console.error('Failed to share', e);
    }
  };

  if (loading || !report) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const gradeConfig = getGradeConfig(report.grade);
  const isBetter = report.previousMonthComparison.difference <= 0;

  const labels = Object.keys(report.categoryBreakdown).map(l => l.substring(0, 3));
  const dataset = Object.values(report.categoryBreakdown) as number[];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" color="white" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Monthly Report</Text>
        <TouchableOpacity onPress={shareReport} style={styles.shareButton}>
          <MaterialIcons name="share" color={Colors.primary} size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }} style={{ backgroundColor: Colors.background }}>
          <View style={styles.reportContainer}>
            {/* Header */}
            <View style={styles.reportHeader}>
               <View>
                  <Text style={styles.monthText}>
                    {new Date(report.year, report.month - 1).toLocaleString('default', { month: 'long' })}
                  </Text>
                  <Text style={styles.yearText}>{report.year}</Text>
               </View>
               <View style={[styles.gradeContainer, { borderColor: gradeConfig.color, shadowColor: gradeConfig.glow }]}>
                  <Text style={[styles.gradeText, { color: gradeConfig.color }]}>{report.grade}</Text>
                  <View style={[styles.gradeBadge, { backgroundColor: gradeConfig.color }]}>
                    <Text style={styles.gradeBadgeText}>{gradeConfig.label}</Text>
                  </View>
               </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
               <View style={[styles.statCard, { flex: 1.2 }]}>
                  <BlurView intensity={10} tint="dark" style={styles.statBlur}>
                    <Text style={styles.statLabel}>Total Spent</Text>
                    <Text style={styles.statValue}>₹{formatINR(report.totalSpent)}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <MaterialIcons name={isBetter ? "trending-down" : "trending-up"} color={isBetter ? Colors.secondary : Colors.error} size={14} />
                      <Text style={[styles.statDiff, { color: isBetter ? Colors.secondary : Colors.error }]}>
                        {formatINR(Math.abs(report.previousMonthComparison.difference))} vs last
                      </Text>
                    </View>
                  </BlurView>
               </View>
               <View style={[styles.statCard, { flex: 1 }]}>
                  <BlurView intensity={10} tint="dark" style={styles.statBlur}>
                    <Text style={styles.statLabel}>Saved</Text>
                    <Text style={[styles.statValue, { color: Colors.secondary }]}>₹{formatINR(report.savingsAmount)}</Text>
                    <Text style={styles.statSubText}>{report.savingsPercent.toFixed(1)}%</Text>
                  </BlurView>
               </View>
            </View>

            {/* Category Chart */}
            <View style={styles.chartCard}>
              <BlurView intensity={10} tint="dark" style={styles.cardBlur}>
                <Text style={styles.chartTitle}>Category Spending</Text>
                {dataset.reduce((a,b) => a+b, 0) > 0 ? (
                  <BarChart
                    data={{
                      labels,
                      datasets: [{ data: dataset }]
                    }}
                    width={SCREEN_W - 80}
                    height={200}
                    yAxisLabel="₹"
                    yAxisSuffix=""
                    chartConfig={{
                      backgroundColor: 'transparent',
                      backgroundGradientFromOpacity: 0,
                      backgroundGradientToOpacity: 0,
                      color: (opacity = 1) => Colors.primary,
                      labelColor: (opacity = 1) => Colors.onSurfaceVariant,
                      barPercentage: 0.5,
                      decimalPlaces: 0,
                      propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.05)' }
                    }}
                    style={{ borderRadius: 16, marginTop: 12 }}
                  />
                ) : (
                  <Text style={styles.noDataText}>No expenses this month</Text>
                )}
              </BlurView>
            </View>

            {/* Highlights */}
            <View style={styles.highlightsContainer}>
               <Text style={styles.sectionLabel}>Financial Highlights</Text>
               
               {report.bestCategory && (
                  <View style={[styles.highlightItem, { borderColor: `${Colors.secondary}30` }]}>
                    <View style={[styles.highlightIcon, { backgroundColor: `${Colors.secondary}15` }]}>
                      <MaterialIcons name="workspace-premium" color={Colors.secondary} size={20} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.highlightTitle, { color: Colors.secondary }]}>Lowest Spend</Text>
                      <Text style={styles.highlightCategory}>{report.bestCategory}</Text>
                    </View>
                    <Text style={styles.highlightAmount}>₹{formatINR(report.categoryBreakdown[report.bestCategory])}</Text>
                  </View>
               )}

               {report.biggestExpense && (
                  <View style={[styles.highlightItem, { borderColor: 'rgba(255,255,255,0.1)' }]}>
                    <View style={[styles.highlightIcon, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                      <MaterialIcons name="shopping-bag" color={Colors.onSurface} size={20} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.highlightTitle}>Biggest Purchase</Text>
                      <Text style={styles.highlightCategory} numberOfLines={1}>{report.biggestExpense.description || report.biggestExpense.category}</Text>
                    </View>
                    <Text style={[styles.highlightAmount, { color: Colors.error }]}>₹{formatINR(report.biggestExpense.amount)}</Text>
                  </View>
               )}
            </View>
          </View>
        </ViewShot>

        <TouchableOpacity style={styles.downloadButton} onPress={shareReport}>
          <MaterialIcons name="ios-share" color="white" size={20} />
          <Text style={styles.downloadText}>Share Report Card</Text>
        </TouchableOpacity>
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
    flex: 1,
    color: Colors.onSurface,
    fontSize: 20,
    fontFamily: Fonts.plusExtraBold,
    marginLeft: 8,
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${Colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${Colors.primary}30`,
  },
  reportContainer: {
    borderRadius: 40,
    backgroundColor: '#0A0A0A',
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  monthText: {
    fontSize: 28,
    fontFamily: Fonts.plusExtraBold,
    color: Colors.onSurface,
  },
  yearText: {
    fontSize: 18,
    fontFamily: Fonts.spaceBold,
    color: Colors.onSurfaceVariant,
    letterSpacing: 2,
  },
  gradeContainer: {
    width: 100,
    height: 100,
    borderRadius: 32,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121212',
    elevation: 10,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  gradeText: {
    fontSize: 48,
    fontFamily: Fonts.plusExtraBold,
  },
  gradeBadge: {
    position: 'absolute',
    bottom: -10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  gradeBadgeText: {
    color: 'white',
    fontSize: 8,
    fontFamily: Fonts.plusBold,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statBlur: {
    padding: 16,
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
    color: Colors.onSurface,
  },
  statDiff: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    marginLeft: 4,
  },
  statSubText: {
    fontSize: 10,
    fontFamily: Fonts.plus,
    color: Colors.onSurfaceVariant,
    marginTop: 4,
  },
  chartCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardBlur: {
    padding: 16,
  },
  chartTitle: {
    fontSize: 14,
    fontFamily: Fonts.plusExtraBold,
    color: Colors.onSurface,
  },
  noDataText: {
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    paddingVertical: 40,
    fontFamily: Fonts.plus,
    fontSize: 14,
  },
  highlightsContainer: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  highlightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  highlightIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightTitle: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  highlightCategory: {
    fontSize: 15,
    fontFamily: Fonts.plusExtraBold,
    color: Colors.onSurface,
    marginTop: 2,
  },
  highlightAmount: {
    fontSize: 16,
    fontFamily: Fonts.spaceBold,
    color: Colors.onSurface,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: 24,
    marginTop: 32,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  downloadText: {
    color: 'white',
    fontSize: 16,
    fontFamily: Fonts.plusBold,
  },
});
