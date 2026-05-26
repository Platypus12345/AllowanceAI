import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { 
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold 
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold
} from '@expo-google-fonts/space-grotesk';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { View } from 'react-native';
import AmbientBackground from '@/components/AmbientBackground';

import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SMSProvider } from '@/src/context/SMSContext';
import { ToastProvider } from '@/src/context/ToastContext';
import { startSyncListener } from '@/src/services/offlineSync';

import * as Notifications from 'expo-notifications';
import { updatePushToken } from '@/src/api/budgetClient';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotificationsAsync() {
  let token;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return;
  }
  token = (await Notifications.getExpoPushTokenAsync({
    projectId: '07f0211b-b656-494e-bbfd-dc7d5494c8bd',
  })).data;

  return token;
}

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    startSyncListener();
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        updatePushToken(token).catch(console.error);
      }
    });
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SMSProvider>
          <ToastProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <View style={{ flex: 1, backgroundColor: 'transparent' }}>
              <AmbientBackground />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: 'transparent' },
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                <Stack.Screen name="sms-log" options={{ headerShown: false }} />
                <Stack.Screen name="ai-personality" options={{ headerShown: false }} />
                <Stack.Screen name="help" options={{ headerShown: false }} />
                <Stack.Screen name="request-money" options={{ headerShown: false }} />
                <Stack.Screen name="splits" options={{ headerShown: false }} />
                <Stack.Screen name="jars" options={{ headerShown: false }} />
                <Stack.Screen name="wishlist" options={{ headerShown: false }} />
                <Stack.Screen name="sms-sync" options={{ headerShown: false }} />
                <Stack.Screen
                  name="login"
                  options={{ headerShown: false }}
                />

                <Stack.Screen
                  name="add-expense"
                  options={{ presentation: 'modal', headerShown: false }}
                />
                <Stack.Screen name="wrapped" options={{ headerShown: false }} />
              </Stack>
            </View>
            <StatusBar style="light" />
          </ThemeProvider>
          </ToastProvider>
        </SMSProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
