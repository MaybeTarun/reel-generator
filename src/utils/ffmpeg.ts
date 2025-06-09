import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export const initFFmpeg = async () => {
  if (ffmpeg) return ffmpeg;
  
  ffmpeg = new FFmpeg();
  await ffmpeg.load();
  return ffmpeg;
};

const cleanupFFmpegFiles = async (ffmpeg: FFmpeg, files: string[]) => {
  try {
    await Promise.all(files.map(file => ffmpeg.deleteFile(file)));
  } catch (error) {
    console.warn('Error cleaning up FFmpeg files:', error);
  }
};

export const combineVideoAndAudio = async (
  videoFile: File,
  audioBlob: Blob,
  onProgress?: (progress: number) => void
): Promise<Blob> => {
  const ffmpeg = await initFFmpeg();
  const inputFiles = ['input.mp4', 'audio.mp3'];
  
  try {
    // Write files to FFmpeg's virtual filesystem
    await Promise.all([
      ffmpeg.writeFile('input.mp4', await fetchFile(videoFile)),
      ffmpeg.writeFile('audio.mp3', await fetchFile(audioBlob))
    ]);
    
    // Set up progress monitoring
    ffmpeg.on('progress', ({ progress }) => {
      if (onProgress) onProgress(Math.round(progress * 100));
    });

    // Combine video and audio with optimized settings
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-i', 'audio.mp3',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-shortest',
      '-movflags', '+faststart',
      '-preset', 'medium',
      '-tune', 'film',
      '-profile:v', 'high',
      '-level', '4.0',
      'output.mp4'
    ]);
    
    const data = await ffmpeg.readFile('output.mp4');
    return new Blob([data], { type: 'video/mp4' });
  } finally {
    await cleanupFFmpegFiles(ffmpeg, [...inputFiles, 'output.mp4']);
  }
};

export const addSubtitles = async (
  videoFile: File,
  subtitles: string,
  onProgress?: (progress: number) => void
): Promise<Blob> => {
  const ffmpeg = await initFFmpeg();
  const inputFiles = ['input.mp4', 'subtitles.srt', 'OpenSans-B9K8.ttf'];

  try {
    // Write all required files
    await Promise.all([
      ffmpeg.writeFile('input.mp4', await fetchFile(videoFile)),
      ffmpeg.writeFile('subtitles.srt', subtitles),
      ffmpeg.writeFile('OpenSans-B9K8.ttf', await fetchFile('/fonts/OpenSans-B9K8.ttf'))
    ]);

    // Set up progress monitoring
    ffmpeg.on('progress', ({ progress }) => {
      if (onProgress) onProgress(Math.round(progress * 100));
    });

    // Add subtitles with optimized settings
    await ffmpeg.exec([
      '-i', 'input.mp4',
      '-vf', "subtitles=subtitles.srt:force_style='FontSize=72,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=3,BorderStyle=4,Alignment=2,MarginV=50,BackColour=&H80000000,Encoding=1,FontFile=OpenSans-B9K8.ttf'",
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '18',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      '-tune', 'film',
      '-profile:v', 'high',
      '-level', '4.0',
      'output.mp4'
    ]);

    const data = await ffmpeg.readFile('output.mp4');
    return new Blob([data], { type: 'video/mp4' });
  } finally {
    await cleanupFFmpegFiles(ffmpeg, [...inputFiles, 'output.mp4']);
  }
};
