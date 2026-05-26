import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/http';

const QUEUE_KEY = 'offline_request_queue';

interface OfflineRequest {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  data?: unknown;
  timestamp: number;
}

/** Uses expo-network (Expo module). Falls back to "online" if native module unavailable. */
async function isDeviceOnline(): Promise<boolean> {
  try {
    const Network = await import('expo-network');
    const state = await Network.getNetworkStateAsync();
    return state.isConnected ?? state.isInternetReachable ?? true;
  } catch {
    return true;
  }
}

export async function addToQueue(request: Omit<OfflineRequest, 'id' | 'timestamp'>) {
  const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
  const queue: OfflineRequest[] = queueJson ? JSON.parse(queueJson) : [];

  const newRequest: OfflineRequest = {
    ...request,
    id: Math.random().toString(36).substring(7),
    timestamp: Date.now(),
  };

  queue.push(newRequest);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function processQueue() {
  const online = await isDeviceOnline();
  if (!online) return;

  const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
  if (!queueJson) return;

  const queue: OfflineRequest[] = JSON.parse(queueJson);
  if (queue.length === 0) return;

  const remainingQueue: OfflineRequest[] = [];

  for (const req of queue) {
    try {
      if (req.method === 'POST') {
        await api.post(req.url, req.data);
      } else if (req.method === 'PUT') {
        await api.put(req.url, req.data);
      } else if (req.method === 'DELETE') {
        await api.delete(req.url);
      }
    } catch (error) {
      console.error('Failed to process offline request', req.url, error);
      remainingQueue.push(req);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
}

export function startSyncListener() {
  void import('expo-network')
    .then((Network) => {
      Network.addNetworkStateListener((state) => {
        if (state.isConnected ?? state.isInternetReachable) {
          void processQueue();
        }
      });
      void processQueue();
    })
    .catch(() => {
      // Dev build missing native module — offline queue still works when user retries manually
    });
}

export async function getQueueCount() {
  const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
  if (!queueJson) return 0;
  return JSON.parse(queueJson).length;
}
