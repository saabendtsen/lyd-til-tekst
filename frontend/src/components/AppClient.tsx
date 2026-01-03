import { useState, useEffect } from 'react';
import { getMe, type User, type Transcription } from '../lib/api';
import Header from './Header';
import UploadForm from './UploadForm';
import TranscriptionView from './TranscriptionView';

interface Props {
  basePath: string;
}

export default function AppClient({ basePath }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [transcription, setTranscription] = useState<Transcription | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const me = await getMe();
      if (!me) {
        window.location.href = basePath;
        return;
      }
      setUser(me);
    } catch {
      window.location.href = basePath;
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
      <Header username={user.username} basePath={basePath} currentPage="app" />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {transcription ? (
          <TranscriptionView
            transcription={transcription}
            onUpdate={(updated) => setTranscription(updated)}
            onBack={() => setTranscription(null)}
          />
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Upload lydfil
              </h1>
              <p className="text-gray-600">
                Vælg en lydfil og få den transskriberet til tekst
              </p>
            </div>

            <div className="card">
              <UploadForm onTranscribed={(t) => setTranscription(t)} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
