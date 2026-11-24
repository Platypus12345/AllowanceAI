import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardV2Page from './pages/DashboardV2Page';
import HelpPage from './pages/HelpPage';
import SMSSyncPage from './pages/SMSSyncPage';
import V1RetiredPage from './pages/V1RetiredPage';
import ProtectedRoute from './pages/ProtectedRoute';
import AmbientBackground from './components/AmbientBackground';
import { ToastProvider } from './components/ui/Toast';
import { PWAInstallBanner } from './components/PWAInstallBanner';

// Routes whose page components still fetch v1 Mongoose endpoints. Production has no
// MONGO_URI, so those fetches 500 — the pages render an error state or nothing at all.
// They are served the V1RetiredPage holding screen instead, which says what the screen
// was and what it is waiting on. The page components stay in the tree as the reference
// for porting them (Tracker.md); they are unrouted, not deleted.
//
// Checked by hand, endpoint by endpoint, before putting anything in this list:
//   /v1                      -> /budget/stats, /expenses, /splits/pending-count
//   /jars                    -> /jars, /budget/stats
//   /wishlist                -> /wishlist, /jars
//   /wrapped                 -> /analytics/wrapped
//   /request-money           -> /requests, /friends, /allowance-requests, /user/profile
//   /profile/ai-personality  -> /user/personality
const RETIRED_V1_ROUTES = [
  '/v1',
  '/jars',
  '/wishlist',
  '/wrapped',
  '/request-money',
  '/profile/ai-personality',
];

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

          {/* v2 (PostgreSQL/Prisma) is the landing page and the whole app surface. */}
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

          {/* Static screens — no API calls at all, so they are safe to keep routed.
              Verified: neither file contains an api.get/post. */}
          <Route path="/help" element={
            <ProtectedRoute>
              <HelpPage />
            </ProtectedRoute>
          } />
          <Route path="/profile/sms-sync" element={
            <ProtectedRoute>
              <SMSSyncPage />
            </ProtectedRoute>
          } />

          {RETIRED_V1_ROUTES.map((path) => (
            <Route key={path} path={path} element={
              <ProtectedRoute>
                <V1RetiredPage />
              </ProtectedRoute>
            } />
          ))}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}


export default App;
