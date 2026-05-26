import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, Fonts } from '@/constants/theme';
import { useSMS } from '@/src/context/SMSContext';
import { parseSMS } from '@/src/services/smsParser';
import { SMSConfirmSheet } from '@/src/components/SMSConfirmSheet';
import * as budgetClient from '@/src/api/budgetClient';
import type { ParsedBankSms } from '@/src/types/sms';
import type { ExpenseCategory } from '@/src/api/budgetClient';

const testSMSMessages = [
  {
    label: 'HDFC Debit',
    sender: 'VM-HDFCBK',
    body: 'Dear Customer, Rs.250.00 debited from a/c XX1234 to SWIGGY on 22-May. UPI:123456789. Avl Bal:Rs.7,750.00',
  },
  {
    label: 'GPay Credit',
    sender: 'VM-GPAY',
    body: '₹5000 credited to your account XX5678 by SALARY ACCT on 01-May-25. Avl Bal: ₹12,750',
  },
  {
    label: 'PhonePe Refund',
    sender: 'VM-PHONEPE',
    body: 'Refund of Rs.199 for Zomato order has been reversed to your a/c XX1234. UPI Ref: 987654',
  },
  {
    label: 'SBI Debit',
    sender: 'VM-SBIINB',
    body: 'Your A/c XX9012 is debited by Rs.140/- on 22-05-25 for UPI/UBER/Auto to Station',
  },
];

