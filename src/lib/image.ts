import { IMAGE_MAX_BYTES, type ImageContentType } from '@/domain'

/**
 * Browser-side headshot preparation. The commissioner crops a square and the
 * browser renders two variants (128px thumb, 512px medium) so no server-side
 * image processing is needed. Server-side validation (type + size) still
 * happens on the presigned upload and on finalize — this is convenience,
 * not enforcement.
 */

export const ACCEPTED_IMAGE_TYPES: ImageContentType[] = ['image/jpeg', 'image/png', 'image/webp']
export const VARIANT_SIZES = { thumb: 128, medium: 512 } as const

export type ImageValidation = { ok: true } | { ok: false; reason: string }

export function validateImageFile(file: {
  type: string
  size: number
  name?: string
}): ImageValidation {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type as ImageContentType)) {
    return {
      ok: false,
      reason: `Unsupported image type${file.type ? ` (${file.type})` : ''}. Use a JPG, PNG or WebP.`,
    }
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return {
      ok: false,
      reason: `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`,
    }
  }
  if (file.size <= 0) return { ok: false, reason: 'That file is empty.' }
  return { ok: true }
}

export function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file could not be decoded as an image.'))
    }
    img.src = url
  })
}

export interface CropState {
  /** 1 = the largest centred square that fits; 2 = zoomed in 2x. */
  zoom: number
  /** Pan offsets in [-1, 1]; 0 = centred. */
  x: number
  y: number
}

export function cropRect(
  width: number,
  height: number,
  crop: CropState,
): { sx: number; sy: number; size: number } {
  const base = Math.min(width, height)
  const size = base / Math.max(1, crop.zoom)
  const maxX = (width - size) / 2
  const maxY = (height - size) / 2
  return {
    sx: Math.round(maxX + crop.x * maxX),
    sy: Math.round(maxY + crop.y * maxY),
    size: Math.round(size),
  }
}

export async function renderSquare(
  img: HTMLImageElement,
  crop: CropState,
  size: number,
  type: ImageContentType = 'image/webp',
): Promise<Blob> {
  const { sx, sy, size: s } = cropRect(img.naturalWidth, img.naturalHeight, crop)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, s, s, 0, 0, size, size)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image.'))),
      type,
      0.86,
    )
  })
}
