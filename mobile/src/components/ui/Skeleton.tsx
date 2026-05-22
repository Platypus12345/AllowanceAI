import { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet, ViewStyle } from 'react-native';

type SkeletonProps = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
};

export function Skeleton({ width = '100%', height = 16, borderRadius = 12, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width: width as ViewStyle['width'], height, borderRadius, backgroundColor: 'rgba(255,255,255,0.08)', opacity },
        style,
      ]}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <View style={styles.statCard}>
      <Skeleton width={96} height={12} />
      <Skeleton width={120} height={28} style={{ marginTop: 12 }} />
      <Skeleton width="100%" height={6} style={{ marginTop: 12 }} />
    </View>
  );
}

export function ExpenseItemSkeleton() {
  return (
    <View style={styles.expenseRow}>
      <Skeleton width={48} height={48} borderRadius={12} />
      <View style={{ flex: 1, marginLeft: 16, gap: 8 }}>
        <Skeleton width={128} height={16} />
        <Skeleton width={80} height={12} />
      </View>
      <Skeleton width={64} height={24} />
    </View>
  );
}

export function ChartSkeleton() {
  return (
    <View style={styles.chartCard}>
      <Skeleton width={160} height={24} />
      <View style={styles.chartBars}>
        {[60, 80, 45, 90, 55, 70, 85].map((h, i) => (
          <Skeleton key={i} width={32} height={h} borderRadius={8} style={{ alignSelf: 'flex-end' }} />
        ))}
      </View>
    </View>
  );
}

export function GoalCardSkeleton() {
  return (
    <View style={styles.goalCard}>
      <Skeleton width={48} height={48} borderRadius={16} />
      <Skeleton width="70%" height={20} style={{ marginTop: 16 }} />
      <Skeleton width="100%" height={8} style={{ marginTop: 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  statCard: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(45, 52, 73, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 12,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(45, 52, 73, 0.35)',
    marginBottom: 8,
  },
  chartCard: {
    padding: 24,
    borderRadius: 32,
    backgroundColor: 'rgba(45, 52, 73, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    height: 128,
    marginTop: 24,
  },
  goalCard: {
    padding: 24,
    borderRadius: 32,
    backgroundColor: 'rgba(45, 52, 73, 0.35)',
    marginBottom: 16,
  },
});
