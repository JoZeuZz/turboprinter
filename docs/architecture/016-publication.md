# 016 Publication Architecture

## Model

`Publication` represents one attempt to publish a rendered `VideoOutput` to a platform. It stores project/workspace linkage, platform/channel metadata, title, description, tags, thumbnail path, privacy, schedule, status, errors, dry-run flag, and provider metadata.

Statuses in this phase: `draft`, `publishing`, `published`, `failed`.

## Dry-Run Flow

1. Render project first.
2. Create draft with `POST /api/v1/projects/{project_id}/publication/draft`.
3. Backend requires `render_result.json` with `success=true` and an output path.
4. Metadata comes from manual input, `content_package.json`, or fallback project/script data.
5. Publish with `POST /api/v1/publications/{publication_id}/publish` and `dry_run=true`.
6. `DryRunPublisher` performs no network call and writes `external_video_id="dry-run:<publication_id>"`.

## Jobs

The `publish_video` job expects payload:

```json
{"publication_id": "...", "dry_run": true}
```

Dry-run jobs call the same publication service and persist status changes.

## YouTube Preparation

`YouTubePublisher` exists as a disabled seam. Config names the environment variables future OAuth code will read, but no credentials are required and no upload occurs by default.

```toml
[publication.youtube]
enabled = false
client_id_env = "YOUTUBE_CLIENT_ID"
client_secret_env = "YOUTUBE_CLIENT_SECRET"
token_env = "YOUTUBE_OAUTH_TOKEN"
```

## Security

- Dry-run performs no network calls.
- Real YouTube upload is disabled by default.
- No OAuth token is stored in config or database in this phase.
- Do not expose token values in logs or UI.
- No bulk publication endpoint exists.
- Future token storage must define encryption, rotation, revocation, and ownership checks before real upload.

## Limitations

- OAuth consent and callback routes are not implemented.
- Real resumable YouTube upload is not implemented.
- Metrics ingestion is not implemented.
- Scheduling is limited to storing `scheduled_at` and using existing jobs scheduling.
- Only YouTube platform seam exists.

## Missing For Real OAuth

- OAuth consent flow and callback endpoint.
- Encrypted refresh-token storage.
- Channel ownership validation.
- Token revocation and rotation.
- Resumable upload, quota handling, retry policy, audit logging.
- Mocked Google API tests with no real credentials.
