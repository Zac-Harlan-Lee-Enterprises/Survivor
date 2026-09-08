import {
  IMAGE_MAX_BYTES,
  ImageContentTypeSchema,
  type ImageContentType,
  type PlayerImage,
} from '@domain/index'
import { HttpError } from './http'

/**
 * Headshot storage. Binaries live in S3; records hold keys only.
 *
 * Flow: commissioner asks for an upload ticket → browser POSTs each variant
 * straight to S3 with a presigned POST whose policy pins the content type and
 * caps the size (server-enforced by S3 itself) → commissioner finalizes →
 * the API HEADs both objects, re-validates type and size, then writes the
 * PlayerImage record. No AWS credentials ever reach the browser; the bucket
 * is never public-write.
 */

export const VARIANTS = ['thumb', 'medium'] as const
export type Variant = (typeof VARIANTS)[number]

export interface PresignedPost {
  url: string
  fields: Record<string, string>
}

export interface ObjectHead {
  contentType: string | undefined
  contentLength: number | undefined
}

/** The slice of S3 the image flow needs — mockable in tests. */
export interface ObjectStorage {
  presignPost(key: string, contentType: ImageContentType, maxBytes: number): Promise<PresignedPost>
  head(key: string): Promise<ObjectHead | null>
  delete(key: string): Promise<void>
}

export function imageKey(imageId: string, variant: Variant, contentType: ImageContentType): string {
  const ext = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'webp'
  return `images/${imageId}/${variant}.${ext}`
}

export function validateImageMeta(meta: {
  contentType: string
  sizeBytes: number
}): ImageContentType {
  const type = ImageContentTypeSchema.safeParse(meta.contentType)
  if (!type.success) {
    throw new HttpError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Headshots must be JPG, PNG or WebP.')
  }
  if (!Number.isFinite(meta.sizeBytes) || meta.sizeBytes <= 0) {
    throw new HttpError(400, 'IMAGE_EMPTY', 'The image is empty.')
  }
  if (meta.sizeBytes > IMAGE_MAX_BYTES) {
    throw new HttpError(413, 'IMAGE_TOO_LARGE', 'Headshots must be 5 MB or smaller.')
  }
  return type.data
}

export interface UploadTicket {
  imageId: string
  uploads: Record<Variant, PresignedPost>
}

export async function createUploadTicket(
  storage: ObjectStorage,
  playerId: string,
  meta: { contentType: string; sizeBytes: number },
  newId: () => string,
): Promise<UploadTicket> {
  const contentType = validateImageMeta(meta)
  const imageId = `${playerId}-${newId()}`
  const [thumb, medium] = await Promise.all(
    VARIANTS.map((v) =>
      storage.presignPost(imageKey(imageId, v, contentType), contentType, IMAGE_MAX_BYTES),
    ),
  )
  return { imageId, uploads: { thumb: thumb!, medium: medium! } }
}

export async function finalizeImage(
  storage: ObjectStorage,
  input: {
    imageId: string
    playerId: string
    contentType: string
    sizeBytes: number
    width: number
    height: number
  },
  now: string,
): Promise<PlayerImage> {
  const contentType = validateImageMeta(input)
  if (!input.imageId.startsWith(`${input.playerId}-`)) {
    throw new HttpError(400, 'IMAGE_MISMATCH', 'That image ticket belongs to a different player.')
  }
  const keys = {
    thumb: imageKey(input.imageId, 'thumb', contentType),
    medium: imageKey(input.imageId, 'medium', contentType),
  }
  for (const [variant, key] of Object.entries(keys)) {
    const head = await storage.head(key)
    if (!head)
      throw new HttpError(409, 'UPLOAD_INCOMPLETE', `The ${variant} image was not uploaded.`)
    if (head.contentType !== contentType) {
      await storage.delete(key)
      throw new HttpError(
        415,
        'UNSUPPORTED_IMAGE_TYPE',
        `Uploaded ${variant} is ${head.contentType ?? 'unknown'}, expected ${contentType}.`,
      )
    }
    if ((head.contentLength ?? 0) <= 0 || (head.contentLength ?? 0) > IMAGE_MAX_BYTES) {
      await storage.delete(key)
      throw new HttpError(413, 'IMAGE_TOO_LARGE', `Uploaded ${variant} exceeds 5 MB.`)
    }
  }
  return {
    id: input.imageId,
    playerId: input.playerId,
    contentType,
    sizeBytes: input.sizeBytes,
    width: input.width,
    height: input.height,
    variants: keys,
    createdAt: now,
  }
}

export async function deleteImageObjects(
  storage: ObjectStorage,
  image: PlayerImage,
): Promise<void> {
  await Promise.all(
    Object.values(image.variants).map((key) => storage.delete(key).catch(() => undefined)),
  )
}
