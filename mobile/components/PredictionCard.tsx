import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { CalendarClock, ArrowRight } from 'lucide-react-native';
import { fetchPrediction } from '@/src/api/budgetClient';

export function PredictionCard() {
  const router = useRouter();
  const [pred, setPred] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchPrediction();
        setPred(data);
      } catch (e) {
        // error
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  if (loading || !pred) {
    return (
      <View className="rounded-[20px] overflow-hidden mb-8 h-20">
        <BlurView intensity={20} tint="dark" className="bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-[20px] flex-1 justify-center items-center">
          <ActivityIndicator color="#38bdf8" />
        </BlurView>
      </View>
    );
  }

  let colorClass = 'bg-emerald-500/10 border-emerald-500/30';
  let iconColor = '#10b981';
  let textColor = 'text-emerald-400';
  let title = 'On Track';
  let desc = 'Your money will last the month';

  if (pred.willRunOut) {
    if (pred.safeDays < 5) {
      colorClass = 'bg-red-500/10 border-red-500/30';
      iconColor = '#ef4444';
      textColor = 'text-red-400';
      title = 'Danger';
    } else {
      colorClass = 'bg-amber-500/10 border-amber-500/30';
      iconColor = '#f59e0b';
      textColor = 'text-amber-400';
      title = 'Tight Budget';
    }
    desc = `Money lasts until ${new Date(pred.projectedRunoutDate).toLocaleDateString()}`;
  }

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => router.push('/prediction')} className="mb-8">
      <View className="rounded-[20px] overflow-hidden">
        <BlurView intensity={20} tint="dark" className={`border ${colorClass} rounded-[20px] p-4 flex-row items-center justify-between`}>
          <View className="flex-row items-center flex-1">
            <View className="p-2 rounded-xl mr-3 bg-white/5">
              <CalendarClock color={iconColor} size={24} />
            </View>
            <View>
              <Text className={`${textColor} font-bold text-base`}>{title}</Text>
              <Text className="text-slate-300 text-xs mt-0.5">{desc}</Text>
            </View>
          </View>
          <View className="bg-white/5 p-2 rounded-full">
            <ArrowRight color={iconColor} size={16} />
          </View>
        </BlurView>
      </View>
    </TouchableOpacity>
  );
}
