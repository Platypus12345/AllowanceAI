import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { api } from '../api/http';

const QUEUE_KEY = 'offline_request_queue';

interface OfflineRequest {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'DELETE';
  data?: any;
  timestamp: number;
}

export async function addToQueue(request: Omit<OfflineRequest, 'id' | 'timestamp'>) {
  const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
  const queue: OfflineRequest[] = queueJson ? JSON.parse(queueJson) : [];
  
  const newRequest: OfflineRequest = {
    ...request,
    id: Math.random().toString(36).substring(7),
    timestamp: Date.now()
  };
  
  queue.push(newRequest);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function processQueue() {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return;

  const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
  if (!queueJson) return;

  const queue: OfflineRequest[] = JSON.parse(queueJson);
  if (queue.length === 0) return;

  console.log(`Processing offline queue: ${queue.length} items`);

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
      remainingQueue.push(req); // Keep in queue to retry later
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
}

export function startSyncListener() {
  NetInfo.addEventListener(state => {
    if (state.isConnected) {
      void processQueue();
    }
  });
}

export async function getQueueCount() {
  const queueJson = await AsyncStorage.getItem(QUEUE_KEY);
  if (!queueJson) return 0;
  return JSON.parse(queueJson).length;
}
