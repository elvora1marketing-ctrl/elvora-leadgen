import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-6xl font-bold text-white mb-3">404</div>
      <h1 className="text-xl font-semibold text-white mb-2">Seite nicht gefunden</h1>
      <p className="text-sm text-elvora-text-dim max-w-md mb-6">
        Die angeforderte Seite existiert nicht oder wurde verschoben.
      </p>
      <Link
        href="/dashboard"
        className="px-5 py-2.5 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple/80 transition-colors"
      >
        Zum Dashboard
      </Link>
    </div>
  );
}
