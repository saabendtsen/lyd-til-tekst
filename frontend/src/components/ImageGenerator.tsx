import { useState } from 'react';
import {
  type ImageGeneration,
  generateImage,
  getImageDataUrl,
} from '../lib/api';

interface Props {
  initialPrompt?: string;
}

const ASPECT_RATIOS = [
  { value: '1:1', label: 'Kvadrat (1:1)' },
  { value: '16:9', label: 'Landskab (16:9)' },
  { value: '9:16', label: 'Portræt (9:16)' },
  { value: '4:3', label: 'Standard (4:3)' },
];

const RESOLUTIONS = [
  { value: '1k', label: '1K (hurtig)' },
  { value: '2k', label: '2K (anbefalet)' },
  { value: '4k', label: '4K (høj kvalitet)' },
];

export default function ImageGenerator({ initialPrompt = '' }: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [editPrompt, setEditPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [resolution, setResolution] = useState('2k');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [generations, setGenerations] = useState<ImageGeneration[]>([]);
  const [showSettings, setShowSettings] = useState(false);

  const currentGeneration = generations.length > 0 ? generations[generations.length - 1] : null;

  const handleGenerate = async () => {
    const currentPrompt = currentGeneration ? editPrompt : prompt;
    if (!currentPrompt.trim()) {
      setError('Skriv en beskrivelse af billedet');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const result = await generateImage({
        prompt: currentPrompt,
        session_id: currentGeneration?.id,
        aspect_ratio: aspectRatio,
        resolution,
      });

      setGenerations([...generations, result]);
      setEditPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke generere billede');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!currentGeneration) return;

    try {
      const response = await fetch(getImageDataUrl(currentGeneration.id), {
        credentials: 'include',
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `billede-${currentGeneration.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Kunne ikke downloade billede');
    }
  };

  const handleReset = () => {
    setGenerations([]);
    setEditPrompt('');
    setPrompt(initialPrompt);
  };

  return (
    <div className="space-y-4">
      {/* Generated image */}
      {currentGeneration && (
        <div className="relative">
          <img
            src={getImageDataUrl(currentGeneration.id)}
            alt={currentGeneration.prompt}
            className="w-full rounded-lg shadow-lg"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <button
              onClick={handleDownload}
              className="p-2 bg-white/90 rounded-full shadow hover:bg-white"
              title="Download billede"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button
              onClick={handleReset}
              className="p-2 bg-white/90 rounded-full shadow hover:bg-white"
              title="Start forfra"
            >
              <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          {generations.length > 1 && (
            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
              Runde {currentGeneration.turn_number} af {generations.length}
            </div>
          )}
        </div>
      )}

      {/* Prompt input */}
      {!currentGeneration ? (
        // Initial prompt
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Beskriv billedet
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="textarea"
            rows={3}
            placeholder="F.eks.: Et professionelt billede til en LinkedIn post om kundeservice, med venlige mennesker i et moderne kontor"
          />
        </div>
      ) : (
        // Edit prompt for multi-turn
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Beskriv ændringer
          </label>
          <textarea
            value={editPrompt}
            onChange={(e) => setEditPrompt(e.target.value)}
            className="textarea"
            rows={2}
            placeholder="F.eks.: Gør baggrunden lysere, tilføj flere mennesker, fjern teksten"
          />
        </div>
      )}

      {/* Settings toggle */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        <svg className={`w-4 h-4 transition-transform ${showSettings ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Indstillinger
      </button>

      {/* Settings */}
      {showSettings && (
        <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Format</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="input"
              disabled={!!currentGeneration}
            >
              {ASPECT_RATIOS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Opløsning</label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="input"
              disabled={!!currentGeneration}
            >
              {RESOLUTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={generating || (!currentGeneration && !prompt.trim()) || (currentGeneration && !editPrompt.trim())}
        className="btn btn-primary w-full flex items-center justify-center gap-2"
      >
        {generating ? (
          <>
            <span className="spinner !border-white !border-t-transparent" />
            <span>Genererer billede...</span>
          </>
        ) : currentGeneration ? (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Opdater billede</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Generer billede</span>
          </>
        )}
      </button>

      {/* History thumbnails */}
      {generations.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {generations.map((gen, index) => (
            <button
              key={gen.id}
              onClick={() => {
                // Move this generation to the end (make it current)
                const newGenerations = [...generations];
                newGenerations.splice(index, 1);
                newGenerations.push(gen);
                setGenerations(newGenerations);
              }}
              className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${
                gen.id === currentGeneration?.id ? 'border-blue-500' : 'border-gray-200'
              }`}
            >
              <img
                src={getImageDataUrl(gen.id)}
                alt={`Version ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
