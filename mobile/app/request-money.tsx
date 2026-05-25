import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Linking, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, Fonts } from '@/constants/theme';
import {
  postAllowanceRequest,
  fetchFriends,
  fetchUserProfile,
  fetchLinkedParents,
  fetchMoneyRequests,
  postUpiCollect,
  postWhatsAppRequest,
  type FriendRow,
} from '@/src/api/budgetClient';
import { useToast } from '@/src/context/ToastContext';


const quickAmounts = [200, 500, 1000, 2000];
const quickReasons = ["Mess Food", "Chai", "Printouts", "Auto Rickshaw", "Medical", "Books"];

export default function RequestMoneyScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'parents' | 'friends'>('parents');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState<'upi' | 'whatsapp'>('upi');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ upiId?: string; upiName?: string; name?: string } | null>(null);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [parents, setParents] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState('');
  const [selectedParentIdx, setSelectedParentIdx] = useState(0);
  const toast = useToast();

  useEffect(() => {
    Promise.all([fetchUserProfile(), fetchFriends(), fetchLinkedParents(), fetchMoneyRequests()])
      .then(([prof, fr, par, req]) => {
        setProfile(prof);
        setFriends(fr);
        setParents(par);
        setRequests(req);
        const owing = fr.filter((f) => f.totalOwed > 0);
        if (owing[0]) setSelectedFriendId(owing[0]._id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSendParent = async () => {
    if (!amount || !reason) {
      Alert.alert('Error', 'Please enter amount and reason');
      return;
    }
    setSending(true);
    try {
      // Mock parent phone for now as it's not in the UI selection yet
      const parent = parents[selectedParentIdx];
      const parentPhone = parent?.phone?.replace(/\D/g, '') || '919876543210';
      await postAllowanceRequest({ amount: Number(amount), reason, parentPhone });
      
      const message = encodeURIComponent(`Hi, I need ₹${amount} for ${reason}. - via AllowanceAI`);
      const url = `whatsapp://send?phone=${parentPhone}&text=${message}`;
      
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Success', 'Request saved, but WhatsApp is not installed.');
      }
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  const handleSendFriend = async () => {
    if (!profile?.upiId) {
      Alert.alert('UPI required', 'Set your UPI ID in Profile first', [
        { text: 'Go to Profile', onPress: () => router.push('/(tabs)/profile') },
        { text: 'Cancel' },
      ]);
      return;
    }
    if (!selectedFriendId || !amount || !reason) {
      Alert.alert('Error', 'Select friend, amount, and note');
      return;
    }
    const amt = Number(amount);
    try {
      if (method === 'upi') {
        const res = await postUpiCollect({ friendId: selectedFriendId, amount: amt, note: reason, senderUpiId: profile.upiId });
        await Linking.openURL(res.deepLink);
        toast({ message: 'UPI collect opened', type: 'success' });
      } else {
        const res = await postWhatsAppRequest({ friendId: selectedFriendId, amount: amt, note: reason, senderUpiId: profile.upiId });
        await Linking.openURL(res.deepLink);
        toast({ message: 'WhatsApp opened', type: 'success' });
      }
    } catch (e: any) {
      toast({ message: e.response?.data?.message || 'Failed', type: 'error' });
    }
  };

  const friendsWhoOwe = friends.filter((f) => f.totalOwed > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" color="white" size={32} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Money</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Tab Selector */}
        <View style={styles.tabContainer}>
           <TouchableOpacity 
             style={[styles.tab, tab === 'parents' && styles.activeTab]} 
             onPress={() => setTab('parents')}
           >
             <Text style={[styles.tabText, tab === 'parents' && styles.activeTabText]}>From Parents</Text>
           </TouchableOpacity>
           <TouchableOpacity 
             style={[styles.tab, tab === 'friends' && styles.activeTab]} 
             onPress={() => setTab('friends')}
           >
             <Text style={[styles.tabText, tab === 'friends' && styles.activeTabText]}>From Friends</Text>
           </TouchableOpacity>
        </View>

        {/* Amount Input Card */}
        <View style={styles.amountCard}>
          <BlurView intensity={15} tint="dark" style={styles.amountBlur}>
            <Text style={styles.cardLabel}>ENTER AMOUNT</Text>
            <View style={styles.amountInputRow}>
              <Text style={styles.currency}>₹</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="rgba(255,255,255,0.2)"
              />
            </View>
            <View style={styles.divider} />
            
            <View style={styles.chipGrid}>
              {quickAmounts.map(amt => (
                <TouchableOpacity 
                  key={amt} 
                  style={[styles.chip, amount === amt.toString() && styles.activeChip]}
                  onPress={() => setAmount(amt.toString())}
                >
                  <Text style={[styles.chipText, amount === amt.toString() && styles.activeChipText]}>₹{amt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </BlurView>
        </View>

        {tab === 'parents' ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>SEND REQUEST TO</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarScroll}>
                {parents.length === 0 ? (
                  <Text style={{ color: Colors.onSurfaceVariant, fontFamily: Fonts.plus, paddingHorizontal: 20 }}>
                    Link a parent account first
                  </Text>
                ) : parents.map((p: any, idx: number) => (
                  <TouchableOpacity 
                    key={p._id} 
                    onPress={() => setSelectedParentIdx(idx)}
                    style={[styles.avatarItem, selectedParentIdx === idx && styles.activeAvatar]}
                  >
                    <View style={styles.avatarCircle}>
                       <Text style={styles.avatarInitial}>{p.name?.[0]}</Text>
                    </View>
                    <Text style={styles.avatarName}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.addAvatar}>
                   <View style={styles.addAvatarCircle}>
                      <MaterialIcons name="add" size={24} color={Colors.onSurfaceVariant} />
                   </View>
                   <Text style={styles.avatarName}>Add</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            <View style={styles.section}>
               <Text style={styles.sectionLabel}>REASON</Text>
               <View style={styles.inputCard}>
                 <BlurView intensity={10} tint="dark" style={styles.inputBlur}>
                   <TextInput
                     placeholder="e.g., Hostel fees, Mess bill..."
                     placeholderTextColor={Colors.onSurfaceVariant}
                     value={reason}
                     onChangeText={setReason}
                     multiline
                     style={styles.textArea}
                   />
                 </BlurView>
               </View>
               <View style={styles.reasonChips}>
                 {quickReasons.map(r => (
                   <TouchableOpacity 
                     key={r} 
                     style={styles.reasonChip}
                     onPress={() => setReason(r)}
                   >
                     <Text style={styles.reasonChipText}>{r}</Text>
                   </TouchableOpacity>
                 ))}
               </View>
            </View>

            <TouchableOpacity 
              style={styles.sendButton} 
              onPress={handleSendParent}
              disabled={sending || parents.length === 0}
            >
              {sending ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.sendButtonText}>Send Request via WhatsApp</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.section}>
               <Text style={styles.sectionLabel}>WHO OWES YOU?</Text>
               {!profile?.upiId && (
                 <View style={{ marginHorizontal: 20, marginBottom: 16, padding: 14, borderRadius: 16, backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' }}>
                   <Text style={{ color: '#fbbf24', fontFamily: Fonts.plusBold, marginBottom: 8 }}>Set your UPI ID in Profile to request money</Text>
                   <TouchableOpacity onPress={() => router.push('/(tabs)/profile')}>
                     <Text style={{ color: Colors.primary, fontFamily: Fonts.plusBold }}>Go to Profile</Text>
                   </TouchableOpacity>
                 </View>
               )}
               {friendsWhoOwe.length === 0 ? (
                 <Text style={{ marginLeft: 24, color: Colors.onSurfaceVariant, fontFamily: Fonts.plus }}>Nobody owes you right now</Text>
               ) : (
               <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendScroll}>
                 {friendsWhoOwe.map((friend) => (
                   <TouchableOpacity key={friend._id} style={styles.friendCard} onPress={() => setSelectedFriendId(friend._id)}>
                     <BlurView intensity={10} tint="dark" style={[styles.friendBlur, selectedFriendId === friend._id && { borderWidth: 1, borderColor: Colors.secondary }]}>
                        <View style={styles.friendAvatar}>
                           <Text style={styles.avatarInitial}>{friend.name[0]}</Text>
                        </View>
                        <Text style={styles.friendName}>{friend.name}</Text>
                        <Text style={styles.friendAmount}>₹{friend.totalOwed}</Text>
                        <Text style={styles.unsettledTag}>UNSETTLED</Text>
                     </BlurView>
                   </TouchableOpacity>
                 ))}
               </ScrollView>
               )}
            </View>

            <View style={styles.section}>
               <View style={styles.pillToggle}>
                  <TouchableOpacity 
                    style={[styles.pill, method === 'upi' && styles.activePill]}
                    onPress={() => setMethod('upi')}
                  >
                    <Text style={[styles.pillText, method === 'upi' && styles.activePillText]}>Via UPI ID</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.pill, method === 'whatsapp' && styles.activePill]}
                    onPress={() => setMethod('whatsapp')}
                  >
                    <Text style={[styles.pillText, method === 'whatsapp' && styles.activePillText]}>Via WhatsApp</Text>
                  </TouchableOpacity>
               </View>

               {profile?.upiId && (
                 <Text style={{ marginHorizontal: 20, marginBottom: 8, color: Colors.secondary, fontFamily: Fonts.plus }}>
                   Receive on: {profile.upiId}
                 </Text>
               )}
               <TextInput
                 style={{ marginHorizontal: 20, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 14, color: 'white', fontFamily: Fonts.plus }}
                 placeholder="What's this for?"
                 placeholderTextColor={Colors.onSurfaceVariant}
                 value={reason}
                 onChangeText={setReason}
               />
               {method === 'whatsapp' && profile?.upiId && (
                 <View style={styles.whatsappPreview}>
                    <BlurView intensity={10} tint="dark" style={styles.whatsappBlur}>
                       <MaterialIcons name="message" size={24} color="#4ade80" />
                       <Text style={styles.whatsappText}>
                         {`Hey ${friends.find(f => f._id === selectedFriendId)?.name || 'friend'}! You owe me ₹${amount || '0'} for ${reason || '...'}. Please send it to ${profile.upiId}. — via AllowanceAI`}
                       </Text>
                    </BlurView>
                 </View>
               )}
            </View>

            <TouchableOpacity 
              style={[styles.sendButtonFriend, method === 'upi' ? styles.upiButton : styles.whatsappButton]} 
              onPress={handleSendFriend}
            >
              <MaterialIcons name={method === 'upi' ? 'contactless' : 'send'} size={24} color="white" />
              <Text style={styles.sendButtonText}>
                {method === 'upi' ? 'Send UPI Collect Request' : 'Send via WhatsApp'}
              </Text>
            </TouchableOpacity>
          </>
        )}
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
  scrollContent: {
    paddingBottom: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    padding: 6,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  activeTab: {
    backgroundColor: Colors.primaryContainer,
  },
  tabText: {
    fontSize: 13,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
  },
  activeTabText: {
    color: Colors.onPrimaryContainer,
  },
  amountCard: {
    marginHorizontal: 20,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 32,
  },
  amountBlur: {
    padding: 24,
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: Colors.primaryContainer,
    letterSpacing: 1,
    marginBottom: 16,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  currency: {
    fontSize: 40,
    fontFamily: Fonts.plusExtraBold,
    color: 'white',
    marginRight: 8,
  },
  amountInput: {
    fontSize: 48,
    fontFamily: Fonts.spaceBold,
    color: 'white',
    minWidth: 100,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 20,
  },
  chipGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeChip: {
    borderColor: 'rgba(128,131,255,0.5)',
    backgroundColor: 'rgba(128,131,255,0.1)',
  },
  chipText: {
    fontSize: 14,
    fontFamily: Fonts.spaceBold,
    color: Colors.onSurfaceVariant,
  },
  activeChipText: {
    color: Colors.primaryContainer,
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 16,
    marginLeft: 24,
  },
  avatarScroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  avatarItem: {
    alignItems: 'center',
    opacity: 0.6,
  },
  activeAvatar: {
    opacity: 1,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarInitial: {
    fontSize: 24,
    fontFamily: Fonts.plusExtraBold,
    color: 'white',
  },
  avatarName: {
    fontSize: 12,
    fontFamily: Fonts.plusBold,
    color: 'white',
  },
  addAvatar: {
    alignItems: 'center',
  },
  addAvatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  inputCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 12,
  },
  inputBlur: {
    padding: 16,
  },
  textArea: {
    height: 80,
    color: 'white',
    fontFamily: Fonts.plus,
    textAlignVertical: 'top',
  },
  reasonChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 8,
  },
  reasonChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  reasonChipText: {
    fontSize: 12,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
  },
  aiTipCard: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 20,
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: Colors.tertiary,
  },
  aiTipBlur: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: 'rgba(255,182,144,0.05)',
  },
  aiTipText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.plus,
    color: Colors.onSurface,
    lineHeight: 18,
  },
  sendButton: {
    marginHorizontal: 20,
    marginTop: 32,
    height: 64,
    borderRadius: 24,
    backgroundColor: Colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primaryContainer,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  sendButtonFriend: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 32,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    elevation: 8,
  },
  upiButton: {
    backgroundColor: Colors.secondary,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  whatsappButton: {
    backgroundColor: '#16a34a', // green-600
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  sendButtonText: {
    fontSize: 16,
    fontFamily: Fonts.plusBold,
    color: 'white',
  },
  friendScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  friendCard: {
    width: 130,
    height: 150,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  friendBlur: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  friendName: {
    fontSize: 14,
    fontFamily: Fonts.plusBold,
    color: 'white',
  },
  friendAmount: {
    fontSize: 18,
    fontFamily: Fonts.spaceBold,
    color: Colors.secondary,
    marginTop: 2,
  },
  unsettledTag: {
    fontSize: 8,
    fontFamily: Fonts.plusBold,
    color: Colors.tertiary,
    marginTop: 4,
    letterSpacing: 1,
  },
  pillToggle: {
    flexDirection: 'row',
    marginHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  pill: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  pillText: {
    fontSize: 12,
    fontFamily: Fonts.plusBold,
    color: Colors.onSurfaceVariant,
  },
  activePillText: {
    color: 'white',
  },
  upiInputBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    gap: 12,
  },
  upiInput: {
    flex: 1,
    color: 'white',
    fontFamily: Fonts.plus,
  },
  whatsappPreview: {
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.2)',
  },
  whatsappBlur: {
    padding: 16,
    gap: 12,
    backgroundColor: 'rgba(74,222,128,0.05)',
  },
  whatsappText: {
    fontSize: 13,
    fontFamily: Fonts.plus,
    color: Colors.onSurface,
    lineHeight: 20,
  },
});
