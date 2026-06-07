import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch } from 'wouter';
import { MarketProvider } from './context/MarketContext';
import { HomePage } from './pages/HomePage';
import { CoinDetailPage } from './pages/CoinDetailPage';
import { NotFoundPage } from './pages/not-found';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MarketProvider>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/coin/:symbol" component={CoinDetailPage} />
          <Route component={NotFoundPage} />
        </Switch>
      </MarketProvider>
    </QueryClientProvider>
  );
}
