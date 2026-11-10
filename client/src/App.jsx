import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import DashboardV2Page from './pages/DashboardV2Page';
import AIPersonalityPage from './pages/AIPersonalityPage';
import HelpPage from './pages/HelpPage';
import RequestMoneyPage from './pages/RequestMoneyPage';
import SMSSyncPage from './pages/SMSSyncPage';
import ProtectedRoute from './pages/ProtectedRoute';
import AmbientBackground from './components/AmbientBackground';
import { ToastProvider } from './components/ui/Toast';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import WrappedPage from './pages/WrappedPage';
import JarsPage from './pages/JarsPage';
import WishlistPage from './pages/WishlistPage';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <AmbientBackground />
      <PWAInstallBanner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          {/* v2 (PostgreSQL/Prisma) is the landing page. The v1 dashboard below reads
              /budget/stats and /expenses, which are Mongoose routes — with MONGO_URI
              removed in production they 500, so it must not be what a user lands on. */}
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <DashboardV2Page />
            </ProtectedRoute>
          } />
          <Route path="/" element={
            <ProtectedRoute>
              <DashboardV2Page />
            </ProtectedRoute>
          } />
          {/* Kept reachable for reference until the v1 screens are ported or removed
              (see Tracker.md Backlog). Will not work without MONGO_URI. */}
          <Route path="/v1" element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } />
          <Route path="/profile/ai-personality" element={
            <ProtectedRoute>
              <AIPersonalityPage />
            </ProtectedRoute>
          } />
          <Route path="/help" element={
            <ProtectedRoute>
              <HelpPage />
            </ProtectedRoute>
          } />
          <Route path="/request-money" element={
            <ProtectedRoute>
              <RequestMoneyPage />
            </ProtectedRoute>
          } />
          <Route path="/profile/sms-sync" element={
            <ProtectedRoute>
              <SMSSyncPage />
            </ProtectedRoute>
          } />
          <Route path="/wrapped" element={
            <ProtectedRoute>
              <WrappedPage />
            </ProtectedRoute>
          } />
          <Route path="/jars" element={
            <ProtectedRoute>
              <JarsPage />
            </ProtectedRoute>
          } />
          <Route path="/wishlist" element={
            <ProtectedRoute>
              <WishlistPage />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}


export default App;
