export function generateSRT(text: string, audioDuration: number): string {
  const words = text.split(' ');
  const wordsPerSecond = words.length / audioDuration;
  const subtitles: string[] = [];

  let startTime = 0;
  const chunkSize = 3;

  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    const endTime = Math.min(startTime + chunkSize / wordsPerSecond, audioDuration);

    subtitles.push(
      `${subtitles.length + 1}\n` +
      `${formatTime(startTime)} --> ${formatTime(endTime)}\n` +
      `${chunk}\n`
    );

    startTime = endTime;
  }

  return subtitles.join('\n');
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}