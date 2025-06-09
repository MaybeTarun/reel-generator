import { useState, useEffect } from 'react';
import { initFFmpeg } from '../utils/ffmpeg';
import { generateSRT } from '../utils/subtitles';
import { fetchFile } from '@ffmpeg/util';

interface VideoPreviewProps {
  videoFile: File;
  audioUrl: string | null;
  script: string;
}

export default function VideoPreview({ videoFile, audioUrl, script }: VideoPreviewProps) {
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const processVideo = async () => {
      if (!videoFile || !audioUrl) return;
      
      setIsProcessing(true);
      setError(null);
      setProgress(0);
      
      try {
        const ffmpeg = await initFFmpeg();
        const audioBlob = await fetch(audioUrl).then(r => r.blob());
        
        await Promise.all([
          ffmpeg.writeFile('input.mp4', await fetchFile(videoFile)),
          ffmpeg.writeFile('audio.mp3', await fetchFile(audioBlob)),
          ffmpeg.writeFile('subtitles.srt', generateSRT(script, 0)) 
        ]);

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const audioDuration = audioBuffer.duration;

        await ffmpeg.writeFile('subtitles.srt', generateSRT(script, audioDuration));
        
        ffmpeg.on('progress', ({ progress }) => {
          setProgress(Math.round(progress * 100));
        });

        await ffmpeg.exec([
          '-i', 'input.mp4',
          '-i', 'audio.mp3',
          '-vf', "subtitles=subtitles.srt:force_style='FontSize=72,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=3,BorderStyle=4,Alignment=2,MarginV=50,BackColour=&H80000000'",
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '18',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-shortest',
          '-movflags', '+faststart',
          '-tune', 'film',
          '-profile:v', 'high',
          '-level', '4.0',
          'output.mp4'
        ]);
        
        const data = await ffmpeg.readFile('output.mp4');
        const blob = new Blob([data], { type: 'video/mp4' });
        setProcessedVideoUrl(URL.createObjectURL(blob));
      } catch (err) {
        console.error('Error processing video:', err);
        setError(err instanceof Error ? err.message : 'Failed to process video');
      } finally {
        setIsProcessing(false);
      }
    };
    
    processVideo();
  }, [videoFile, audioUrl, script]);

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-4">Preview</h2>
      
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-md mb-4">
          {error}
        </div>
      )}
      
      {isProcessing ? (
        <div className="text-center py-8">
          <div className="text-lg mb-2">Processing video... {progress}%</div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : processedVideoUrl ? (
        <video
          src={processedVideoUrl}
          controls
          className="w-full rounded-lg"
        />
      ) : (
        <div className="text-center py-8 text-gray-500">
          Waiting for video processing...
        </div>
      )}
    </div>
  );
}