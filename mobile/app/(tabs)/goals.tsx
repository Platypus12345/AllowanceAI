import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { api } from '@/src/api/http';
import { formatINR } from '@/src/lib/formatINR';
import type { GoalProgressRow, ExpenseCategory } from '@/src/api/budgetClient';
import { Colors, Fonts } from '@/constants/theme';
import TopAppBar from '@/components/TopAppBar';

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

export default function GoalsScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  
  const [goals, setGoals] = useState<GoalProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [editLimit, setEditLimit] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/api/budget/goals/progress');
      setGoals(data.progress);
    } catch (e: unknown) {
      console.error(e);
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

  const openEditor = (category: ExpenseCategory, currentLimit: number | null) => {
    setEditingCategory(category);
    setEditLimit(currentLimit ? String(currentLimit) : '');
  };

  const closeEditor = () => {
    setEditingCategory(null);
    setEditLimit('');
  };

  const saveGoal = async () => {
    if (!editingCategory) return;
    const limitNum = parseFloat(editLimit.replace(/,/g, ''));
    if (isNaN(limitNum) || limitNum < 0) return;
    
    setSaving(true);
    try {
      await api.post('/api/budget/goals', {
        category: editingCategory,
        monthlyLimit: limitNum,
      });
      closeEditor();
      void load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1 }}>
      <TopAppBar />
      <View style={{ flex: 1, paddingTop: 80 }}>
        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <Text style={{ fontSize: 24, fontFamily: Fonts.plusExtraBold, color: Colors.onSurface }}>Budget Goals</Text>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 100, paddingHorizontal: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {loading && goals.length === 0 ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : (
            goals.map((item) => {
              const icon = CATEGORY_ICONS[item.category] || 'more-horiz';
              const color = CATEGORY_COLORS[item.category] || Colors.outline;
              const hasLimit = item.limit !== null;

              let statusColor = Colors.secondary;
              if (item.status === 'warning') statusColor = Colors.tertiary;
              else if (item.status === 'danger') statusColor = Colors.error;

              return (
                <TouchableOpacity
                  key={item.category}
                  activeOpacity={0.8}
                  onPress={() => openEditor(item.category, item.limit)}
                  style={styles.goalCard}
                >
                  <BlurView intensity={20} tint="dark" style={styles.cardBlur}>
                    <View style={styles.cardHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
                          <MaterialIcons name={icon as any} size={24} color={color} />
                        </View>
                        <View>
                          <Text style={styles.categoryTitle}>{item.category}</Text>
                          {hasLimit && (
                            <Text style={[styles.statusText, { color: statusColor }]}>{item.status || 'safe'}</Text>
                          )}
                        </View>
                      </View>
                      <MaterialIcons name="edit" size={16} color={Colors.onSurfaceVariant} style={{ opacity: 0.4 }} />
                    </View>

                    <View style={styles.statsRow}>
                      <View>
                        <Text style={styles.statLabel}>Spent</Text>
                        <Text style={styles.statValue}>₹{formatINR(item.spent)}</Text>
                      </View>
                      {hasLimit && (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.statLabel}>Limit</Text>
                          <Text style={styles.statValue}>₹{formatINR(item.limit)}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.progressContainer}>
                      <View style={styles.progressBar}>
                        {hasLimit ? (
                          <View
                            style={[
                              styles.progressFill,
                              { width: `${Math.min(100, item.percentage || 0)}%`, backgroundColor: statusColor }
                            ]}
                          />
                        ) : (
                          <View style={styles.dashedBar} />
                        )}
                      </View>
                      {hasLimit && (
                        <Text style={[styles.percentageText, { color: statusColor }]}>{item.percentage}%</Text>
                      )}
                    </View>
                  </BlurView>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>

      {/* Editor Modal */}
      <Modal visible={!!editingCategory} transparent animationType="slide" onRequestClose={closeEditor}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingCategory} Goal</Text>
              <TouchableOpacity onPress={closeEditor} style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color={Colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Monthly Limit (₹)</Text>
            <TextInput
              value={editLimit}
              onChangeText={setEditLimit}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={Colors.onSurfaceVariant}
              style={styles.textInput}
              autoFocus
            />

            <TouchableOpacity
              disabled={saving}
              onPress={saveGoal}
              style={styles.saveButton}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.saveButtonText}>Save Goal</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  goalCard: {
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardBlur: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    fontSize: 16,
    fontFamily: Fonts.plusExtraBold,
    color: Colors.onSurface,
  },
  statusText: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
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
  progressContainer: {
    position: 'relative',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  dashedBar: {
    height: '100%',
    width: '100%',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
  },
  percentageText: {
    position: 'absolute',
    right: 0,
    top: -24,
    fontSize: 12,
    fontFamily: Fonts.spaceBold,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalContent: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: Fonts.plusExtraBold,
    color: Colors.onSurface,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    fontSize: 20,
    fontFamily: Fonts.spaceBold,
    color: Colors.onSurface,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontFamily: Fonts.plusBold,
    fontSize: 16,
  },
});
