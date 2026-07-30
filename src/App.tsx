import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Route, Switch } from 'wouter';
import { AuthProvider } from './context/AuthContext';
import { LocaleProvider } from './context/LocaleContext';
import { MarketProvider } from './context/MarketContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AccessGate } from './components/auth/AccessGate';
import { HomePage } from './pages/HomePage';
import { CoinDetailPage } from './pages/CoinDetailPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { NotFoundPage } from './pages/not-found';

const queryClient = new QueryClient();

function AuthenticatedApp() {
  // MarketProvider lives INSIDE the auth guard: unauthenticated visitors must
  // not boot the whole market pipeline (WebSocket + kline batches) just to be
  // redirected to /login a frame later.
  return (
    <ProtectedRoute>
      <MarketProvider>
        <Switch>
          <Route path="/dashboard" component={DashboardPage} />
          <Route path="/" component={HomePage} />
          <Route path="/coin/:symbol" component={CoinDetailPage} />
          <Route path="/asset/:type/:symbol" component={AssetDetailPage} />
          <Route component={NotFoundPage} />
        </Switch>
      </MarketProvider>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="crypto-scanner-theme">
      <QueryClientProvider client={queryClient}>
        <AccessGate>
          <AuthProvider>
            <LocaleProvider>
              <Switch>
                <Route path="/login" component={LoginPage} />
                <Route path="/register" component={RegisterPage} />
                <Route>
                  <AuthenticatedApp />
                </Route>
              </Switch>
            </LocaleProvider>
          </AuthProvider>
        </AccessGate>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
