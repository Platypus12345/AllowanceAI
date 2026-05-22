import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts } from '@/constants/theme';
import { updatePreferences } from '@/src/api/budgetClient';

const personalities = [
  { id: 'strict', emoji: '😤', name: 'Strict', description: 'Will roast you for every extra chai.', preview: "You spent ₹250 on snacks today? That's 5 cups of chai you could have had at the mess for free. Think, Aditya, think!" },
  { id: 'supportive', emoji: '😊', name: 'Supportive', description: 'Kind reminders and positive vibes.', preview: "Hey! You're doing great with your budget. Just a small reminder that you've used 40% of your snack allowance. Keep it up! ✨" },
  { id: 'savage', emoji: '😂', name: 'Savage', description: 'No mercy for your Zomato habits.', preview: "Another Zomato order? Your wallet is crying harder than you during the end-sems. Maybe try the mess food for once? It won't kill you." },
  { id: 'zen', emoji: '🧘', name: 'Zen', description: 'Calm, data-driven insights.', preview: "Observe your spending patterns. A small adjustment in non-essential expenses today will lead to financial tranquility by month-end." },
];

export default function AIPersonalityScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState('supportive');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadPersonality = async () => {
      const saved = await AsyncStorage.getItem('aiPersonality');
      if (saved) setSelected(saved);
    };
    loadPersonality();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePreferences({ aiPersonality: selected });
      await AsyncStorage.setItem('aiPersonality', selected);
      Alert.alert('Success', 'AI Personality updated successfully!');
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  const selectedData = personalities.find(p => p.id === selected) || personalities[1];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" color="white" size={32} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>AI Counselor</Text>
          <Text style={styles.headerSubtitle}>Choose how you want your financial AI to interact with your hostel spending habits.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {personalities.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.8}
              onPress={() => setSelected(item.id)}
              style={[
                styles.personalityCard,
                selected === item.id && styles.selectedCard
              ]}
            >
              <BlurView intensity={selected === item.id ? 20 : 10} tint="dark" style={styles.cardBlur}>
                <Text style={styles.emoji}>{item.emoji}</Text>
                <Text style={styles.personalityName}>{item.name}</Text>
                <Text style={styles.personalityDesc}>{item.description}</Text>
              </BlurView>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.previewCard}>
          <BlurView intensity={15} tint="dark" style={styles.previewBlur}>
            <MaterialIcons name="format-quote" size={120} color={Colors.secondary} style={styles.quoteIcon} />
            <View style={styles.previewHeader}>
               <MaterialIcons name="psychology" size={20} color={Colors.secondary} />
               <Text style={styles.previewLabel}>CURRENT MOOD PREVIEW</Text>
            </View>
            <Text style={styles.previewText}>"{selectedData.preview}"</Text>
          </BlurView>
        </View>

        <View style={styles.tipBanner}>
           <MaterialIcons name="tips-and-updates" size={20} color={Colors.secondary} />
           <Text style={styles.tipText}>
             Pro Tip: Changing personality affects the Ask AI chat style and your weekly summary notifications.
           </Text>
        </View>

        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <MaterialIcons name="bolt" size={24} color="white" />
              <Text style={styles.saveButtonText}>Save Preferences</Text>
            </>
          )}
        </TouchableOpacity>
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
    alignItems: 'flex-start',
    gap: 12,
  },
  backButton: {
    marginTop: -4,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: Fonts.plusExtraBold,
    color: Colors.primary,
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.plus,
    color: Colors.onSurfaceVariant,
    marginTop: 4,
    paddingRight: 40,
    lineHeight: 20,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  personalityCard: {
    width: '48%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  selectedCard: {
    borderColor: Colors.secondary,
    backgroundColor: `${Colors.secondary}15`,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 5,
  },
  cardBlur: {
    padding: 16,
    alignItems: 'center',
    height: 140,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  personalityName: {
    fontSize: 12,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurface,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  personalityDesc: {
    fontSize: 11,
    fontFamily: Fonts.plus,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 14,
  },
  previewCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 20,
  },
  previewBlur: {
    padding: 24,
    minHeight: 160,
  },
  quoteIcon: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    opacity: 0.1,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: Colors.secondary,
    letterSpacing: 1,
  },
  previewText: {
    fontSize: 18,
    fontFamily: Fonts.spaceBold,
    color: Colors.onSurface,
    fontStyle: 'italic',
    lineHeight: 26,
  },
  tipBanner: {
    flexDirection: 'row',
    backgroundColor: `${Colors.secondary}05`,
    borderWidth: 1,
    borderColor: `${Colors.secondary}20`,
    borderRadius: 20,
    padding: 16,
    gap: 12,
    marginBottom: 32,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.plus,
    color: Colors.secondary,
    lineHeight: 18,
  },
  saveButton: {
    flexDirection: 'row',
    height: 64,
    backgroundColor: '#6366f1', // indigo-500
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: Fonts.plusBold,
    color: 'white',
  },
});
