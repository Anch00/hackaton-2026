import React, { useCallback, useState } from 'react'
import { uploadFiles } from '../api/client'

interface Props {
  onUploaded?: (count: number, names: string[]) => void
}

export default function FileUpload({ onUploaded }: Props) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files)
      if (arr.length === 0) return
      setUploading(true)
      setError(null)
      setResult(null)
      setUploadProgress(0)

      // Simuliraj progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 80))
      }, 200)

      try {
        const res = await uploadFiles(arr)
        clearInterval(progressInterval)
        setUploadProgress(100)
        setResult(`Uspešno naloženih ${res.count} datotek`)
        setUploadedFiles(res.uploaded)
        onUploaded?.(res.count, res.uploaded)
      } catch (e: unknown) {
        clearInterval(progressInterval)
        const msg = e instanceof Error ? e.message : 'Napaka pri nalaganju.'
        setError(msg)
      } finally {
        setUploading(false)
      }
    },
    [onUploaded]
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  return (
    <div className="card border-blue-800/30">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">⬆</span>
        <h2 className="text-lg font-semibold text-gray-200">Naloži svoje podatke</h2>
      </div>

      <label
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-200 ${dragging
            ? 'border-blue-400 bg-blue-900/20 scale-[1.02]'
            : 'border-gray-700 bg-gray-800/30 hover:border-gray-500 hover:bg-gray-800/50'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          multiple
          accept=".csv,.zip"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div className="text-4xl mb-3">📂</div>
        <p className="text-gray-300 text-sm font-medium">
          Povleci in spusti datoteke sem
        </p>
        <p className="text-gray-500 text-xs mt-1">
          ali <span className="text-blue-400 hover:text-blue-300 underline cursor-pointer">klikni za izbiro</span>
        </p>
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-600">
          <span className="px-2 py-1 rounded bg-gray-800">.csv</span>
          <span className="px-2 py-1 rounded bg-gray-800">.zip</span>
          <span>max 50 MB</span>
        </div>
      </label>

      {/* Upload Progress */}
      {uploading && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span>
              Nalaganje...
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Success State */}
      {result && (
        <div className="mt-4 p-3 rounded-lg bg-green-900/20 border border-green-800/50">
          <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
            <span>✓</span>
            <span>{result}</span>
          </div>
          {uploadedFiles.length > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              Naloženo: {uploadedFiles.slice(0, 3).join(', ')}
              {uploadedFiles.length > 3 && ` +${uploadedFiles.length - 3} več`}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3">
            Datoteke so naložene. Zdaj lahko preklopiš na "Naloženi" vir in zaženeš analizo.
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mt-4 p-3 rounded-lg bg-red-900/20 border border-red-800/50">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <span>✗</span>
            <span>{error}</span>
          </div>
        </div>
      )}
    </div>
  )
}
