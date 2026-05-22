import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const baseURL = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:5000';

export const api = axios.create({
  baseURL,
  timeout: 30_000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    if (status === 401) {
      await AsyncStorage.multiRemove(['authToken', 'userData']);
    }
    if (status >= 500) {
      console.error('Server error:', error.response?.data?.message);
    }
    return Promise.reject(error);
  }
);
