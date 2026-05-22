import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSMS } from '@/src/context/SMSContext';
import { formatINR } from '@/src/lib/formatINR';
import { fetchMe, fetchBudgetStats, fetchGamificationStats } from '@/src/api/budgetClient';
import { Colors, Fonts } from '@/constants/theme';
import TopAppBar from '@/components/TopAppBar';

export default function ProfileScreen() {
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const { autoSmsEnabled, setAutoSmsEnabled } = useSMS();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [level, setLevel] = useState(1);
  const [levelTitle, setLevelTitle] = useState('Broke Freshman');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [me, s, gami] = await Promise.all([fetchMe(), fetchBudgetStats(), fetchGamificationStats()]);
      setUser({ ...me, badges: gami.badges || [] });
      setStats(s);
      setLevel(gami.level ?? 1);
      setLevelTitle(gami.levelTitle ?? 'Broke Freshman');
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !user) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1 }}>
      <TopAppBar userName={user?.name || 'User'} level={level} />
      <ScrollView
        style={{ flex: 1, paddingTop: 80 }}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Hero */}
        <View style={styles.profileHero}>
           <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || 'A'}</Text>
              <View style={styles.tierPill}>
                <Text style={styles.tierText}>LVL {level}</Text>
              </View>
           </View>
           <Text style={styles.userName}>{user?.name || 'User'}</Text>
           <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
           <Text style={[styles.userEmail, { marginTop: 8, color: Colors.secondary }]}>{levelTitle}</Text>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account Settings</Text>
          <View style={styles.card}>
            <BlurView intensity={10} tint="dark" style={styles.cardBlur}>
              <View style={styles.menuItem}>
                <View style={[styles.menuIcon, { backgroundColor: `${Colors.primary}20` }]}>
                  <MaterialIcons name="account-balance-wallet" color={Colors.primary} size={20} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.menuTitle}>Monthly Allowance</Text>
                  <Text style={styles.menuValue}>₹{formatINR(stats?.totalAllowance || 0)}</Text>
                </View>
                <MaterialIcons name="chevron-right" color={Colors.onSurfaceVariant} size={20} />
              </View>

              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/request-money')}>
                <View style={[styles.menuIcon, { backgroundColor: `${Colors.secondary}20` }]}>
                  <MaterialIcons name="add-card" color={Colors.secondary} size={20} />
                </View>
                <Text style={styles.menuTitle}>Request Allowance</Text>
                <MaterialIcons name="chevron-right" color={Colors.onSurfaceVariant} size={20} />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/report')}>
                <View style={[styles.menuIcon, { backgroundColor: `${Colors.tertiary}20` }]}>
                  <MaterialIcons name="assignment" color={Colors.tertiary} size={20} />
                </View>
                <Text style={styles.menuTitle}>Monthly Report</Text>
                <MaterialIcons name="chevron-right" color={Colors.onSurfaceVariant} size={20} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/wrapped')}>
                <View style={[styles.menuIcon, { backgroundColor: `${Colors.primary}20` }]}>
                  <MaterialIcons name="redeem" color={Colors.primary} size={20} />
                </View>
                <Text style={styles.menuTitle}>Past Wrappeds</Text>
                <MaterialIcons name="chevron-right" color={Colors.onSurfaceVariant} size={20} />
              </TouchableOpacity>
            </BlurView>
          </View>
        </View>

        {/* App Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>App Settings</Text>
          <View style={styles.card}>
            <BlurView intensity={10} tint="dark" style={styles.cardBlur}>
              {Platform.OS === 'android' && (
                <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/sms-sync')}>
                  <View style={[styles.menuIcon, { backgroundColor: `${Colors.primaryContainer}20` }]}>
                    <MaterialIcons name="sms" color={Colors.primaryContainer} size={20} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.menuTitle}>SMS Tracking Sync</Text>
                    <Text style={styles.menuSub}>{autoSmsEnabled ? 'Enabled' : 'Disabled'}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" color={Colors.onSurfaceVariant} size={20} />
                </TouchableOpacity>
              )}
              
              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/ai-personality')}>
                <View style={[styles.menuIcon, { backgroundColor: `${Colors.secondary}20` }]}>
                  <MaterialIcons name="psychology" color={Colors.secondary} size={20} />
                </View>
                <Text style={styles.menuTitle}>AI Personality Settings</Text>
                <MaterialIcons name="chevron-right" color={Colors.onSurfaceVariant} size={20} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/help')}>
                <View style={[styles.menuIcon, { backgroundColor: `${Colors.primary}20` }]}>
                  <MaterialIcons name="help-outline" color={Colors.primary} size={20} />
                </View>
                <Text style={styles.menuTitle}>Help & Support</Text>
                <MaterialIcons name="chevron-right" color={Colors.onSurfaceVariant} size={20} />
              </TouchableOpacity>
            </BlurView>
          </View>
        </View>

        {/* Logout */}

        <TouchableOpacity style={styles.logoutButton}>
          <MaterialIcons name="logout" color={Colors.error} size={20} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>AllowanceAI v2.4.0 • Built with ❤️</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  profileHero: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  avatarText: {
    fontSize: 40,
    fontFamily: Fonts.plusExtraBold,
    color: 'white',
  },
  tierPill: {
    position: 'absolute',
    bottom: -8,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: Colors.background,
  },
  tierText: {
    color: 'white',
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    letterSpacing: 1,
  },
  userName: {
    fontSize: 24,
    fontFamily: Fonts.plusExtraBold,
    color: Colors.onSurface,
  },
  userEmail: {
    fontSize: 14,
    fontFamily: Fonts.plus,
    color: Colors.onSurfaceVariant,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardBlur: {
    padding: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    flex: 1,
    marginLeft: 12,
    fontSize: 15,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurface,
  },
  menuValue: {
    fontSize: 15,
    fontFamily: Fonts.spaceBold,
    color: Colors.primary,
    marginRight: 4,
  },
  menuSub: {
    fontSize: 11,
    fontFamily: Fonts.plus,
    color: Colors.onSurfaceVariant,
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 128, 128, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 128, 128, 0.1)',
  },
  logoutText: {
    color: Colors.error,
    fontSize: 16,
    fontFamily: Fonts.plusBold,
  },
  versionText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 12,
    fontFamily: Fonts.plus,
    color: Colors.onSurfaceVariant,
    opacity: 0.5,
  },
});
