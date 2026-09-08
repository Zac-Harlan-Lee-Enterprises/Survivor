import { useEffect, useRef, useState, type DragEvent } from 'react'
import { ImagePlus, Trash2, Upload } from 'lucide-react'
import { useServices } from '@/app/hooks'
import { useInvalidateSeason } from '@/app/queries'
import type { ImageContentType, PlayerProfile } from '@/domain'
import { Headshot } from '@/components/Headshot'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/Notice'
import { errorMessage } from '@/lib/errors'
import {
  loadImage,
  renderSquare,
  validateImageFile,
  VARIANT_SIZES,
  type CropState,
} from '@/lib/image'

/**
 * Drag-and-drop headshot upload with a square crop preview. Files are
 * validated in the browser (type, size), cropped/resized to two variants,
 * uploaded straight to storage via presigned POSTs (connected mode) and then
 * finalized through the API, which validates them again.
 */
export function HeadshotUploader({ profile }: { profile: PlayerProfile }) {
  const { images } = useServices()
  const invalidate = useInvalidateSeason()
  const [file, setFile] = useState<File | null>(null)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [crop, setCrop] = useState<CropState>({ zoom: 1, x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!img || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const base = Math.min(img.naturalWidth, img.naturalHeight)
    const size = base / Math.max(1, crop.zoom)
    const maxX = (img.naturalWidth - size) / 2
    const maxY = (img.naturalHeight - size) / 2
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(
      img,
      maxX + crop.x * maxX,
      maxY + crop.y * maxY,
      size,
      size,
      0,
      0,
      canvas.width,
      canvas.height,
    )
  }, [img, crop])

  const choose = async (f: File | undefined) => {
    setNotice(null)
    if (!f) return
    const v = validateImageFile(f)
    if (!v.ok) {
      setNotice({ tone: 'error', text: v.reason })
      return
    }
    try {
      const loaded = await loadImage(f)
      setFile(f)
      setImg(loaded)
      setCrop({ zoom: 1, x: 0, y: 0 })
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    void choose(e.dataTransfer.files[0])
  }

  const save = async () => {
    if (!file || !img) return
    setBusy(true)
    setNotice(null)
    try {
      const type: ImageContentType = 'image/webp'
      const [thumb, medium] = await Promise.all([
        renderSquare(img, crop, VARIANT_SIZES.thumb, type),
        renderSquare(img, crop, VARIANT_SIZES.medium, type),
      ])
      const ticket = await images.requestUpload(profile.playerId, {
        contentType: type,
        sizeBytes: medium.size,
      })
      await images.uploadVariant(ticket.uploads.thumb, thumb)
      await images.uploadVariant(ticket.uploads.medium, medium)
      await images.finalizeUpload(profile.playerId, ticket.imageId, {
        contentType: type,
        sizeBytes: medium.size,
        width: VARIANT_SIZES.medium,
        height: VARIANT_SIZES.medium,
      })
      invalidate()
      setFile(null)
      setImg(null)
      setNotice({ tone: 'success', text: `New headshot saved for ${profile.displayName}.` })
    } catch (err) {
      setNotice({ tone: 'error', text: `Upload failed: ${errorMessage(err)} Nothing was changed.` })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setNotice(null)
    try {
      await images.removeImage(profile.playerId)
      invalidate()
      setNotice({ tone: 'success', text: 'Headshot removed. The default avatar will show.' })
    } catch (err) {
      setNotice({ tone: 'error', text: errorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <Headshot name={profile.displayName} playerId={profile.playerId} size="lg" />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <ImagePlus className="h-4 w-4" aria-hidden="true" />{' '}
            {profile.imageId ? 'Replace headshot' : 'Add headshot'}
          </Button>
          {profile.imageId && (
            <Button variant="outline" size="sm" onClick={() => void remove()} disabled={busy}>
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
            </Button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label={`Choose a headshot for ${profile.displayName}`}
          onChange={(e) => void choose(e.target.files?.[0])}
        />
      </div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-sm text-ink-300 transition ${dragging ? 'border-gold-400 bg-gold-400/10' : 'border-white/15 hover:border-white/30'}`}
        aria-label="Drop an image here or press Enter to choose a file"
      >
        <Upload className="h-4 w-4" aria-hidden="true" /> Drop a JPG, PNG or WebP here (max 5 MB)
      </div>
      {img && (
        <div className="card flex flex-col gap-4 p-4 sm:flex-row">
          <canvas
            ref={canvasRef}
            width={192}
            height={192}
            className="h-48 w-48 shrink-0 rounded-full bg-pitch-900 ring-2 ring-gold-400"
            aria-label="Crop preview"
          />
          <div className="flex-1 space-y-3">
            <p className="text-sm text-ink-200">{file?.name} · adjust the crop, then save.</p>
            <Slider
              label="Zoom"
              min={1}
              max={3}
              step={0.05}
              value={crop.zoom}
              onChange={(zoom) => setCrop((c) => ({ ...c, zoom }))}
            />
            <Slider
              label="Horizontal"
              min={-1}
              max={1}
              step={0.02}
              value={crop.x}
              onChange={(x) => setCrop((c) => ({ ...c, x }))}
            />
            <Slider
              label="Vertical"
              min={-1}
              max={1}
              step={0.02}
              value={crop.y}
              onChange={(y) => setCrop((c) => ({ ...c, y }))}
            />
            <div className="flex gap-2">
              <Button onClick={() => void save()} disabled={busy}>
                {busy ? 'Uploading…' : 'Save headshot'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setImg(null)
                  setFile(null)
                }}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
    </div>
  )
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
}) {
  const id = `slider-${label.toLowerCase()}`
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-ink-300">
        {label}
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-gold-400"
      />
    </div>
  )
}
