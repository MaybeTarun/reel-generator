interface AudioPlayerProps {
    audioUrl: string
  }
  
  export default function AudioPlayer({ audioUrl }: AudioPlayerProps) {
    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="font-medium mb-2">Voiceover Preview</h2>
        <audio controls src={audioUrl} className="w-full" />
      </div>
    )
  }