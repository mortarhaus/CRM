# Runbook: Phase 2 storage (S3-compatible adapter, MinIO, workspace logo)

Scope: Phase 2 PR 4 (plan `docs/superpowers/plans/2026-11-04-phase-2-settings-onboarding.md`, Tasks 10-12): the storage adapter
(`apps/web/src/adapters/storage/`), MinIO in the dev compose and the tests, upload validation
(`apps/web/src/lib/uploads/`), the logo upload on `/settings/branding` and the logo route `/files/logo`.
AWS SDK v3 `3.1158.0`. Decisions: `docs/DECISIONS.md`, 2026-11-11.

"Verified" means the test named was run on 2026-11-11 against MinIO `RELEASE.2025-09-07T16-13-09Z` (Testcontainers,
and the `minio` compose service). Nothing here was run against AWS S3 or Cloudflare R2.

## Settings

Web process only (the worker and the migrate/bootstrap steps do not read them).

| Variable | Meaning |
|---|---|
| `STORAGE_ENDPOINT` | `http(s)://` URL of an S3-compatible endpoint. Leave unset for AWS S3. |
| `STORAGE_REGION` | Region name; MinIO accepts any, R2 uses `auto`. |
| `STORAGE_BUCKET` | The bucket. It must exist; the app never creates it. |
| `STORAGE_ACCESS_KEY_ID` | Access key. |
| `STORAGE_SECRET_ACCESS_KEY` | Secret key. Never logged: errors carry only the operation and the HTTP status. |
| `STORAGE_FORCE_PATH_STYLE` | `true` for MinIO (`http://host/bucket/key`); `false` or unset for S3/R2. |

**All or none.** With no `STORAGE_*` set, storage is off and the app still boots: the logo upload refuses with
"Logo uploads are not set up on this server yet." (`STORAGE_UNAVAILABLE`) and `/files/logo` answers 404. With some
but not all of region, bucket, access key and secret, boot fails and the log names the missing variable (never a
value; `apps/web/src/lib/env.ts`, tested in `env.test.ts`).

Production keys come from the host's secret store, never from a committed file. Give the key access to the one
bucket only, with `GetObject`, `PutObject` and `HeadObject` (no delete, no list).

## Development MinIO

`pnpm stack:up` starts `minio` (container `crm-minio`, API on `127.0.0.1:9100`) and a one-shot `minio-init` that
creates the bucket `crm-dev` (`mc mb --ignore-existing`, so a restart is harmless). The web container gets
`STORAGE_*` from the compose file. The root user `crm-minio-dev-only` / `crm-minio-dev-only-password` is a
**dev-only placeholder**, bound to localhost; never reuse it anywhere else. Data is in the `miniodata` volume
(`pnpm stack:down` keeps it; `docker compose -f docker/compose.dev.yml down -v` removes it).

For `pnpm dev` on the host, uncomment the `STORAGE_*` block in `.env` (it points at `http://localhost:9100`) and
start MinIO with `docker compose -f docker/compose.dev.yml up -d --wait minio minio-init`.

The tests start their own MinIO (`apps/web/src/test/minio.ts`, container `crm-test-minio-<8 hex>`, test-only
credentials, bucket `crm-test`) and remove it afterwards. A leftover one can be removed with
`docker rm -f $(docker ps -aq --filter name=crm-test-minio)`.

`container_name: crm-minio` is fixed (plan Task 11), so only one compose project with MinIO can run on a machine at
a time. A second checkout needs a compose override that renames it.

### Image source (open, 2026-11-11)

The image is pinned as
`minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e`
(compose and `MINIO_IMAGE` in `apps/web/src/test/minio.ts`; a test keeps the two equal). MinIO no longer publishes
the community image: on 2026-11-11 Docker Hub answered "not found" for `minio/minio` and `quay.io/minio/minio`
asked for credentials. The digest was taken from a copy already on the build machine (`docker image inspect`: the
image Id equals the digest; labels `release` and `version` `RELEASE.2025-09-07T16-13-09Z`, vendor MinIO Inc.).
**A machine without that copy, including CI, cannot pull it.** Choosing another source is an owner decision
(DECISIONS 2026-11-11).

