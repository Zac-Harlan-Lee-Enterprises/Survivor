import { DeleteObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import type { ImageContentType } from '@domain/index'
import type { ObjectStorage } from './images'

/** S3-backed ObjectStorage. Presigned POST policies are enforced by S3 itself. */
export function createS3Storage(
  bucket: string,
  client: S3Client = new S3Client({}),
): ObjectStorage {
  return {
    async presignPost(key: string, contentType: ImageContentType, maxBytes: number) {
      const { url, fields } = await createPresignedPost(client, {
        Bucket: bucket,
        Key: key,
        Conditions: [
          ['content-length-range', 1, maxBytes],
          ['eq', '$Content-Type', contentType],
          ['eq', '$key', key],
        ],
        Fields: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
        Expires: 300,
      })
      return { url, fields }
    },
    async head(key: string) {
      try {
        const r = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
        return { contentType: r.ContentType, contentLength: r.ContentLength }
      } catch (err) {
        if (
          (err as { name?: string }).name === 'NotFound' ||
          (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
        )
          return null
        throw err
      }
    },
    async delete(key: string) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    },
  }
}
