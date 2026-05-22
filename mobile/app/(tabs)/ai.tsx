import { useCallback, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { MaterialIcons } from '@expo/vector-icons';
import { postAiAsk } from '@/src/api/budgetClient';
import { Colors, Fonts } from '@/constants/theme';
import TopAppBar from '@/components/TopAppBar';

type Msg = { id: string; role: 'user' | 'ai'; text: string };

const QUICK_PROMPTS = [
  'Can I eat out today?',
  'How much can I spend?',
  'Am I on budget?',
  'Savings tips',
];

export default function AIScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const scrollViewRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: '0',
      role: 'ai',
      text: 'Hi! Ask anything about your allowance and spending. I use your live budget from the server.',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || sending) return;
      
      const userMsg: Msg = { id: String(Date.now()), role: 'user', text: q };
      setMessages((m) => [...m, userMsg]);
      setInput('');
      setSending(true);
      
      try {
        const answer = await postAiAsk(q);
        setMessages((m) => [...m, { id: String(Date.now() + 1), role: 'ai', text: answer }]);
      } catch (e: unknown) {
        setMessages((m) => [
          ...m,
          { id: String(Date.now() + 2), role: 'ai', text: 'Oops! I am having trouble connecting to the brain. Please try again later.' },
        ]);
      } finally {
        setSending(false);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }
    },
    [sending]
  );

  return (
    <SafeAreaView edges={['left', 'right']} style={{ flex: 1 }}>
      <TopAppBar />
      <View style={{ flex: 1, paddingTop: 80 }}>
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.aiAvatar}>
              <MaterialIcons name="smart-toy" size={20} color={Colors.primary} />
              <View style={styles.onlineStatus} />
            </View>
            <View>
              <Text style={styles.headerTitle}>AI Assistant</Text>
              <Text style={styles.headerSubtitle}>Online</Text>
            </View>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 20 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.messageRow,
                  msg.role === 'user' ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }
                ]}
              >
                {msg.role === 'ai' && (
                  <View style={[styles.msgAvatar, { backgroundColor: `${Colors.secondary}20` }]}>
                    <MaterialIcons name="smart-toy" size={16} color={Colors.secondary} />
                  </View>
                )}
                <View
                  style={[
                    styles.messageBubble,
                    msg.role === 'user'
                      ? { backgroundColor: `${Colors.primary}20`, borderBottomRightRadius: 4 }
                      : { backgroundColor: `${Colors.secondary}15`, borderBottomLeftRadius: 4 }
                  ]}
                >
                  <Text style={[
                    styles.messageText,
                    { color: Colors.onSurface }
                  ]}>
                    {msg.text}
                  </Text>
                </View>
                {msg.role === 'user' && (
                  <View style={[styles.msgAvatar, { backgroundColor: `${Colors.primary}20` }]}>
                    <MaterialIcons name="person" size={16} color={Colors.primary} />
                  </View>
                )}
              </View>
            ))}
            {sending && (
              <View style={styles.typingIndicator}>
                <ActivityIndicator color={Colors.secondary} size="small" />
                <Text style={styles.typingText}>Thinking...</Text>
              </View>
            )}
          </ScrollView>

          {/* Bottom Section */}
          <View style={{ paddingHorizontal: 20, paddingBottom: tabBarHeight + 100 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
              {QUICK_PROMPTS.map((prompt) => (
                <TouchableOpacity
                  key={prompt}
                  onPress={() => send(prompt)}
                  style={styles.quickPrompt}
                >
                  <Text style={styles.quickPromptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.inputContainer}>
              <BlurView intensity={20} tint="dark" style={styles.inputBlur}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Ask about your finances..."
                  placeholderTextColor={Colors.onSurfaceVariant}
                  style={styles.textInput}
                  editable={!sending}
                  onSubmitEditing={() => send(input)}
                />
                <TouchableOpacity
                  disabled={sending || !input.trim()}
                  onPress={() => send(input)}
                  style={[styles.sendButton, { opacity: (sending || !input.trim()) ? 0.5 : 1 }]}
                >
                  <MaterialIcons name="send" size={20} color="white" />
                </TouchableOpacity>
              </BlurView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  chatHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(128, 131, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  onlineStatus: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.secondary,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: Fonts.plusExtraBold,
    color: Colors.onSurface,
  },
  headerSubtitle: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    color: Colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-end',
    gap: 8,
  },
  msgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  messageText: {
    fontSize: 15,
    fontFamily: Fonts.plus,
    lineHeight: 22,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  typingText: {
    color: Colors.onSurfaceVariant,
    fontSize: 13,
    fontFamily: Fonts.plus,
  },
  quickPrompt: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(68, 226, 205, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(68, 226, 205, 0.2)',
  },
  quickPromptText: {
    color: Colors.secondary,
    fontFamily: Fonts.plusBold,
    fontSize: 13,
  },
  inputContainer: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 12,
    color: Colors.onSurface,
    fontFamily: Fonts.plus,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
