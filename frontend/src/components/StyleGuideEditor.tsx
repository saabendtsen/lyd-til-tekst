import { useState } from 'react';
import {
  updateStyleGuide,
  generateStyleGuide,
  setDefaultStyleGuide,
  type StyleGuide,
} from '../lib/api';

interface Props {
  guide: StyleGuide;
  onUpdate: (updated: StyleGuide) => void;
  onClose: () => void;
}

export default function StyleGuideEditor({ guide, onUpdate, onClose }: Props) {
  const [name, setName] = useState(guide.name);
  const [description, setDescription] = useState(guide.description || '');
  const [examples, setExamples] = useState(guide.examples || '');
  const [guideContent, setGuideContent] = useState(guide.guide_content || '');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updated = await updateStyleGuide(guide.id, {
        name,
        description,
        examples,
        guide_content: guideContent,
      });
      onUpdate(updated);
      setSuccess('Stilguide gemt');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke gemme');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!examples.trim()) {
      setError('Tilføj teksteksempler før du genererer');
      return;
    }

    // Save current state first
    await handleSave();

    setGenerating(true);
    setError('');

    try {
      const updated = await generateStyleGuide(guide.id);
      setGuideContent(updated.guide_content || '');
      onUpdate(updated);
      setSuccess('Stilguide genereret!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke generere stilguide');
    } finally {
      setGenerating(false);
    }
  };

  const handleSetDefault = async () => {
    try {
      const updated = await setDefaultStyleGuide(guide.id);
      onUpdate(updated);
      setSuccess('Sat som standard');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke sætte som standard');
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Rediger stilguide</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Navn
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="F.eks. 'Formel email' eller 'Facebook opslag'"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Teksttype / Formål
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="textarea"
            rows={2}
            placeholder="Beskriv hvad teksten skal bruges til, f.eks.:
- Opslag til Facebook/Instagram
- Professionel email til kunder
- Artikler til blog"
          />
          <p className="mt-1 text-xs text-gray-500">
            Hjælper AI'en med at forstå konteksten og formatet
          </p>
        </div>

        {/* Examples */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Teksteksempler
          </label>
          <textarea
            value={examples}
            onChange={(e) => setExamples(e.target.value)}
            className="textarea"
            rows={6}
            placeholder="Indsæt eksempler på tekster i den stil du ønsker.

Jo flere og bedre eksempler, jo mere præcis stilguide.

Du kan indsætte flere eksempler adskilt af tomme linjer."
          />
          <p className="mt-1 text-xs text-gray-500">
            AI'en analyserer eksemplerne og laver en stilguide
          </p>
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating || !examples.trim()}
          className="btn btn-success w-full flex items-center justify-center gap-2"
        >
          {generating ? (
            <>
              <span className="spinner !border-white !border-t-transparent" />
              Genererer stilguide...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generér stilguide fra eksempler
            </>
          )}
        </button>

        {/* Generated guide content */}
        {guideContent && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Genereret stilguide
            </label>
            <textarea
              value={guideContent}
              onChange={(e) => setGuideContent(e.target.value)}
              className="textarea bg-green-50"
              rows={8}
            />
            <p className="mt-1 text-xs text-gray-500">
              Du kan redigere stilguiden manuelt hvis du vil justere den
            </p>
          </div>
        )}

        {/* Error / Success messages */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {success}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary flex-1"
          >
            {saving ? 'Gemmer...' : 'Gem ændringer'}
          </button>

          {!guide.is_default && guideContent && (
            <button
              onClick={handleSetDefault}
              className="btn bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              Sæt som standard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
