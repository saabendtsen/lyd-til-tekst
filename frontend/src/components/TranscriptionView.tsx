import { useState, useEffect } from 'react';
import {
  type Transcription,
  type StyleGuide,
  updateTranscription,
  processTranscription,
  getAudioUrl,
  deleteAudio,
  getStyleGuides,
} from '../lib/api';

interface Props {
  transcription: Transcription;
  onUpdate: (updated: Transcription) => void;
  onBack: () => void;
}

export default function TranscriptionView({ transcription, onUpdate, onBack }: Props) {
  const [rawText, setRawText] = useState(transcription.raw_text);
  const [instruction, setInstruction] = useState(transcription.instruction || '');
  const [processedText, setProcessedText] = useState(transcription.processed_text || '');
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [deletingAudio, setDeletingAudio] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'raw' | 'processed' | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasAudio, setHasAudio] = useState(transcription.has_audio);
  const [styleGuides, setStyleGuides] = useState<StyleGuide[]>([]);
  const [selectedStyleGuideId, setSelectedStyleGuideId] = useState<number | undefined>();

  // Load style guides on mount
  useEffect(() => {
    const loadStyleGuides = async () => {
      try {
        const guides = await getStyleGuides();
        setStyleGuides(guides);
        // Select default guide if exists
        const defaultGuide = guides.find(g => g.is_default && g.guide_content);
        if (defaultGuide) {
          setSelectedStyleGuideId(defaultGuide.id);
        }
      } catch {
        // Ignore errors - style guides are optional
      }
    };
    loadStyleGuides();
  }, []);

  const handleRawTextChange = (value: string) => {
    setRawText(value);
    setHasChanges(value !== transcription.raw_text);
  };

  const handleSaveRawText = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await updateTranscription(transcription.id, rawText);
      onUpdate(updated);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke gemme');
    } finally {
      setSaving(false);
    }
  };

  const handleProcess = async () => {
    if (!instruction.trim()) {
      setError('Skriv en instruks til AI\'en');
      return;
    }

    // Save raw text first if changed
    if (hasChanges) {
      await handleSaveRawText();
    }

    setProcessing(true);
    setError('');
    try {
      const updated = await processTranscription(transcription.id, instruction, selectedStyleGuideId);
      setProcessedText(updated.processed_text || '');
      onUpdate(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke bearbejde');
    } finally {
      setProcessing(false);
    }
  };

  const handleCopy = async (text: string, type: 'raw' | 'processed') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const handleDeleteAudio = async () => {
    if (!confirm('Er du sikker på at du vil slette lydfilen? Transskriptionen beholdes.')) {
      return;
    }

    setDeletingAudio(true);
    setError('');
    try {
      await deleteAudio(transcription.id);
      setHasAudio(false);
      // Update the transcription object
      onUpdate({ ...transcription, has_audio: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke slette lydfil');
    } finally {
      setDeletingAudio(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tilbage
        </button>
        {transcription.filename && (
          <div className="text-sm text-gray-500">
            {transcription.filename} ({transcription.duration_formatted})
          </div>
        )}
      </div>

      {/* Audio player */}
      {hasAudio && (
        <div className="card bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              Lydfil
            </h2>
            <button
              onClick={handleDeleteAudio}
              disabled={deletingAudio}
              className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              {deletingAudio ? (
                <>
                  <span className="spinner !h-4 !w-4 !border-red-600" />
                  Sletter...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Slet lydfil
                </>
              )}
            </button>
          </div>
          <audio
            controls
            src={getAudioUrl(transcription.id)}
            className="w-full"
          >
            Din browser understøtter ikke audio afspilning.
          </audio>
        </div>
      )}

      {/* Raw transcription */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-900">Rå transskription</h2>
          <div className="flex gap-2">
            <button
              onClick={() => handleCopy(rawText, 'raw')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {copied === 'raw' ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Kopieret
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Kopiér
                </>
              )}
            </button>
            {hasChanges && (
              <button
                onClick={handleSaveRawText}
                disabled={saving}
                className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1"
              >
                {saving ? (
                  <>
                    <span className="spinner !h-4 !w-4 !border-green-600" />
                    Gemmer...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Gem ændringer
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        <textarea
          value={rawText}
          onChange={(e) => handleRawTextChange(e.target.value)}
          className="textarea min-h-[150px]"
          placeholder="Ingen transskription endnu..."
        />
        <p className="mt-1 text-xs text-gray-500">
          Du kan redigere teksten før du bearbejder den med AI
        </p>
      </div>

      {/* Instruction input */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-2">Instruks til AI</h2>

        {/* Style guide selector */}
        {styleGuides.length > 0 && (
          <div className="mb-3">
            <label className="block text-sm text-gray-600 mb-1">
              Stilguide (valgfri)
            </label>
            <select
              value={selectedStyleGuideId || ''}
              onChange={(e) => setSelectedStyleGuideId(e.target.value ? Number(e.target.value) : undefined)}
              className="input"
            >
              <option value="">Ingen stilguide</option>
              {styleGuides.filter(g => g.guide_content).map(guide => (
                <option key={guide.id} value={guide.id}>
                  {guide.name}{guide.is_default ? ' (Standard)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          className="textarea"
          rows={3}
          placeholder="Hvad skal AI'en gøre med teksten? F.eks.:
• Lav et referat
• Ret stavefejl og formatér som brev
• Lav punktform med de vigtigste pointer
• Oversæt til engelsk"
        />
        <button
          onClick={handleProcess}
          disabled={processing || !instruction.trim()}
          className="btn btn-success w-full mt-3 flex items-center justify-center gap-2"
        >
          {processing ? (
            <>
              <span className="spinner !border-white !border-t-transparent" />
              <span>Bearbejder...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Bearbejd med AI</span>
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Processed text */}
      {processedText && (
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900">Bearbejdet tekst</h2>
            <button
              onClick={() => handleCopy(processedText, 'processed')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {copied === 'processed' ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Kopieret
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Kopiér
                </>
              )}
            </button>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-gray-800">
            {processedText}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Prøv en anden instruks for at få et andet resultat
          </p>
        </div>
      )}
    </div>
  );
}
