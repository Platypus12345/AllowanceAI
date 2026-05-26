import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { postAiTips, fetchBudgetStats } from '@/src/api/budgetClient';
import { Colors, Fonts } from '@/constants/theme';

export default function SavingTipsScreen() {
  const router = useRouter();
  const [tips, setTips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTips = useCallback(async () => {
    try {
      const stats = await fetchBudgetStats();
      const topCategories = stats.chartData ? stats.chartData.map((c: any) => c.name) : [];

      const res = await postAiTips({
        allowance: stats.totalAllowance,
        spent: stats.spentAmount,
        remaining: stats.remainingBalance,
        topCategories
      });
      setTips(res.tips || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchTips();
  }, [fetchTips]);

  const onRefresh = () => {
    setRefreshing(true);
    void fetchTips();
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" color="white" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Smart Saving Tips</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <MaterialIcons name="refresh" color={Colors.tertiary} size={20} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <MaterialIcons name="lightbulb" color={Colors.tertiary} size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.loadingText}>AI is crafting strategies...</Text>
        </View>
      ) : (
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ padding: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {tips.length === 0 ? (
             <View style={styles.emptyContainer}>
                <MaterialIcons name="info-outline" color={Colors.onSurfaceVariant} size={40} />
                <Text style={styles.emptyText}>No tips available right now.</Text>
             </View>
          ) : (
             tips.map((tipObj, idx) => (
               <View key={idx} style={styles.tipCard}>
                 <BlurView intensity={20} tint="dark" style={styles.cardBlur}>
                   <View style={styles.cardHeader}>
                     <View style={styles.categoryPill}>
                       <Text style={styles.categoryText}>{tipObj.category}</Text>
                     </View>
                     <View style={styles.savingsBadge}>
                       <MaterialIcons name="trending-down" color={Colors.secondary} size={14} />
                       <Text style={styles.savingsText}>{tipObj.estimatedSaving}</Text>
                     </View>
                   </View>
                   
                   <View style={styles.tipContent}>
                      <View style={[styles.tipIcon, { backgroundColor: `${Colors.tertiary}20` }]}>
                        <MaterialIcons name="bolt" color={Colors.tertiary} size={20} />
                      </View>
                      <Text style={styles.tipText}>"{tipObj.tip}"</Text>
                   </View>
                 </BlurView>
               </View>
             ))
          )}
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
    flex: 1,
    color: Colors.onSurface,
    fontSize: 20,
    fontFamily: Fonts.plusExtraBold,
    marginLeft: 8,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${Colors.tertiary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${Colors.tertiary}30`,
  },
  loadingText: {
    color: Colors.onSurfaceVariant,
    fontSize: 14,
    fontFamily: Fonts.plus,
    marginTop: 12,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    opacity: 0.5,
  },
  emptyText: {
    color: Colors.onSurfaceVariant,
    fontSize: 16,
    fontFamily: Fonts.plus,
    marginTop: 12,
  },
  tipCard: {
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardBlur: {
    padding: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  categoryPill: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  categoryText: {
    color: Colors.onSurfaceVariant,
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.secondary}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: `${Colors.secondary}30`,
    gap: 4,
  },
  savingsText: {
    color: Colors.secondary,
    fontSize: 12,
    fontFamily: Fonts.spaceBold,
  },
  tipContent: {
    flexDirection: 'row',
    gap: 16,
  },
  tipIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    color: Colors.onSurface,
    fontSize: 15,
    fontFamily: Fonts.plusBold,
    lineHeight: 22,
    fontStyle: 'italic',
  },
});
