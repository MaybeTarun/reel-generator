import { useState } from 'react'
import { generateVoiceover } from './utils/api'
import { initFFmpeg } from './utils/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import bgSvg from './assets/bg.svg'

declare global {
  interface Window {
    showSaveFilePicker: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>
  }
}

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: Array<{
    description: string
    accept: Record<string, string[]>
  }>
}

const CATEGORIES = [
  { id: 'satisfying', name: 'Satisfying' },
  { id: 'minecraft', name: 'Minecraft' },
  { id: 'subway', name: 'Subway Surfers' },
  { id: 'gta', name: 'GTA' },
  { id: 'fortnite', name: 'Fortnite' }
] as const

const categoryVideos = {
  satisfying: import.meta.glob('/src/assets/satisfying/*.mp4', { eager: true }),
  minecraft: import.meta.glob('/src/assets/minecraft/*.mp4', { eager: true }),
  subway: import.meta.glob('/src/assets/subway/*.mp4', { eager: true }),
  gta: import.meta.glob('/src/assets/gta/*.mp4', { eager: true }),
  fortnite: import.meta.glob('/src/assets/fortnite/*.mp4', { eager: true })
}

export default function App() {
  const [script, setScript] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null)
  const [usedVideos, setUsedVideos] = useState<Record<string, Set<string>>>({})
  const [activeTab, setActiveTab] = useState('script')
  const [srtContent, setSrtContent] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('satisfying')
  const [customVideo, setCustomVideo] = useState<File | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [debugLogs, setDebugLogs] = useState<string[]>([])

  const addDebugLog = (message: string) => {
    setDebugLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('video/')) {
      setError('Please upload a video file')
      return
    }

    setCustomVideo(file)
    setError(null)
  }

  const getRandomVideo = async () => {
    if (customVideo) {
      return customVideo
    }

    const categoryVideosList = Object.keys(categoryVideos[selectedCategory as keyof typeof categoryVideos])
    
    if (categoryVideosList.length === 0) {
      setError(`No videos available in ${selectedCategory} category`)
      return null
    }

    if (!usedVideos[selectedCategory]) {
      setUsedVideos(prev => ({ ...prev, [selectedCategory]: new Set() }))
    }

    if (usedVideos[selectedCategory]?.size >= categoryVideosList.length) {
      setUsedVideos(prev => ({ ...prev, [selectedCategory]: new Set() }))
    }

    const unusedVideos = categoryVideosList.filter(video => !usedVideos[selectedCategory]?.has(video))
    const randomIndex = Math.floor(Math.random() * unusedVideos.length)
    const selectedVideo = unusedVideos[randomIndex]
    
    setUsedVideos(prev => ({
      ...prev,
      [selectedCategory]: new Set([...prev[selectedCategory] || [], selectedVideo])
    }))
    
    try {
      const response = await fetch(selectedVideo)
      const blob = await response.blob()
      return new File([blob], selectedVideo.split('/').pop() || 'background.mp4', { type: 'video/mp4' })
    } catch (err) {
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
    setDebugLogs([])
    
    try {
      addDebugLog('Initializing video generation process')
      setProgress(5)
      const randomVideo = await getRandomVideo()
      if (!randomVideo) {
        throw new Error('Failed to get background video')
      }
      addDebugLog(`Background video selected: ${randomVideo.name}`)
      
      setProgress(10)
      addDebugLog('Generating voiceover audio')
      const audioBlob = await generateVoiceover(script, (loaded, total) => {
        setProgress(10 + Math.round((loaded / total) * 20))
      })

      setProgress(30)
      addDebugLog('Processing audio metadata')
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const arrayBuffer = await audioBlob.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      const audioDuration = audioBuffer.duration

      const formatTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)
        const secs = Math.floor(seconds % 60)
        const msecs = Math.floor((seconds % 1) * 1000)
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${msecs.toString().padStart(3, '0')}`
      }

      const srt = `1\n${formatTime(0)} --> ${formatTime(audioDuration)}\n${script}`
      setSrtContent(srt)
      addDebugLog('Subtitle file generated')
      
      setProgress(40)
      addDebugLog('Initializing video processing engine')
      const ffmpeg = await initFFmpeg()
      
      setProgress(50)
      try {
        await ffmpeg.writeFile('input.mp4', await fetchFile(randomVideo))
        await ffmpeg.writeFile('audio.mp3', await fetchFile(audioBlob))
        await ffmpeg.writeFile('subtitles.srt', srt)
      } catch (writeError) {
        throw writeError
      }

      addDebugLog('Processing video with audio and subtitles')
      try {
        await ffmpeg.exec([
          '-i', 'input.mp4',
          '-i', 'audio.mp3',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '23',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-vf', "subtitles=subtitles.srt:force_style='FontName=Arial,FontSize=24,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,Outline=2,BorderStyle=3,Alignment=2'",
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-shortest',
          '-movflags', '+faststart',
          'output.mp4'
        ])
      } catch (execError) {
        throw execError
      }
      
      setProgress(95)
      addDebugLog('Finalizing video output')
      const data = await ffmpeg.readFile('output.mp4')
      const videoUrl = URL.createObjectURL(new Blob([data], { type: 'video/mp4' }))
      setFinalVideoUrl(videoUrl)
      setProgress(100)
      setActiveTab('timestamps')
      addDebugLog('Video generation completed successfully')

      try {
        await ffmpeg.deleteFile('input.mp4')
        await ffmpeg.deleteFile('audio.mp3')
        await ffmpeg.deleteFile('subtitles.srt')
        await ffmpeg.deleteFile('output.mp4')
      } catch (cleanupError) {
        addDebugLog('Warning: Temporary files cleanup failed')
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate video'
      setError(errorMessage)
      addDebugLog(`Error: ${errorMessage}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 flex flex-col items-center" style={{ backgroundImage: `url(${bgSvg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="w-full max-w-[1400px] mx-auto flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-8 lg:h-[calc(100vh-4rem)]">
        <div className={`flex-grow lg:flex-grow-0 flex items-center justify-center h-full w-full max-w-[600px]`}>
          <div className="w-full bg-white border border-[#00000028] p-6 shadow flex flex-col justify-between h-full">
            <div className="space-y-4 flex-grow flex flex-col">
              <div className="flex">
                <button
                  className={`px-4 py-2 ${activeTab === 'script' ? 'border-b-2 border-accent text-accent' : 'text-gray-500'}`}
                  onClick={() => setActiveTab('script')}
                >
                  Script
                </button>
                <button
                  className={`px-4 py-2 ${activeTab === 'timestamps' ? 'border-b-2 border-accent text-accent' : 'text-gray-500'} ${!srtContent ? 'cursor-not-allowed opacity-50' : ''}`}
                  onClick={() => srtContent && setActiveTab('timestamps')}
                  disabled={!srtContent}
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
                    className="w-full p-2 border focus:ring-1 focus:ring-accent flex-grow"
                  />
                </div>
              ) : (
                <div className="flex flex-col flex-grow">
                  <textarea
                    value={srtContent}
                    onChange={(e) => setSrtContent(e.target.value)}
                    placeholder="Edit timestamps here..."
                    className="w-full p-2 border focus:ring-1 focus:ring-accent flex-grow"
                    disabled={!srtContent}
                  />
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 text-red-700 mt-4">
                  {error}
                </div>
              )}
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Select Category
                </label>
                <div className="flex justify-between pb-2">
                  {CATEGORIES.map(category => (
                    <button
                      key={category.id}
                      onClick={() => {
                        setSelectedCategory(category.id)
                        setCustomVideo(null)
                      }}
                      className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                        selectedCategory === category.id
                          ? 'bg-accent/10 text-accent font-medium'
                          : 'bg-transparent text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                  <label className="cursor-pointer flex-shrink-0">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      className="hidden"
                    />
                    <div className="p-2 rounded-full border-2 hover:bg-gray-200 transition-colors flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                  </label>
                </div>
                {customVideo && (
                  <p className="text-sm text-gray-500">
                    Using custom video: {customVideo.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleGenerate}
                  disabled={!script.trim() || isProcessing}
                  className="w-full bg-accent text-white py-2 px-4 rounded hover:brightness-90 disabled:bg-gray-400 transition-all"
                >
                  {isProcessing ? `Processing... ${progress}%` : 'Generate Reel'}
                </button>
                
                {isProcessing && (
                  <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showDebug ? 'Hide Debug Logs' : 'Show Debug Logs'}
                  </button>
                )}
                
                {showDebug && isProcessing && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono overflow-auto max-h-40">
                    {debugLogs.map((log, index) => (
                      <div key={index} className="text-gray-600">
                        {log}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {finalVideoUrl && (
          <div className="flex-shrink-0 h-full flex items-center justify-center w-auto" style={{ aspectRatio: '9 / 16' }}>
            <div className="bg-white border border-[#00000028] p-6 shadow flex flex-col justify-between h-full">
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