import { useState, useRef, useEffect } from 'react';
import { transcribe, type Transcription } from '../lib/api';
import VoiceMemoGuide from './VoiceMemoGuide';

interface Props {
  onTranscribed: (transcription: Transcription) => void;
}

export default function UploadForm({ onTranscribed }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [showGuide, setShowGuide] = useState(false);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [canRecord, setCanRecord] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Check if browser supports recording
  useEffect(() => {
    const checkRecordingSupport = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        setCanRecord(true);
      }
    };
    checkRecordingSupport();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      // Validate it's an audio file
      if (!selected.type.startsWith('audio/') && !selected.name.match(/\.(m4a|mp3|wav|ogg|aac|flac|webm)$/i)) {
        setError('Kun lydfiler er tilladt');
        return;
      }
      setFile(selected);
      setAudioBlob(null);
      setError('');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.type.startsWith('audio/') || dropped.name.match(/\.(m4a|mp3|wav|ogg|aac|flac|webm)$/i))) {
      setFile(dropped);
      setAudioBlob(null);
      setError('');
    } else {
      setError('Kun lydfiler er tilladt');
    }
  };

  const startRecording = async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Determine best supported mime type (iOS Safari needs audio/mp4)
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Clear timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);
      setFile(null);

      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime(t => t + 1);
      }, 1000);

    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Adgang til mikrofon blev nægtet. Tillad adgang i browserindstillinger.');
      } else {
        setError('Kunne ikke starte optagelse. Tjek at din mikrofon virker.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const clearRecording = () => {
    setAudioBlob(null);
    setRecordingTime(0);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Create file from audioBlob if recording was used
    let uploadFile = file;
    if (audioBlob && !file) {
      const extension = audioBlob.type.includes('mp4') ? 'm4a' : 'webm';
      uploadFile = new File([audioBlob], `optagelse-${Date.now()}.${extension}`, {
        type: audioBlob.type
      });
    }

    if (!uploadFile) {
      setError('Vælg en lydfil eller optag først');
      return;
    }

    setLoading(true);
    setError('');
    setProgress('Uploader fil...');

    try {
      setProgress('Transskriberer... Dette kan tage et øjeblik for lange filer.');
      const transcription = await transcribe(uploadFile, context);
      onTranscribed(transcription);

      // Reset form
      setFile(null);
      setAudioBlob(null);
      setRecordingTime(0);
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

  const hasContent = file || audioBlob;

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Recording UI */}
        {isRecording ? (
          <div className="border-2 border-red-300 bg-red-50 rounded-xl p-6 text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="font-semibold text-red-700">Optager...</span>
            </div>
            <div className="text-4xl font-mono text-red-600">
              {formatTime(recordingTime)}
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="btn bg-red-600 hover:bg-red-700 text-white px-6"
            >
              <svg className="w-5 h-5 mr-2 inline" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              Stop optagelse
            </button>
          </div>
        ) : audioBlob ? (
          /* Recorded audio ready */
          <div className="border-2 border-green-300 bg-green-50 rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-medium text-gray-900">Optagelse klar</p>
            <p className="text-sm text-gray-500">{formatTime(recordingTime)} optaget</p>
            <audio controls src={URL.createObjectURL(audioBlob)} className="mx-auto" />
            <button
              type="button"
              onClick={clearRecording}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Slet optagelse
            </button>
          </div>
        ) : (
          /* File upload area */
          <>
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
                accept=".m4a,.mp3,.wav,.ogg,.aac,.flac,.webm,audio/*"
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

            {/* Divider and record button */}
            {canRecord && !file && (
              <>
                <div className="flex items-center gap-3 text-gray-400 text-sm">
                  <div className="flex-1 border-t" />
                  <span>eller</span>
                  <div className="flex-1 border-t" />
                </div>

                <button
                  type="button"
                  onClick={startRecording}
                  disabled={loading}
                  className="w-full btn bg-red-500 hover:bg-red-600 text-white flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Optag direkte
                </button>
              </>
            )}

            {/* Voice Memos guide link */}
            {!file && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowGuide(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                >
                  Har du en Voice Memo på iPhone?
                </button>
              </div>
            )}
          </>
        )}

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
            disabled={loading || isRecording}
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
          disabled={loading || !hasContent || isRecording}
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

      {/* Voice Memo Guide popup */}
      {showGuide && <VoiceMemoGuide onClose={() => setShowGuide(false)} />}
    </>
  );
}
