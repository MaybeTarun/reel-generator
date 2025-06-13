export const generateVoiceover = async (
    text: string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<Blob> => {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${import.meta.env.VITE_ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': import.meta.env.VITE_ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      }
    );
  
    if (!response.ok) throw new Error('Voiceover generation failed');
    
    const reader = response.body?.getReader();
    const contentLength = parseInt(response.headers.get('Content-Length') || '0');
    let receivedLength = 0;
    const chunks: Uint8Array[] = [];
    
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
  
        chunks.push(value);
        receivedLength += value.length;
        if (onProgress) onProgress(receivedLength, contentLength);
      }
    }
  
    return new Blob(chunks, { type: 'audio/mpeg' });
  };
export const generateVadooCaptions = async (videoUrl: string, theme: string = 'Hormozi_1', language: string = 'English') => {
  const API_KEY = import.meta.env.VITE_VADOO_API_KEY
  if (!API_KEY) {
    throw new Error('Vadoo API key is missing')
  }

  const response = await fetch('https://viralapi.vadoo.tv/api/add_captions', {
    method: 'POST',
    headers: {
      'X-API-KEY': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url: videoUrl,
      theme,
      language
    })
  })

  if (!response.ok) {
    throw new Error(`Vadoo API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return data.vid
}
