import { useState } from 'react';
import {
  type Transcription,
  updateTranscription,
  processTranscription,
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
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'raw' | 'processed' | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

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
      const updated = await processTranscription(transcription.id, instruction);
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
