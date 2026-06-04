import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MarketProvider } from './context/MarketContext';
import { HomePage } from './pages/HomePage';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MarketProvider>
        <HomePage />
      </MarketProvider>
    </QueryClientProvider>
  );
}
