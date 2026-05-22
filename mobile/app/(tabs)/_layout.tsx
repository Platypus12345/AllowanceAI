import { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Keyboard } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Fonts } from '../../constants/theme';

function TabIcon({ name, focused, color }: { name: string; focused: boolean; color: string }) {
  const scale = useRef(new Animated.Value(focused ? 1.1 : 1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.1 : 1,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, [focused, scale]);

  return (
    <Animated.View style={{ alignItems: 'center', transform: [{ scale }] }}>
      <MaterialIcons name={name as keyof typeof MaterialIcons.glyphMap} size={24} color={color} />
      {focused && <View style={styles.activeDot} />}
    </Animated.View>
  );
}

function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBarContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <BlurView intensity={40} tint="dark" style={styles.blurBackground} />
      <View style={styles.tabItemsContainer}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
                ? options.title
                : route.name;
          const isFocused = state.index === index;

          const onPress = () => {
            Keyboard.dismiss();
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          if (route.name === 'ai') {
            return (
              <View key={route.key} style={styles.fabContainer}>
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    navigation.navigate('ai');
                  }}
                  activeOpacity={0.8}
                  style={[styles.fabButton, isFocused && styles.fabButtonActive]}
                >
                  <MaterialIcons name="auto_awesome" size={28} color="white" />
                </TouchableOpacity>
                <Text style={[styles.fabLabel, isFocused && { color: Colors.onSurface }]}>Ask AI</Text>
              </View>
            );
          }

          const icons: Record<string, string> = {
            index: 'dashboard',
            expenses: 'payments',
            goals: 'track_changes',
            profile: 'account_circle',
          };

          return (
            <TouchableOpacity key={route.key} onPress={onPress} style={styles.tabItem} activeOpacity={0.7}>
              <TabIcon
                name={icons[route.name] || 'circle'}
                focused={isFocused}
                color={isFocused ? Colors.primary : Colors.onSurfaceVariant}
              />
              <Text style={[styles.tabLabel, { color: isFocused ? Colors.onSurface : Colors.onSurfaceVariant }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="expenses" options={{ title: 'Spend' }} />
      <Tabs.Screen name="ai" options={{ title: 'Ask AI' }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  blurBackground: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
  },
  tabItemsContainer: {
    flexDirection: 'row',
    height: 80,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    fontWeight: '600',
    marginTop: 2,
  },
  activeDot: {
    width: 4,
    height: 4,
    backgroundColor: '#44e2cd',
    borderRadius: 2,
    marginTop: 2,
  },
  fabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    position: 'relative',
    top: -24,
  },
  fabButton: {
    width: 60,
    height: 60,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 4,
    borderColor: '#0b1326',
  },
  fabButtonActive: {
    transform: [{ scale: 1.1 }],
    shadowOpacity: 0.6,
  },
  fabLabel: {
    fontSize: 10,
    fontFamily: Fonts.plusBold,
    marginTop: 6,
    color: Colors.onSurfaceVariant,
  },
});
