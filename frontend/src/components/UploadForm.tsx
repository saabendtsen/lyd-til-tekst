import { useState, useRef } from 'react';
import { transcribe, type Transcription } from '../lib/api';

interface Props {
  onTranscribed: (transcription: Transcription) => void;
}

export default function UploadForm({ onTranscribed }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type.startsWith('audio/')) {
      setFile(dropped);
      setError('');
    } else {
      setError('Kun lydfiler er tilladt');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Vælg venligst en lydfil');
      return;
    }

    setLoading(true);
    setError('');
    setProgress('Uploader fil...');

    try {
      setProgress('Transskriberer... Dette kan tage et øjeblik for lange filer.');
      const transcription = await transcribe(file, context);
      onTranscribed(transcription);

      // Reset form
      setFile(null);
      setContext('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Der opstod en fejl');
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* File upload area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          file
            ? 'border-green-300 bg-green-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={loading}
        />

        {file ? (
          <div className="space-y-2">
            <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-medium text-gray-900">{file.name}</p>
            <p className="text-sm text-gray-500">{formatFileSize(file.size)}</p>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Fjern fil
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <p className="font-medium text-gray-900">Vælg lydfil</p>
            <p className="text-sm text-gray-500">eller træk og slip her</p>
            <p className="text-xs text-gray-400">MP3, M4A, WAV, OGG, etc.</p>
          </div>
        )}
      </div>

      {/* Context input */}
      <div>
        <label htmlFor="context" className="block text-sm font-medium text-gray-700 mb-1">
          Hvad handler lydfilen om? <span className="text-gray-400">(valgfri)</span>
        </label>
        <textarea
          id="context"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          className="textarea"
          rows={2}
          placeholder="F.eks. 'Møde om budgettet' eller 'Diktat til brev'"
          disabled={loading}
        />
        <p className="mt-1 text-xs text-gray-500">
          Giver bedre transskription når vi ved hvad det handler om
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Progress message */}
      {progress && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm flex items-center gap-2">
          <span className="spinner" />
          {progress}
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={loading || !file}
        className="btn btn-primary w-full flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="spinner" />
            <span>Transskriberer...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>Transskribér</span>
          </>
        )}
      </button>
    </form>
  );
}
