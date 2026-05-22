import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, Fonts } from '@/constants/theme';

export default function HelpScreen() {
  const router = useRouter();

  const handleEmail = () => {
    Linking.openURL('mailto:support@allowanceai.com');
  };

  const topics = [
    { icon: 'psychology', color: '#818cf8', text: 'How does AI prediction work?' },
    { icon: 'security', color: Colors.secondary, text: 'Security & Privacy' },
    { icon: 'sms', color: Colors.tertiary, text: 'How does SMS tracking work?' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" color="white" size={32} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>How can we help?</Text>
      </View>

      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={24} color={Colors.onSurfaceVariant} style={styles.searchIcon} />
        <TextInput
          placeholder="Search for help..."
          placeholderTextColor={Colors.onSurfaceVariant}
          style={styles.searchInput}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>RECOMMENDED TOPICS</Text>
          <View style={styles.topicsList}>
            {topics.map((topic, idx) => (
              <TouchableOpacity key={idx} style={styles.topicRow} activeOpacity={0.7}>
                <BlurView intensity={10} tint="dark" style={styles.topicBlur}>
                  <View style={[styles.topicIcon, { backgroundColor: `${topic.color}15` }]}>
                    <MaterialIcons name={topic.icon as any} size={20} color={topic.color} />
                  </View>
                  <Text style={styles.topicText}>{topic.text}</Text>
                  <MaterialIcons name="chevron-right" size={20} color="#64748b" />
                </BlurView>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.supportGrid}>
          <TouchableOpacity 
            style={styles.supportButton} 
            activeOpacity={0.8}
            onPress={() => router.push('/ai')}
          >
            <View style={[styles.supportCard, { backgroundColor: Colors.primaryContainer }]}>
               <MaterialIcons name="smart-toy" size={32} color={Colors.onPrimaryContainer} />
               <Text style={[styles.supportLabel, { color: Colors.onPrimaryContainer }]}>CHAT WITH AI</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.supportButton} 
            activeOpacity={0.8}
            onPress={handleEmail}
          >
            <View style={styles.supportCardGlass}>
               <BlurView intensity={15} tint="dark" style={styles.supportBlur}>
                 <MaterialIcons name="mail" size={32} color={Colors.secondary} />
                 <Text style={styles.supportLabelWhite}>EMAIL US</Text>
               </BlurView>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.counselorCard}>
          <BlurView intensity={20} tint="dark" style={styles.counselorBlur}>
            {/* Blobs */}
            <View style={[styles.blob, { backgroundColor: Colors.primaryContainer, top: -20, left: -20 }]} />
            <View style={[styles.blob, { backgroundColor: Colors.secondary, bottom: -20, right: -20 }]} />
            
            <View style={styles.badge}>
              <Text style={styles.badgeText}>NEW</Text>
            </View>
            <Text style={styles.counselorTitle}>AI Financial Counselor</Text>
            <Text style={styles.counselorSub}>
              Get personalized advice for your hostel budget based on your spending patterns.
            </Text>
          </BlurView>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>v2.4.0 (Stable Release)</Text>
          <Text style={styles.footerSub}>Designed for Hostel Life in India</Text>
        </View>
      </ScrollView>
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
  searchContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 16,
    top: 16,
    zIndex: 1,
  },
  searchInput: {
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    paddingLeft: 52,
    paddingRight: 20,
    color: 'white',
    fontFamily: Fonts.plus,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
    letterSpacing: 1,
    marginBottom: 16,
  },
  topicsList: {
    gap: 12,
  },
  topicRow: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  topicBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
  },
  topicIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topicText: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.plusBold,
    color: 'white',
  },
  supportGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 32,
  },
  supportButton: {
    flex: 1,
  },
  supportCard: {
    height: 140,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  supportCardGlass: {
    height: 140,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  supportBlur: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  supportLabel: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    letterSpacing: 1,
  },
  supportLabelWhite: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    letterSpacing: 1,
    color: 'white',
  },
  counselorCard: {
    marginHorizontal: 20,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 40,
    minHeight: 160,
  },
  counselorBlur: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  blob: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.15,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: `${Colors.secondary}20`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  badgeText: {
    color: Colors.secondary,
    fontSize: 10,
    fontFamily: Fonts.plusBold,
  },
  counselorTitle: {
    fontSize: 20,
    fontFamily: Fonts.plusExtraBold,
    color: 'white',
    marginBottom: 8,
  },
  counselorSub: {
    fontSize: 13,
    fontFamily: Fonts.plus,
    color: '#94a3b8',
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#475569',
    fontFamily: Fonts.plus,
  },
  footerSub: {
    fontSize: 10,
    color: '#475569',
    fontFamily: Fonts.plusBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
});
