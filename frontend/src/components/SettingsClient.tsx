import { useState, useEffect } from 'react';
import {
  getMe,
  getStyleGuides,
  createStyleGuide,
  deleteStyleGuide,
  type StyleGuide,
  type User,
} from '../lib/api';
import StyleGuideEditor from './StyleGuideEditor';
import Header from './Header';
import UsageDisplay from './UsageDisplay';

interface Props {
  basePath: string;
}

export default function SettingsClient({ basePath }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [styleGuides, setStyleGuides] = useState<StyleGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingGuide, setEditingGuide] = useState<StyleGuide | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userData, guidesData] = await Promise.all([
        getMe(),
        getStyleGuides(),
      ]);
      setUser(userData);
      setStyleGuides(guidesData);
    } catch (err) {
      setError('Kunne ikke indlæse data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = async () => {
    try {
      const newGuide = await createStyleGuide('Ny stilguide');
      setStyleGuides([...styleGuides, newGuide]);
      setEditingGuide(newGuide);
      setCreatingNew(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke oprette stilguide');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Er du sikker på at du vil slette denne stilguide?')) return;

    try {
      await deleteStyleGuide(id);
      setStyleGuides(styleGuides.filter(g => g.id !== id));
      if (editingGuide?.id === id) {
        setEditingGuide(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke slette stilguide');
    }
  };

  const handleGuideUpdated = (updated: StyleGuide) => {
    setStyleGuides(styleGuides.map(g => g.id === updated.id ? updated : g));
    setEditingGuide(updated);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <span className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        username={user?.username || ''}
        basePath={basePath}
        currentPage="settings"
      />

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Indstillinger</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
            <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">
              Luk
            </button>
          </div>
        )}

        {/* How-to Guide */}
        <div className="card mb-6">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold text-gray-900">Hvordan bruger jeg stilguides?</span>
            </div>
            <svg
              className={`w-5 h-5 text-gray-500 transition-transform ${showGuide ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showGuide && (
            <div className="mt-4 space-y-4 text-sm text-gray-700">
              <p>
                En stilguide hjælper AI'en med at skrive i din personlige stil. Du giver eksempler på tekster du har skrevet, og AI'en lærer din måde at formulere sig på.
              </p>

              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">Sådan kommer du i gang:</h4>
                <ol className="list-decimal list-inside space-y-2">
                  <li><strong>Klik "Opret ny"</strong> for at lave en stilguide</li>
                  <li><strong>Giv den et navn</strong> - fx "Facebook opslag" eller "Formel email"</li>
                  <li><strong>Beskriv teksttypen</strong> - hvad skal teksten bruges til?</li>
                  <li><strong>Indsæt eksempler</strong> - kopiér 3-5 tekster du har skrevet før</li>
                  <li><strong>Klik "Generér stilguide"</strong> - AI'en analyserer din stil</li>
                  <li><strong>Vælg stilguiden</strong> når du bearbejder transskriptioner</li>
                </ol>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Eksempel på teksttype/formål:</h4>
                <div className="bg-gray-100 rounded p-3 text-gray-600 italic">
                  "Opslag til min virksomheds Facebook-side. Tonen skal være venlig og imødekommende, men stadig professionel. Målet er at engagere følgere og få dem til at interagere."
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Tips til gode eksempler:</h4>
                <ul className="list-disc list-inside space-y-1">
                  <li>Vælg tekster du er tilfreds med</li>
                  <li>Brug eksempler af samme type (fx kun emails eller kun opslag)</li>
                  <li>Jo flere eksempler, jo bedre stilguide</li>
                  <li>Adskil eksempler med tomme linjer</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Usage Display */}
        <div className="mb-6">
          <UsageDisplay onError={(msg) => setError(msg)} />
        </div>

        {/* Style Guides Section */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Stilguides</h2>
            <button
              onClick={handleCreateNew}
              className="btn btn-primary text-sm"
            >
              + Opret ny
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Opret stilguides baseret på teksteksempler. Stilguiden bruges til at bearbejde transskriptioner i din personlige stil.
          </p>

          {styleGuides.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Du har ingen stilguides endnu.</p>
              <button
                onClick={handleCreateNew}
                className="mt-2 text-blue-600 hover:text-blue-700"
              >
                Opret din første stilguide
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {styleGuides.map(guide => (
                <div
                  key={guide.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    editingGuide?.id === guide.id
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setEditingGuide(guide)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{guide.name}</span>
                    {guide.is_default && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                        Standard
                      </span>
                    )}
                    {!guide.guide_content && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                        Ikke genereret
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(guide.id);
                    }}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Slet
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Style Guide Editor */}
        {editingGuide && (
          <div className="mt-6">
            <StyleGuideEditor
              guide={editingGuide}
              onUpdate={handleGuideUpdated}
              onClose={() => setEditingGuide(null)}
            />
          </div>
        )}
      </main>
    </div>
  );
}
