import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { postAllowanceRequest } from '@/src/api/budgetClient';
import { Colors, Fonts } from '@/constants/theme';

export default function AllowanceRequestScreen() {
  const router = useRouter();
  
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!amount || !reason || !phone) return;
    
    setLoading(true);
    try {
      await postAllowanceRequest({
        amount: Number(amount),
        reason,
        parentPhone: phone
      });
      setSuccess(true);
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" color="white" size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Allowance</Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, padding: 20 }}
      >
        {success ? (
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <MaterialIcons name="check-circle" color={Colors.secondary} size={64} />
            </View>
            <Text style={styles.successTitle}>Request Sent!</Text>
            <Text style={styles.successSubtitle}>Your parent has been notified via SMS.</Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <View style={styles.formCard}>
              <BlurView intensity={10} tint="dark" style={styles.cardBlur}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Parent's Phone Number</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="+91 9876543210"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    style={styles.input}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Amount (₹)</Text>
                  <View style={styles.amountInputContainer}>
                     <Text style={styles.currencyPrefix}>₹</Text>
                     <TextInput
                       value={amount}
                       onChangeText={setAmount}
                       keyboardType="numeric"
                       placeholder="0"
                       placeholderTextColor="rgba(255,255,255,0.2)"
                       style={styles.amountInput}
                     />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Reason</Text>
                  <TextInput
                    value={reason}
                    onChangeText={setReason}
                    placeholder="Why do you need this?"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    style={[styles.input, styles.textArea]}
                  />
                </View>

                <TouchableOpacity
                  disabled={loading || !amount || !reason || !phone}
                  onPress={handleSubmit}
                  style={[styles.submitButton, (loading || !amount || !reason || !phone) && { opacity: 0.5 }]}
                >
                   {loading ? (
                     <ActivityIndicator color="white" />
                   ) : (
                     <>
                       <Text style={styles.submitText}>Send Request</Text>
                       <MaterialIcons name="send" color="white" size={20} />
                     </>
                   )}
                </TouchableOpacity>
              </BlurView>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
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
    marginBottom: 20,
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
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 40,
    backgroundColor: `${Colors.secondary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: `${Colors.secondary}30`,
  },
  successTitle: {
    fontSize: 24,
    fontFamily: Fonts.plusExtraBold,
    color: Colors.onSurface,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.plus,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardBlur: {
    padding: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    color: Colors.onSurface,
    fontSize: 16,
    fontFamily: Fonts.plusBold,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  currencyPrefix: {
    fontSize: 24,
    fontFamily: Fonts.spaceBold,
    color: Colors.secondary,
    marginRight: 12,
  },
  amountInput: {
    flex: 1,
    paddingVertical: 16,
    color: Colors.secondary,
    fontSize: 32,
    fontFamily: Fonts.spaceBold,
  },
  textArea: {
    height: 120,
    paddingTop: 16,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.secondary,
    paddingVertical: 18,
    borderRadius: 20,
    marginTop: 12,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  submitText: {
    color: 'white',
    fontSize: 16,
    fontFamily: Fonts.plusBold,
  },
});
