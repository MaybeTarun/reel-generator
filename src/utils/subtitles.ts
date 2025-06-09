// Helper function to generate SRT subtitles with word-level timing
export function generateSRT(text: string, audioDuration: number): string {
  const words = text.split(' ')
  const wordsPerSecond = words.length / audioDuration // Calculate words per second based on audio duration
  const subtitles: string[] = []
  
  // Group words into smaller chunks for better readability
  for (let i = 0; i < words.length; i += 3) {
    const startTime = formatTime(i / wordsPerSecond)
    const endTime = formatTime(Math.min((i + 3) / wordsPerSecond, audioDuration)) // Ensure we don't exceed audio duration
    const chunk = words.slice(i, i + 3).join(' ')
    
    // Format exactly as FFmpeg expects
    subtitles.push(
      `${subtitles.length + 1}\n` +
      `${startTime} --> ${endTime}\n` +
      `${chunk}\n`
    )
  }
  
  return subtitles.join('\n')
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  
  // Format exactly as FFmpeg expects: HH:MM:SS,mmm
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}