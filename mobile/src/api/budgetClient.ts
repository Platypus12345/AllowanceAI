import { api } from '@/src/api/http';
import { addToQueue } from '@/src/services/offlineSync';

export type ExpenseCategory =
  | 'Food'
  | 'Transport'
  | 'Shopping'
  | 'Entertainment'
  | 'Health'
  | 'Other';

export type SurvivalStatus = {
  safetyScore: number;
  status: 'safe' | 'tight' | 'danger';
  message: string;
  badgeLabel: string;
  projectedLeftover: number;
  leftoverMessage: string;
  ringColor: string;
  dailyLimit: number;
};

export type BudgetStats = {
  totalAllowance: number;
  spentAmount: number;
  remainingBalance: number;
  dailyLimit: number;
  chartData: { name: string; value: number }[];
  daysLeftInMonth: number;
  survival?: SurvivalStatus;
};

export type ExpenseRow = {
  _id: string;
  amount: number;
  category: ExpenseCategory;
  description?: string;
  date: string;
};

export type GoalProgressRow = {
  category: ExpenseCategory;
  limit: number | null;
  spent: number;
  percentage: number | null;
  status: 'safe' | 'warning' | 'danger' | 'none';
};

export type GoalsProgressResponse = {
  month: number;
  year: number;
  progress: GoalProgressRow[];
};

export type UserMe = {
  _id: string;
  name: string;
  email: string;
  allowance: number;
  upiId?: string | null;
  upiName?: string | null;
};

export type FriendRow = {
  _id: string;
  name: string;
  upiId: string;
  phone?: string | null;
  avatar?: string;
  totalOwed: number;
};

export type SplitRow = {
  _id: string;
  friendId: string;
  friendName: string;
  friendUpiId: string;
  description: string;
  totalAmount: number;
  yourShare: number;
  friendShare: number;
  splitType: string;
  status: string;
  category: string;
  settledAt?: string;
  lastRemindedAt?: string;
};

export type SplitsResponse = {
  pending: SplitRow[];
  settled: SplitRow[];
  totalOwedToYou: number;
  totalYouOwe: number;
  peopleOweYou: number;
};

export async function fetchBudgetStats(): Promise<BudgetStats> {
  const { data } = await api.get<BudgetStats>('/api/budget/stats');
  return data;
}

export async function fetchGoalsProgress(): Promise<GoalsProgressResponse> {
  const { data } = await api.get<GoalsProgressResponse>('/api/budget/goals/progress');
  return data;
}

export async function fetchExpenses(): Promise<ExpenseRow[]> {
  const { data } = await api.get<ExpenseRow[]>('/api/expenses');
  return data;
}

export async function postExpense(payload: {
  amount: number;
  category: ExpenseCategory;
  description?: string;
  force?: boolean;
}) {
  try {
    const { data } = await api.post<ExpenseRow>('/api/expenses', payload);
    return data;
  } catch (error: any) {
    // If network error (no response or status 0), add to offline queue
    if (!error.response || error.status === 0) {
      await addToQueue({
        url: '/api/expenses',
        method: 'POST',
        data: payload
      });
      // Return a "fake" response for optimistic UI
      return {
        _id: 'offline_' + Math.random().toString(36).substring(7),
        ...payload,
        date: new Date().toISOString(),
        isOffline: true
      } as any;
    }
    throw error;
  }
}

export async function deleteExpense(id: string) {
  await api.delete(`/api/expenses/${id}`);
}

export async function putAllowance(allowance: number) {
  const { data } = await api.put<{ allowance: number }>('/api/budget/allowance', {
    allowance,
  });
  return data;
}

export async function fetchMe(): Promise<UserMe> {
  const { data } = await api.get<UserMe>('/api/auth/me');
  return data;
}

export async function postAiAsk(question: string): Promise<string> {
  const { data } = await api.post<{ answer: string }>('/api/ai/ask', { question });
  return data.answer;
}

export async function fetchPrediction() {
  const { data } = await api.get('/api/budget/prediction');
  return data;
}

export async function fetchReport() {
  const { data } = await api.get('/api/budget/report');
  return data;
}

export async function postAiPredict(payload: any) {
  const { data } = await api.post('/api/ai/predict', payload);
  return data;
}

