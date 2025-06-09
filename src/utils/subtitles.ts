
export function generateSRT(text: string, audioDuration: number): string {
  const words = text.split(' ')
  const wordsPerSecond = words.length / audioDuration 
  const subtitles: string[] = []
  
  for (let i = 0; i < words.length; i += 3) {
    const startTime = formatTime(i / wordsPerSecond)
    const endTime = formatTime(Math.min((i + 3) / wordsPerSecond, audioDuration)) 
    const chunk = words.slice(i, i + 3).join(' ')
    
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
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}