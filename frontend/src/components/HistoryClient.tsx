import { useState, useEffect } from 'react';
import { getMe, type User, type Transcription } from '../lib/api';
import Header from './Header';
import HistoryList from './HistoryList';
import TranscriptionView from './TranscriptionView';

interface Props {
  basePath: string;
}

export default function HistoryClient({ basePath }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTranscription, setSelectedTranscription] = useState<Transcription | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const me = await getMe();
      if (!me) {
        // Only redirect to relative paths to prevent open redirect
        if (basePath.startsWith('/') && !basePath.startsWith('//')) {
          window.location.href = basePath;
        }
        return;
      }
      setUser(me);
    } catch (err) {
      console.error('Kunne ikke hente brugerdata:', err);
      if (basePath.startsWith('/') && !basePath.startsWith('//')) {
        window.location.href = basePath;
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="spinner" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header username={user.username} basePath={basePath} currentPage="history" />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {selectedTranscription ? (
          <TranscriptionView
            transcription={selectedTranscription}
            onUpdate={setSelectedTranscription}
            onBack={() => setSelectedTranscription(null)}
          />
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Historik
              </h1>
              <p className="text-gray-600">
                Dine tidligere transskriptioner
              </p>
            </div>

            <HistoryList onSelect={setSelectedTranscription} />
          </div>
        )}
      </main>
    </div>
  );
}
