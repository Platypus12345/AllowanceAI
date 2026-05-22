import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Fonts } from '@/constants/theme';
import { useRouter } from 'expo-router';

const { width: SCREEN_W } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();

  const handleGoogleLogin = () => {
    // Logic for Google Login would go here
    // For now, we'll just navigate to the dashboard as a demo
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <View style={styles.logoBackground}>
            <MaterialIcons name="account-balance-wallet" size={60} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>AllowanceAI</Text>
          <Text style={styles.tagline}>Your AI Money Mentor</Text>
        </View>

        {/* Value Props */}
        <View style={styles.propsContainer}>
          <BlurView intensity={10} tint="dark" style={styles.propsBlur}>
            <View style={styles.propItem}>
              <View style={[styles.propIcon, { backgroundColor: `${Colors.primary}20` }]}>
                <MaterialIcons name="sms" size={20} color={Colors.primary} />
              </View>
              <View>
                <Text style={styles.propTitle}>Auto Tracking</Text>
                <Text style={styles.propSub}>SMS synced expenses</Text>
              </View>
            </View>

            <View style={styles.propItem}>
              <View style={[styles.propIcon, { backgroundColor: `${Colors.secondary}20` }]}>
                <MaterialIcons name="psychology" size={20} color={Colors.secondary} />
              </View>
              <View>
                <Text style={styles.propTitle}>AI Insights</Text>
                <Text style={styles.propSub}>Smart budget advice</Text>
              </View>
            </View>

            <View style={styles.propItem}>
              <View style={[styles.propIcon, { backgroundColor: `${Colors.tertiary}20` }]}>
                <MaterialIcons name="verified" size={20} color={Colors.tertiary} />
              </View>
              <View>
                <Text style={styles.propTitle}>Financial Freedom</Text>
                <Text style={styles.propSub}>Master your allowance</Text>
              </View>
            </View>
          </BlurView>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
            <Image 
              source={{ uri: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg' }} 
              style={styles.googleIcon} 
            />
            <Text style={styles.googleText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.emailButton}>
            <Text style={styles.emailText}>Create Account</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryAction}>
            <Text style={styles.secondaryText}>Sign in with Email</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>
          SECURELY MANAGED BY ALLOWANCEAI CLOUD
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoBackground: {
    width: 120,
    height: 120,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 10,
  },
  appName: {
    fontSize: 40,
    fontFamily: Fonts.plusExtraBold,
    color: Colors.onSurface,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 16,
    fontFamily: Fonts.plus,
    color: Colors.onSurfaceVariant,
    marginTop: 4,
    opacity: 0.7,
  },
  propsContainer: {
    width: '100%',
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 40,
  },
  propsBlur: {
    padding: 24,
    gap: 20,
  },
  propItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  propIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  propTitle: {
    fontSize: 16,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurface,
  },
  propSub: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    height: 64,
    borderRadius: 20,
    gap: 12,
    shadowColor: 'white',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  googleIcon: {
    width: 24,
    height: 24,
  },
  googleText: {
    fontSize: 16,
    fontFamily: Fonts.plusBold,
    color: '#1a1a1a',
  },
  emailButton: {
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  emailText: {
    fontSize: 16,
    fontFamily: Fonts.plusBold,
    color: 'white',
  },
  secondaryAction: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryText: {
    fontSize: 14,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
  },
  footerText: {
    position: 'absolute',
    bottom: 40,
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: Colors.outline,
    letterSpacing: 2,
    opacity: 0.4,
  },
});
