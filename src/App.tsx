import { useState, useEffect } from 'react'
import { generateVoiceover } from './utils/api'
import { initFFmpeg } from './utils/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { generateSRT } from './utils/subtitles'

const backgroundVideos = import.meta.glob('/src/assets/backgrounds/*.mp4', { eager: true })

export default function App() {
  const [script, setScript] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null)
  const [usedVideos, setUsedVideos] = useState<Set<string>>(new Set())
  const [availableVideos, setAvailableVideos] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState('script')
  const [timestampContent, setTimestampContent] = useState<string | null>(null)

  useEffect(() => {
    const videoPaths = Object.keys(backgroundVideos)
    setAvailableVideos(videoPaths)
  }, [])

  const getRandomVideo = async () => {
    if (availableVideos.length === 0) {
      setError('No background videos available')
      return null
    }

    if (usedVideos.size >= availableVideos.length) {
      setUsedVideos(new Set())
    }

    const unusedVideos = availableVideos.filter(video => !usedVideos.has(video))
    
    const randomIndex = Math.floor(Math.random() * unusedVideos.length)
    const selectedVideo = unusedVideos[randomIndex]
    
    setUsedVideos(prev => new Set([...prev, selectedVideo]))
    
    try {
      const response = await fetch(selectedVideo)
      const blob = await response.blob()
      return new File([blob], selectedVideo.split('/').pop() || 'background.mp4', { type: 'video/mp4' })
    } catch (err) {
      console.error('Error loading video:', err)
      setError('Failed to load background video')
      return null
    }
  }

  const handleGenerate = async () => {
    if (!script.trim()) {
      setError('Please enter a script')
      return
    }
    
    setIsProcessing(true)
    setError(null)
    setProgress(0)
    setFinalVideoUrl(null)
    
    try {
      console.log('Starting video generation process...')
      
      const randomVideo = await getRandomVideo()
      if (!randomVideo) {
        throw new Error('Failed to get background video')
      }
      
      console.log('Step 1: Generating voiceover...')
      const audioBlob = await generateVoiceover(script, (loaded, total) => {
        setProgress(Math.round((loaded / total) * 20))
      })

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      const audioDuration = audioBuffer.duration
      console.log('Audio duration:', audioDuration)

      console.log('Step 2: Generating subtitles...')
      const subtitles = timestampContent !== null ? timestampContent : generateSRT(script, audioDuration)
      if (timestampContent === null) {
        setTimestampContent(subtitles)
      }
      
      console.log('Step 3: Processing video...')
      const ffmpeg = await initFFmpeg()
      
      await Promise.all([
        ffmpeg.writeFile('input.mp4', await fetchFile(randomVideo)),
        ffmpeg.writeFile('audio.mp3', await fetchFile(audioBlob)),
        ffmpeg.writeFile('subtitles.srt', subtitles)
      ])

      ffmpeg.on('progress', ({ progress }) => {
        setProgress(20 + Math.round(progress * 80))
      })

      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-i', 'audio.mp3',
        '-vf', "subtitles=subtitles.srt:force_style='FontSize=72,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=3,BorderStyle=4,Alignment=2,MarginV=50,BackColour=&H80000000'",
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-shortest',
        '-movflags', '+faststart',
        'output.mp4'
      ])
      
      const data = await ffmpeg.readFile('output.mp4')
      const videoUrl = URL.createObjectURL(new Blob([data], { type: 'video/mp4' }))
      setFinalVideoUrl(videoUrl)
      setProgress(100)

      setActiveTab('timestamps')

    } catch (err) {
      console.error('Error during processing:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate video')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center">
      <div className="w-full max-w-[1400px] mx-auto flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-8 lg:h-[calc(100vh-4rem)]">
        <div className={`flex-grow lg:flex-grow-0 flex items-center justify-center h-full w-full max-w-[600px]`}>
          <div className="w-full bg-white p-6 rounded-lg shadow flex flex-col justify-between h-full">
            <div className="space-y-4 flex-grow flex flex-col">
              <div className="flex">
                <button
                  className={`px-4 py-2 ${activeTab === 'script' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
                  onClick={() => setActiveTab('script')}
                >
                  Script
                </button>
                <button
                  className={`px-4 py-2 ${activeTab === 'timestamps' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'} ${timestampContent === null ? 'cursor-not-allowed opacity-50' : ''}`}
                  onClick={() => timestampContent !== null && setActiveTab('timestamps')}
                  disabled={timestampContent === null}
                >
                  Timestamps
                </button>
              </div>

              {activeTab === 'script' ? (
                <div className="flex flex-col flex-grow">
                  <textarea
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    placeholder="Enter your script here..."
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex-grow"
                  />
                </div>
              ) : (
                <div className="flex flex-col flex-grow">
                  <textarea
                    value={timestampContent || ''}
                    onChange={(e) => setTimestampContent(e.target.value)}
                    placeholder="Edit timestamps here..."
                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex-grow"
                    disabled={timestampContent === null}
                  />
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 text-red-700 rounded-md mt-4">
                  {error}
                </div>
              )}
            </div>

            <button
              onClick={handleGenerate}
              disabled={!script.trim() || isProcessing}
              className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
            >
              {isProcessing ? `Processing... ${progress}%` : 'Generate Reel'}
            </button>
          </div>
        </div>

        {finalVideoUrl && (
          <div className="flex-shrink-0 h-full flex items-center justify-center w-auto" style={{ aspectRatio: '9 / 16' }}>
            <div className="bg-white p-6 rounded-lg shadow flex flex-col justify-between h-full">
              <div className="flex-grow flex items-center justify-center">
                <video
                  src={finalVideoUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}