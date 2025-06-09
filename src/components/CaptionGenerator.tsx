interface CaptionGeneratorProps {
    text: string
  }
  
  export default function CaptionGenerator({ text }: CaptionGeneratorProps) {
    return (
      <div className="bg-white p-4 rounded-lg shadow z-50">
        <h2 className="font-medium mb-2">Generated Captions</h2>
        <div className="p-3 bg-gray-100 rounded">
          {text.split('\n').map((line, i) => (
            <p key={i} className="mb-2 last:mb-0">{line}</p>
          ))}
        </div>
      </div>
    )
  }