export async function postAiTips(payload: any) {
  const { data } = await api.post('/api/ai/tips', payload);
  return data;
}

export async function postAllowanceRequest(payload: { amount: number, reason: string, parentPhone: string }) {
  const { data } = await api.post('/api/allowance-requests', payload);
  return data;
}

export async function fetchUserProfile() {
  const { data } = await api.get('/api/user/profile');
  return data.user;
}

export async function putUserUpi(payload: { upiId: string; upiName?: string }) {
  const { data } = await api.put('/api/user/upi', payload);
  return data;
}

export async function fetchFriends(): Promise<FriendRow[]> {
  const { data } = await api.get<FriendRow[]>('/api/friends');
  return data;
}

export async function postFriend(payload: { name: string; upiId: string; phone?: string }) {
  const { data } = await api.post<FriendRow>('/api/friends', payload);
  return data;
}

export async function fetchSplits(): Promise<SplitsResponse> {
  const { data } = await api.get<SplitsResponse>('/api/splits');
  return data;
}

export async function postSplit(payload: Record<string, unknown>) {
  const { data } = await api.post('/api/splits', payload);
  return data;
}

export async function settleSplit(id: string) {
  const { data } = await api.put(`/api/splits/${id}/settle`);
  return data;
}

export async function deleteSplit(id: string) {
  const { data } = await api.delete(`/api/splits/${id}`);
  return data;
}

export async function remindSplit(id: string) {
  const { data } = await api.post(`/api/splits/${id}/remind`);
  return data;
}

export async function fetchPendingSplitCount() {
  const { data } = await api.get<{ count: number }>('/api/splits/pending-count');
  return data.count;
}

export async function fetchLinkedParents() {
  const { data } = await api.get('/api/allowance/linked-parents');
  return data;
}

export async function fetchMoneyRequests() {
  const { data } = await api.get('/api/requests');
  return data;
}

export async function postUpiCollect(payload: { friendId: string; amount: number; note: string; senderUpiId?: string }) {
  const { data } = await api.post('/api/requests/upi-collect', payload);
  return data;
}

export async function postWhatsAppRequest(payload: { friendId: string; amount: number; note: string; senderUpiId?: string }) {
  const { data } = await api.post('/api/requests/whatsapp', payload);
  return data;
}

export async function fetchJars() {
  const { data } = await api.get('/api/jars');
  return data;
}

export async function postJar(payload: Record<string, unknown>) {
  const { data } = await api.post('/api/jars', payload);
  return data;
}

export async function contributeJar(id: string, amount: number, note?: string) {
  const { data } = await api.post(`/api/jars/${id}/contribute`, { amount, note });
  return data;
}

export async function fetchJarSuggest() {
  const { data } = await api.get('/api/jars/suggest');
  return data;
}

export async function fetchWishlist() {
  const { data } = await api.get('/api/wishlist');
  return data;
}

export async function previewWishlistUrl(productUrl: string) {
  const { data } = await api.post('/api/wishlist/preview', { productUrl });
  return data;
}

export async function postWishlistItem(payload: Record<string, unknown>) {
  const { data } = await api.post('/api/wishlist', payload);
  return data;
}

export async function checkWishlistItem(id: string) {
  const { data } = await api.post(`/api/wishlist/${id}/check-one`);
  return data;
}

export async function fetchRecurring() {

  const { data } = await api.get('/api/recurring');
  return data;
}

export async function postRecurring(payload: { amount: number, category: string, description: string, frequency: string, nextDate: string }) {
  const { data } = await api.post('/api/recurring', payload);
  return data;
}

export async function deleteRecurring(id: string) {
  const { data } = await api.delete(`/api/recurring/${id}`);
  return data;
}

export async function updatePushToken(token: string) {
  const { data } = await api.post('/api/notifications/token', { token });
  return data;
}

export async function fetchGamificationStats() {
  const { data } = await api.get('/api/gamification/stats');
  return data;
}

export async function fetchAnalytics() {
  const { data } = await api.get('/api/budget/analytics');
  return data;
}

export async function updatePreferences(preferences: { aiPersonality?: string }) {
  const { data } = await api.put('/api/user/preferences', preferences);
  return data;
}

