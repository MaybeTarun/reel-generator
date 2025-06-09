import { useState, ChangeEvent } from 'react';
import { generateVoiceover } from '../utils/api';

interface FileUploadProps {
  script: string;
  setScript: (text: string) => void;
  setAudioUrl: (url: string) => void;
  videoFile: File | null;
  setVideoFile: (file: File | null) => void;
}

export default function FileUpload({
  script,
  setScript,
  setAudioUrl,
  videoFile,
  setVideoFile
}: FileUploadProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleVideoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('video/')) {
      setError('Please upload a valid video file');
      return;
    }
    
    setVideoFile(file);
    setError(null);
  };

  const handleGenerate = async () => {
    if (!script.trim()) {
      setError('Please enter a script');
      return;
    }
    
    if (!import.meta.env.VITE_ELEVENLABS_API_KEY) {
      setError('Eleven Labs API key is not configured');
      return;
    }
    
    setIsGenerating(true);
    setProgress(0);
    setError(null);
    
    try {
      const audioBlob = await generateVoiceover(script, (loaded, total) => {
        setProgress(Math.round((loaded / total) * 100));
      });
      setAudioUrl(URL.createObjectURL(audioBlob));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate voiceover');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Script
          </label>
          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Enter your script here..."
            className="w-full h-32 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Background Video
          </label>
          <input
            type="file"
            accept="video/*"
            onChange={handleVideoUpload}
            className="w-full p-2 border rounded-md"
          />
          {videoFile && (
            <p className="mt-2 text-sm text-gray-600">
              Selected: {videoFile.name}
            </p>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <div className="mt-4">
          <button
            onClick={handleGenerate}
            disabled={!script.trim() || isGenerating}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
          >
            {isGenerating ? `Generating... ${progress}%` : 'Generate Voiceover'}
          </button>
        </div>
      </div>
    </div>
  );
}