import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Route, Switch } from 'wouter';
import { AuthProvider } from './context/AuthContext';
import { LocaleProvider } from './context/LocaleContext';
import { MarketProvider } from './context/MarketContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { HomePage } from './pages/HomePage';
import { CoinDetailPage } from './pages/CoinDetailPage';
import { AssetDetailPage } from './pages/AssetDetailPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { NotFoundPage } from './pages/not-found';

const queryClient = new QueryClient();

function AuthenticatedApp() {
  return (
    <MarketProvider>
      <Switch>
        <Route path="/dashboard">
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        </Route>
        <Route path="/">
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        </Route>
        <Route path="/coin/:symbol">
          <ProtectedRoute>
            <CoinDetailPage />
          </ProtectedRoute>
        </Route>
        <Route path="/asset/:type/:symbol">
          <ProtectedRoute>
            <AssetDetailPage />
          </ProtectedRoute>
        </Route>
        <Route component={NotFoundPage} />
      </Switch>
    </MarketProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="crypto-scanner-theme">
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </ThemeProvider>
  );
}