## Objects

- **Keys:** `ws/{workspace_id}/{uuid}` for a logo (`newUploadKey`); the database CHECK on
  `workspace_settings.logo_key` enforces the shape. The workspace id prefix keeps every object in its tenant.
- **Writes** set `Content-Type` from the detected type (never the client's), `Content-Disposition: attachment`,
  and, with `ifNoneMatch`, `If-None-Match: *`.
- **Conditional put (verified, MinIO):** a put with `If-None-Match: *` of an existing key answers 412 and leaves the
  object as it was; the adapter returns `{ created: false }` (`s3.contract.test.ts`). AWS S3 documents the same
  behaviour; R2 is not verified.
- **No delete.** The adapter has no delete method. Replacing a logo writes a new key and leaves the old object;
  orphans are removed by the Phase 9 purge, which adds its own delete method.
- **Signed URLs:** `signedGetUrl(key, ttl)` with 1 ≤ ttl ≤ 600 seconds and `response-content-disposition=attachment`.
  Verified on MinIO: expires (403 after the ttl) and answers with `X-Content-Type-Options: nosniff`. S3 and R2 do
  not add `nosniff` on their own; no page uses signed URLs yet, so whoever adds one must decide how nosniff is set.

## Uploads

`validateUpload(bytes, { allowed, maxBytes })` (`apps/web/src/lib/uploads/validate.ts`) runs before any put: empty,
then size, then magic bytes (PNG `89 50 4E 47 0D 0A 1A 0A`, JPG `FF D8 FF`, PDF `25 50 44 46` only where a
caller allows it). The client's MIME type and file name are ignored. SVG and HTML never pass, whatever their name.

The logo: PNG or JPG, at most `LOGO_MAX_BYTES` = 2 MiB (2,097,152 bytes, `packages/core/src/security/limits.ts`).
Admin and Owner, through `action()` (audited as `workspace_settings.updated` with the `logo_key` before and after).

**Server-action body limit:** `experimental.serverActions.bodySizeLimit` in `apps/web/next.config.ts` is
`LOGO_MAX_BYTES + 64 KiB` (2,162,688 bytes; Next's default is 1 MB), so a 2 MiB file plus the multipart framing and
the other fields fits. A larger post is refused by Next before the action runs; with JavaScript the page refuses
an oversize file before sending it. A future upload with a larger limit must raise this value deliberately.

## Serving the logo

`GET /files/logo?id={uuid}` (`apps/web/src/app/(app)/files/logo/route.ts`): signed-in member of the active
workspace (any role), and the id must be that workspace's current `logo_key`. Anything else, including a member of
another workspace, signed out, an old or unknown id, storage off, or a stored type other than PNG/JPG, is 404 with
`Cache-Control: no-store`. A hit streams the object with its stored type, `X-Content-Type-Options: nosniff`,
`Content-Disposition: attachment` and `Cache-Control: private, max-age=3600`. The CSP `img-src 'self' blob: data:`
is unchanged.

## Rotating the storage key

1. Create a new key with the same bucket-only permissions.
2. Put it in the host's secret store as `STORAGE_ACCESS_KEY_ID` and `STORAGE_SECRET_ACCESS_KEY`; restart web.
3. Check a logo still loads on `/settings/branding`, then revoke the old key.

## Failure signs

- Upload shows "We couldn't upload the logo. Try again.": the adapter threw a `StorageError` (operation and status
  only), which `action()` rethrows, so Next logs it as a server error. 403 is a key or permission problem; 404 a
  missing bucket; a network error name, an endpoint problem.
- Logo shows as a broken image: the object is missing from the bucket (the route answers 404).