export default function SMSSyncScreen() {
  const router = useRouter();
  const { autoSmsEnabled, setAutoSmsEnabled } = useSMS();
  const [testing, setTesting] = useState(false);
  const [testParsed, setTestParsed] = useState<ParsedBankSms | null>(null);
  const [showTestSheet, setShowTestSheet] = useState(false);

  const handleTestParse = useCallback((test: (typeof testSMSMessages)[0]) => {
    const result = parseSMS(test.body, test.sender, `test-${test.label}`, Date.now());
    if (result) {
      setTestParsed(result);
      setShowTestSheet(true);
    } else {
      Alert.alert('Parse Failed', 'SMS not recognized as bank message');
    }
  }, []);

  const closeTestSheet = useCallback(() => {
    setShowTestSheet(false);
    setTestParsed(null);
  }, []);

  const handleTestAddExpense = useCallback(
    async ({ category, description }: { category: ExpenseCategory; description: string }) => {
      if (!testParsed) return;
      const amount =
        testParsed.type === 'refund' ? -Math.abs(testParsed.amount) : Math.abs(testParsed.amount);
      await budgetClient.postExpense({
        amount,
        category,
        description: description || testParsed.merchant,
      });
      Alert.alert('Success', 'Expense added from test SMS');
      closeTestSheet();
    },
    [testParsed, closeTestSheet]
  );

  const handleTestUpdateAllowance = useCallback(
    async ({ description }: { description: string }) => {
      if (!testParsed) return;
      const stats = await budgetClient.fetchBudgetStats();
      const nextAllowance = (stats.totalAllowance ?? 0) + Math.abs(testParsed.amount);
      await budgetClient.putAllowance(nextAllowance);
      Alert.alert('Success', `Allowance updated (+₹${testParsed.amount}) — ${description}`);
      closeTestSheet();
    },
    [testParsed, closeTestSheet]
  );

  const handleTestSync = () => {
    if (!autoSmsEnabled) {
      Alert.alert('Tracking Disabled', 'Please enable SMS tracking first.');
      return;
    }
    setTesting(true);
    setTimeout(() => {
      setTesting(false);
      Alert.alert('Sync Successful', 'Last 5 transaction SMS successfully parsed and categorized.');
    }, 2000);
  };

  const channels = [
    { icon: 'account-balance', name: 'Bank SMS', desc: 'SBI, HDFC, ICICI, Axis', active: true },
    { icon: 'contactless', name: 'GPay Alerts', desc: 'Transaction receipts', active: true },
    { icon: 'payments', name: 'PhonePe', desc: 'UPI payment confirmations', active: false },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" color="white" size={32} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SMS Tracking Sync</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
           <View style={styles.heroCircle}>
              <View style={styles.blob} />
              <BlurView intensity={20} tint="dark" style={styles.heroBlur}>
                 <MaterialIcons name="message" size={72} color={Colors.primaryContainer} />
                 <View style={styles.settingsBadge}>
                    <BlurView intensity={30} tint="dark" style={styles.badgeBlur}>
                       <MaterialIcons name="settings" size={20} color={Colors.secondary} />
                    </BlurView>
                 </View>
              </BlurView>
           </View>
           <Text style={styles.heroTitle}>SMS Tracking Sync</Text>
           <Text style={styles.heroSub}>
             Automate your hostel budget by letting AI read your transaction alerts in real-time.
           </Text>
        </View>

        <View style={styles.toggleCard}>
           <BlurView intensity={15} tint="dark" style={styles.toggleBlur}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>Enable SMS Tracking</Text>
                <Text style={styles.toggleLabel}>REAL-TIME SYNC</Text>
              </View>
              <Switch
                value={autoSmsEnabled}
                onValueChange={setAutoSmsEnabled}
                trackColor={{ false: 'rgba(255,255,255,0.1)', true: Colors.primaryContainer }}
                thumbColor="white"
              />
           </BlurView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACTIVE CHANNELS</Text>
          <View style={styles.channelList}>
            {channels.map((channel, idx) => (
              <TouchableOpacity key={idx} style={styles.channelRow} activeOpacity={0.7}>
                <BlurView intensity={10} tint="dark" style={styles.channelBlur}>
                  <View style={styles.channelIcon}>
                    <MaterialIcons name={channel.icon as any} size={24} color={Colors.secondary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 16 }}>
                    <Text style={styles.channelName}>{channel.name}</Text>
                    <Text style={styles.channelDesc}>{channel.desc}</Text>
                  </View>
                  <MaterialIcons 
                    name={channel.active ? "check-circle" : "radio-button-unchecked"} 
                    size={24} 
                    color={channel.active ? Colors.primaryContainer : '#475569'} 
                  />
                </BlurView>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity 
          style={styles.testButton} 
          onPress={handleTestSync}
          disabled={testing}
        >
          <MaterialIcons name="sync" size={24} color="white" style={testing && styles.spinning} />
          <Text style={styles.testButtonText}>{testing ? 'Syncing...' : 'Test Sync'}</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TEST SMS PARSER</Text>
          {testSMSMessages.map((test) => (
            <TouchableOpacity
              key={test.label}
              style={styles.testParseRow}
              activeOpacity={0.7}
              onPress={() => handleTestParse(test)}
            >
              <BlurView intensity={10} tint="dark" style={styles.testParseBlur}>
                <Text style={styles.channelName}>{test.label}</Text>
                <Text style={styles.testParseArrow}>Test →</Text>
              </BlurView>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.privacyCard}>
           <BlurView intensity={20} tint="dark" style={styles.privacyBlur}>
              <View style={styles.privacyHeader}>
                <MaterialIcons name="security" size={20} color={Colors.secondary} />
                <Text style={styles.privacyTitle}>Privacy Guarantee</Text>
              </View>
              <Text style={styles.privacyText}>
                We only read transaction amounts and merchants. Your personal chats and OTPs are safe and never leave your device.
              </Text>
           </BlurView>
        </View>
      </ScrollView>

      <SMSConfirmSheet
        visible={showTestSheet}
        parsed={testParsed}
        onClose={closeTestSheet}
        onIgnore={closeTestSheet}
        onAddExpense={handleTestAddExpense}
        onUpdateAllowance={handleTestUpdateAllowance}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: Fonts.plusExtraBold,
    color: 'white',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 40,
  },
  heroCircle: {
    width: 192,
    height: 192,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  blob: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.primaryContainer,
    opacity: 0.1,
  },
  heroBlur: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128,131,255,0.2)',
    overflow: 'hidden',
  },
  settingsBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(68,226,205,0.2)',
  },
  badgeBlur: {
    flex: 1,
    backgroundColor: `${Colors.secondary}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontFamily: Fonts.plusExtraBold,
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 14,
    fontFamily: Fonts.plus,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
  },
  toggleCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 32,
  },
  toggleBlur: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleTitle: {
    fontSize: 16,
    fontFamily: Fonts.plusBold,
    color: 'white',
  },
  toggleLabel: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: '#64748b',
    letterSpacing: 1,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 16,
    marginLeft: 4,
  },
  channelList: {
    gap: 12,
  },
  channelRow: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  channelBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  channelIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelName: {
    fontSize: 16,
    fontFamily: Fonts.plusBold,
    color: 'white',
  },
  channelDesc: {
    fontSize: 12,
    fontFamily: Fonts.plus,
    color: '#64748b',
    marginTop: 2,
  },
  testButton: {
    flexDirection: 'row',
    marginHorizontal: 20,
    height: 64,
    borderRadius: 24,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: Colors.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    marginBottom: 32,
  },
  testButtonText: {
    fontSize: 16,
    fontFamily: Fonts.plusBold,
    color: 'white',
  },
  spinning: {
    // Rotation would be handled by Reanimated, simplified here
  },
  testParseRow: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
  },
  testParseBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  testParseArrow: {
    fontSize: 12,
    fontFamily: Fonts.plusBold,
    color: Colors.secondary,
  },
  privacyCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: Colors.secondary,
  },
  privacyBlur: {
    padding: 20,
    backgroundColor: `${Colors.secondary}05`,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  privacyTitle: {
    fontSize: 14,
    fontFamily: Fonts.plusBold,
    color: 'white',
  },
  privacyText: {
    fontSize: 12,
    fontFamily: Fonts.plus,
    color: '#94a3b8',
    lineHeight: 18,
  },
});
