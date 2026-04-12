import React, { useCallback, useState } from 'react'
import { uploadFiles } from '../api/client'

interface Props {
  onUploaded?: (count: number, names: string[]) => void
}

export default function FileUpload({ onUploaded }: Props) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files)
      if (arr.length === 0) return
      setUploading(true)
      setError(null)
      setResult(null)
      try {
        const res = await uploadFiles(arr)
        setResult(`Naloženih ${res.count} datotek.`)
        onUploaded?.(res.count, res.uploaded)
      } catch (e: unknown) {
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
    <div className="card">
      <h2 className="text-lg font-semibold mb-3">Naloži podatke</h2>
      <label
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${dragging ? 'border-blue-400 bg-blue-900/20' : 'border-gray-700 hover:border-gray-500'
          }`}
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
        <div className="text-3xl mb-2">📂</div>
        <p className="text-gray-400 text-sm">
          Povleci in spusti CSV ali ZIP datoteke sem, ali <span className="text-blue-400 underline">klikni za izbiro</span>
        </p>
        <p className="text-gray-600 text-xs mt-1">Podprti formati: .csv, .zip — max 50 MB</p>
      </label>

      {uploading && (
        <div className="mt-3 flex items-center gap-2 text-sm text-blue-400">
          <span className="animate-spin">⏳</span> Nalaganje...
        </div>
      )}
      {result && <div className="mt-3 text-sm text-green-400">✓ {result}</div>}
      {error && <div className="mt-3 text-sm text-red-400">✗ {error}</div>}
    </div>
  )
}
