import { beforeEach, describe, expect, it } from 'vitest'
import { kickoffFor, scenario } from '@domain/testing/scenario'
import { createHarness, type Harness } from '../testing/harness'

const commish = { sub: 'sub-c', email: 'commish@example.com' }
const NOW = kickoffFor(1, -48)

describe('headshot upload flow', () => {
  let h: Harness
  beforeEach(async () => {
    h = await createHarness(
      scenario()
        .player('commish', { role: 'commissioner' })
        .players('ann')
        .game(1, 'GB', 'CHI')
        .build(),
      NOW,
    )
  })

  it('issues presigned POSTs for a valid image and finalizes after verifying the objects', async () => {
    const ticket = await h.call('POST', '/players/ann/image/upload-ticket', {
      ...commish,
      body: { contentType: 'image/webp', sizeBytes: 40_000 },
    })
    expect(ticket.status).toBe(200)
    expect(ticket.body.imageId).toMatch(/^ann-/)
    expect(ticket.body.uploads.thumb.fields.key).toBe(`images/${ticket.body.imageId}/thumb.webp`)
    expect(ticket.body.uploads.medium.fields['Content-Type']).toBe('image/webp')

    // Nothing uploaded yet → finalize refuses.
    const early = await h.call('POST', '/players/ann/image/finalize', {
      ...commish,
      body: {
        imageId: ticket.body.imageId,
        contentType: 'image/webp',
        sizeBytes: 40_000,
        width: 512,
        height: 512,
      },
    })
    expect(early.status).toBe(409)

    h.storage.upload(`images/${ticket.body.imageId}/thumb.webp`, {
      contentType: 'image/webp',
      contentLength: 5_000,
    })
    h.storage.upload(`images/${ticket.body.imageId}/medium.webp`, {
      contentType: 'image/webp',
      contentLength: 40_000,
    })
    const done = await h.call('POST', '/players/ann/image/finalize', {
      ...commish,
      body: {
        imageId: ticket.body.imageId,
        contentType: 'image/webp',
        sizeBytes: 40_000,
        width: 512,
        height: 512,
      },
    })
    expect(done.status).toBe(200)
    expect(done.body.variants).toEqual({
      thumb: `images/${ticket.body.imageId}/thumb.webp`,
      medium: `images/${ticket.body.imageId}/medium.webp`,
    })
    const profile = await h.call('GET', '/players/ann/profile')
    expect(profile.body.imageId).toBe(ticket.body.imageId)
    expect(profile.body.email).toBeUndefined()
  })

  it('rejects unsupported types and oversized images before issuing a ticket', async () => {
    expect(
      (
        await h.call('POST', '/players/ann/image/upload-ticket', {
          ...commish,
          body: { contentType: 'image/gif', sizeBytes: 10 },
        })
      ).status,
    ).toBe(415)
    expect(
      (
        await h.call('POST', '/players/ann/image/upload-ticket', {
          ...commish,
          body: { contentType: 'image/svg+xml', sizeBytes: 10 },
        })
      ).status,
    ).toBe(415)
    expect(
      (
        await h.call('POST', '/players/ann/image/upload-ticket', {
          ...commish,
          body: { contentType: 'image/png', sizeBytes: 5 * 1024 * 1024 + 1 },
        })
      ).status,
    ).toBe(413)
    expect(
      (
        await h.call('POST', '/players/ann/image/upload-ticket', {
          ...commish,
          body: { contentType: 'image/png', sizeBytes: 0 },
        })
      ).status,
    ).toBe(400)
  })

  it('rejects an object whose real type or size differs from the ticket, and deletes it', async () => {
    const ticket = await h.call('POST', '/players/ann/image/upload-ticket', {
      ...commish,
      body: { contentType: 'image/png', sizeBytes: 1000 },
    })
    h.storage.upload(`images/${ticket.body.imageId}/thumb.png`, {
      contentType: 'text/html',
      contentLength: 100,
    })
    h.storage.upload(`images/${ticket.body.imageId}/medium.png`, {
      contentType: 'image/png',
      contentLength: 100,
    })
    const r = await h.call('POST', '/players/ann/image/finalize', {
      ...commish,
      body: {
        imageId: ticket.body.imageId,
        contentType: 'image/png',
        sizeBytes: 1000,
        width: 512,
        height: 512,
      },
    })
    expect(r.status).toBe(415)
    expect(h.storage.deleted).toContain(`images/${ticket.body.imageId}/thumb.png`)

    const big = await h.call('POST', '/players/ann/image/upload-ticket', {
      ...commish,
      body: { contentType: 'image/png', sizeBytes: 1000 },
    })
    h.storage.upload(`images/${big.body.imageId}/thumb.png`, {
      contentType: 'image/png',
      contentLength: 100,
    })
    h.storage.upload(`images/${big.body.imageId}/medium.png`, {
      contentType: 'image/png',
      contentLength: 6 * 1024 * 1024,
    })
    expect(
      (
        await h.call('POST', '/players/ann/image/finalize', {
          ...commish,
          body: {
            imageId: big.body.imageId,
            contentType: 'image/png',
            sizeBytes: 1000,
            width: 512,
            height: 512,
          },
        })
      ).status,
    ).toBe(413)
  })

  it('replacing a headshot deletes the previous objects; removing restores the default avatar', async () => {
    const upload = async () => {
      const t = await h.call('POST', '/players/ann/image/upload-ticket', {
        ...commish,
        body: { contentType: 'image/jpeg', sizeBytes: 500 },
      })
      h.storage.upload(`images/${t.body.imageId}/thumb.jpg`, {
        contentType: 'image/jpeg',
        contentLength: 100,
      })
      h.storage.upload(`images/${t.body.imageId}/medium.jpg`, {
        contentType: 'image/jpeg',
        contentLength: 500,
      })
      await h.call('POST', '/players/ann/image/finalize', {
        ...commish,
        body: {
          imageId: t.body.imageId,
          contentType: 'image/jpeg',
          sizeBytes: 500,
          width: 512,
          height: 512,
        },
      })
      return t.body.imageId as string
    }
    const first = await upload()
    const second = await upload()
    expect(h.storage.deleted).toEqual(
      expect.arrayContaining([`images/${first}/thumb.jpg`, `images/${first}/medium.jpg`]),
    )
    expect(await h.repo.listImages(['ann'])).toHaveLength(1)
    expect((await h.call('GET', '/players/ann/profile')).body.imageId).toBe(second)

    expect((await h.call('DELETE', '/players/ann/image', commish)).status).toBe(204)
    expect((await h.call('GET', '/players/ann/profile')).body.imageId).toBeNull()
    expect(await h.repo.listImages(['ann'])).toHaveLength(0)
  })

  it('players cannot upload headshots for others; a ticket cannot be finalized for another player', async () => {
    const ann = { sub: 'sub-ann', email: 'ann@example.com' }
    expect(
      (
        await h.call('POST', '/players/ann/image/upload-ticket', {
          ...ann,
          body: { contentType: 'image/png', sizeBytes: 10 },
        })
      ).status,
    ).toBe(403)
    const ticket = await h.call('POST', '/players/ann/image/upload-ticket', {
      ...commish,
      body: { contentType: 'image/png', sizeBytes: 10 },
    })
    const r = await h.call('POST', '/players/commish/image/finalize', {
      ...commish,
      body: {
        imageId: ticket.body.imageId,
        contentType: 'image/png',
        sizeBytes: 10,
        width: 1,
        height: 1,
      },
    })
    expect(r.status).toBe(400)
  })
})
