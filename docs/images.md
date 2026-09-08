# Headshots

Every participant has a headshot; the UI leans on them everywhere (`Headshot` component: status ring, bubble ring, graveyard desaturation, default avatar, alt text `Headshot of <name>`).

## Storage model

- Records (`PlayerImage`) hold **keys only**: `variants.thumb` (~128px) and `variants.medium` (~512px). Binaries live in S3 (connected) or under `public/headshots/` (demo placeholders) — never in DynamoDB.
- `ImageRepository.variantUrl(image, variant)` resolves a key to a URL for the current mode; `defaultAvatarUrl()` covers players without an image or whose image fails to load.

## Upload flow (connected mode)

1. Commissioner drops a file (`HeadshotUploader`): browser validation — JPG/PNG/WebP, ≤ 5 MB (`validateImageFile`).
2. Square crop with zoom/pan preview; the browser renders two WebP variants with canvas (`renderSquare`). No Lambda image processing.
3. `POST /players/{id}/image/upload-ticket` (commissioner only) → API validates type/size again and returns two **presigned S3 POSTs** whose policies pin the key, the exact `Content-Type` and `content-length-range` (1 byte … 5 MB). S3 enforces these.
4. Browser POSTs each variant straight to S3 (no AWS credentials involved).
5. `POST /players/{id}/image/finalize` → API `HEAD`s both objects, re-checks content type and length, **deletes** non-conforming objects, writes the `PlayerImage` record, updates `profile.imageId`, deletes the previous image's objects.
6. `DELETE /players/{id}/image` removes objects and record; the default avatar shows.

The bucket blocks public ACLs and allows public **read** only under `images/*`. There is no public write path.

Tests: `backend/src/routes/images.test.ts` (valid, invalid type, oversized, mismatch, replacement, removal, authorization), `src/lib/image.test.ts` (client validation, crop math), `src/components/Headshot.test.tsx` (default avatar on missing/failed image).

## Demo mode

Uploads are stored as data URLs in localStorage (same validation, same two-variant flow), so the commissioner experience can be tried without AWS. Sample headshots are generated SVG placeholders (`npm run headshots:generate`).
