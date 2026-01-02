import { useState, useEffect } from 'react';
import { getUsageSummary, type UsageSummary } from '../lib/api';

// Markup factor for pricing (2x = 100% margin)
const MARKUP_FACTOR = 2.0;

interface Props {
  onError?: (error: string) => void;
}

export default function UsageDisplay({ onError }: Props) {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    try {
      const data = await getUsageSummary();
      setSummary(data);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Kunne ikke hente forbrug');
    } finally {
      setLoading(false);
    }
  };

  const formatDKK = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatOperation = (op: string) => {
    const labels: Record<string, string> = {
      'transcribe': 'Transskription',
      'process': 'Tekstbearbejdning',
      'generate_style': 'Stilguide-generering',
    };
    return labels[op] || op;
  };

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    return `${months[parseInt(m) - 1]} ${year}`;
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-4">
          <span className="spinner" />
        </div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const userPrice = summary.total_cost_dkk * MARKUP_FACTOR;
  const hasUsage = summary.total_requests > 0;

  return (
    <div className="card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="font-semibold text-gray-900">Dit forbrug</span>
          {hasUsage && (
            <span className="text-sm font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">
              {formatDKK(userPrice)}
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-4 space-y-4">
          {!hasUsage ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Du har ikke brugt nogen API-kald endnu.
            </p>
          ) : (
            <>
              {/* Demo pricing notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Demo-periode:</strong> Dette er hvad det ville koste dig med vores prissætning.
                  Ingen betaling endnu - vi tester priser.
                </p>
              </div>

              {/* Total summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Din pris</p>
                    <p className="text-2xl font-bold text-gray-900">{formatDKK(userPrice)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Antal kald</p>
                    <p className="text-2xl font-bold text-gray-900">{summary.total_requests}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  API-omkostning: {formatDKK(summary.total_cost_dkk)} (kurs: {summary.exchange_rate} DKK/USD)
                </p>
              </div>

              {/* By operation */}
              {summary.by_operation.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Fordelt på type</h4>
                  <div className="space-y-2">
                    {summary.by_operation.map((op) => (
                      <div key={op.operation} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">{formatOperation(op.operation)}</span>
                        <span className="text-gray-900">
                          {op.count} kald · {formatDKK(op.total_cost_dkk * MARKUP_FACTOR)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* By month */}
              {summary.by_month.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Fordelt på måned</h4>
                  <div className="space-y-2">
                    {summary.by_month.map((month) => (
                      <div key={month.month} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">{formatMonth(month.month)}</span>
                        <span className="text-gray-900">
                          {month.count} kald · {formatDKK(month.total_cost_dkk * MARKUP_FACTOR)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
