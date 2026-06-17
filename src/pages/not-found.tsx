import { Link } from 'wouter';
import { AlertCircle } from 'lucide-react';
import { useT } from '../context/LocaleContext';
import { Button } from '../components/ui/button';

export function NotFoundPage() {
  const t = useT();

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div
        className="w-full max-w-md rounded-xl border p-8 text-center"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <AlertCircle className="h-10 w-10 mx-auto mb-4" style={{ color: '#ef5350' }} />
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>{t('notFound.title')}</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>{t('notFound.message')}</p>
        <Link href="/">
          <Button>{t('notFound.back')}</Button>
        </Link>
      </div>
    </div>
  );
}
