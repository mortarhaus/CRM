# Runbook: Phase 2 storage (S3-compatible adapter, MinIO, workspace logo)

Scope: Phase 2 PR 4 (plan `docs/superpowers/plans/2026-11-04-phase-2-settings-onboarding.md`, Tasks 10-12): the storage adapter
(`apps/web/src/adapters/storage/`), MinIO in the dev compose and the tests, upload validation
(`apps/web/src/lib/uploads/`), the logo upload on `/settings/branding` and the logo route `/files/logo`.
AWS SDK v3 `3.1158.0`. Decisions: `docs/DECISIONS.md`, 2026-11-11.

"Verified" means the test named was run on 2026-11-12 against MinIO `pgsty/minio:RELEASE.2026-08-04T00-00-00Z`
(Testcontainers, and the `minio` compose service). Nothing here was run against AWS S3 or Cloudflare R2.

**Production provider: Cloudflare R2** (selected in the approved spec, Decisions → Hosting; changing it needs a
separate spec revision). The adapter is S3-compatible, so MinIO stands in for it in dev and tests. Before the first
real deployment, run the R2 verification below.

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

### Image

`pgsty/minio:RELEASE.2026-08-04T00-00-00Z@sha256:b6bfe7239bfc83fb90d31612d9704d86039dd714f7904b3f1ad68f211e602372`
(multi-arch index digest; compose and `MINIO_IMAGE` in `apps/web/src/test/minio.ts`, kept equal by a test in
`env.test.ts`). MinIO no longer publishes the community image (`minio/minio` and `minio/mc` are gone from Docker
Hub), so this is the `pgsty` community fork (https://github.com/pgsty/minio), chosen by the owner on 2026-11-12. It
ships `minio` and `mc`, the upstream entrypoint, port 9000 and the `MINIO_ROOT_*` names. It is for dev and tests
only; revisit it before the first real deployment.

To move to a newer release: pick the newest `RELEASE.*` tag at least two weeks old on Docker Hub, read its index
digest with `docker buildx imagetools inspect pgsty/minio:<tag>`, change both pins, and run
`pnpm vitest run apps/web/src/adapters/storage/s3.contract.test.ts` and the image e2e.

## Objects

- **Keys:** `ws/{workspace_id}/{uuid}` for a logo (`newUploadKey`); the database CHECK on
  `workspace_settings.logo_key` enforces the shape. The workspace id prefix keeps every object in its tenant.
- **Writes** set `Content-Type` from the detected type (never the client's), `Content-Disposition: attachment`,
  and, with `ifNoneMatch`, `If-None-Match: *`.
- **Conditional put (verified, MinIO):** a put with `If-None-Match: *` of an existing key answers 412 and leaves the
  object as it was; the adapter returns `{ created: false }` (`s3.contract.test.ts`). AWS S3 documents the same
  behaviour; on R2 it is part of the pre-deployment R2 verification below.
- **No delete.** The adapter has no delete method. Replacing a logo writes a new key and leaves the old object;
  orphans are removed by the Phase 9 purge, which adds its own delete method.
- **No signed URLs.** The adapter has no signed URL method (FILE-04): R2 and S3 do not add
  `X-Content-Type-Options: nosniff` and a presigned GET cannot ask for it, so a direct link to the bucket could not
  meet FILE-04. Every object is served through an app route that sets `nosniff`, `Content-Disposition: attachment`
  and its own type (today only `/files/logo`). A future signed download needs a controlled same-origin or edge
  response that sets expiry ≤ 10 minutes, `Content-Disposition: attachment` and `nosniff`, with a contract test, built
  when it is first needed.

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

## R2 verification (pre-deployment check)

Not yet run. Before the first real deployment, against an R2 bucket with a bucket-only key:

1. Conditional put: a put of an existing key with `If-None-Match: *` answers 412 and leaves the object unchanged
   (run `s3.contract.test.ts` with its config pointed at R2, or the same calls by hand).
2. Response headers: a GET of a stored object returns the stored `Content-Type` and `Content-Disposition: attachment`.
3. Bucket errors: a GET and a HEAD of a missing key, and of a bucket that does not exist, give the results described
   under "Failure signs".

Record the date, the R2 bucket region and the results in `docs/DECISIONS.md`.

## Rotating the storage key

1. Create a new key with the same bucket-only permissions.
2. Put it in the host's secret store as `STORAGE_ACCESS_KEY_ID` and `STORAGE_SECRET_ACCESS_KEY`; restart web.
3. Check a logo still loads on `/settings/branding`, then revoke the old key.

## Failure signs

- Upload shows "We couldn't upload the logo. Try again.": the adapter threw a `StorageError` (operation and status
  only), which `action()` rethrows, so Next logs it as a server error. 403 is a key or permission problem; 404 a
  missing bucket; a network error name, an endpoint problem.
- Logo shows as a broken image: the object is missing from the bucket (the route answers 404).
