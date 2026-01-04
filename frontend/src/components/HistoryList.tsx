import { useState, useEffect } from 'react';
import { getTranscriptions, deleteTranscription, type Transcription } from '../lib/api';

interface Props {
  onSelect: (transcription: Transcription) => void;
}

export default function HistoryList({ onSelect }: Props) {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    loadTranscriptions();
  }, []);

  const loadTranscriptions = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getTranscriptions();
      setTranscriptions(data?.transcriptions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke hente historik');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Er du sikker på du vil slette denne transskription?')) {
      return;
    }

    setDeleting(id);
    const previousError = error;
    try {
      await deleteTranscription(id);
      setTranscriptions((prev) => prev.filter((t) => t.id !== id));
      setError(''); // Clear any previous error on success
    } catch (err) {
      // Show error without replacing the list view
      setError(err instanceof Error ? err.message : 'Kunne ikke slette');
      // Auto-clear the error after 3 seconds
      setTimeout(() => setError(previousError), 3000);
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('da-DK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateText = (text: string, maxLength = 100) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="spinner" />
        <span className="ml-2 text-gray-600">Henter historik...</span>
      </div>
    );
  }

  if (error && transcriptions.length === 0) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error}
        <button
          onClick={loadTranscriptions}
          className="ml-2 underline hover:no-underline"
        >
          Prøv igen
        </button>
      </div>
    );
  }

  if (transcriptions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="font-medium text-gray-900 mb-1">Ingen transskriptioner endnu</h3>
        <p className="text-gray-500 text-sm">
          Upload din første lydfil for at komme i gang
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transcriptions.map((t) => (
        <div
          key={t.id}
          onClick={() => onSelect(t)}
          className="card cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {t.filename && (
                  <span className="font-medium text-gray-900 truncate">
                    {t.filename}
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {t.duration_formatted}
                </span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-2">
                {truncateText(t.raw_text)}
              </p>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                <span>{formatDate(t.created_at)}</span>
                {t.processed_text && (
                  <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                    Bearbejdet
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={(e) => handleDelete(t.id, e)}
              disabled={deleting === t.id}
              className="text-gray-400 hover:text-red-600 p-1"
              title="Slet"
            >
              {deleting === t.id ? (
                <span className="spinner !h-4 !w-4 !border-red-600" />
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
