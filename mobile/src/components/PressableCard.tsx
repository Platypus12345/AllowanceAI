import { useRef } from 'react';
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

type Props = PressableProps & {
  style?: StyleProp<ViewStyle>;
  haptic?: 'light' | 'medium' | 'success' | 'error';
  children: React.ReactNode;
};

export function PressableCard({ style, haptic = 'light', children, onPress, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
    if (haptic === 'medium') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 3 }).start();
  };

  const handlePress = (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    if (haptic === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (haptic === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    onPress?.(e);
  };

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut} onPress={handlePress} {...rest}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
