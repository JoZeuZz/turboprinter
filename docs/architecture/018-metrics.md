# 018 — Metrics Layer

## Motivation

TurboPrinter should learn from real publication performance, not from render count. This layer stores snapshots for views, impressions, CTR, retention, likes, comments, subscribers, revenue, and RPM by publication age window.

## Data Model

`MetricsSnapshot` stores one current snapshot per `(publication_id, platform, age_window)`. Supported windows are `2h`, `6h`, `24h`, `48h`, `7d`, and `28d`.

Manual entry and jobs upsert snapshots so repeated collection does not duplicate a window.

## Providers

- `ManualMetricsProvider`: builds snapshots from API payloads.
- `StubMetricsProvider`: deterministic local provider used by tests and early operations.
- `YouTubeAnalyticsProvider`: disabled seam for future real Analytics integration. It requires explicit configuration and no tokens are stored in this phase.

## API

- `POST /api/v1/publications/{publication_id}/metrics`
- `GET /api/v1/publications/{publication_id}/metrics`
- `GET /api/v1/workspaces/{workspace_id}/metrics/summary`
- `GET /api/v1/projects/{project_id}/metrics`

All four endpoints are gated behind `publication_enabled` and `project_mode_enabled` config flags, matching the existing `app/controllers/v1/publications.py` convention — metrics only make sense once publications exist.

## Jobs

`collect_metrics` collects metrics for one publication, one workspace, or all published publications. Default provider is `stub`.

## Frontend

Only `webui-react` is updated. The Publications page includes manual metrics entry and per-publication snapshots. The Workspaces page includes a small comparative summary table.

## Security

No real YouTube tokens are required, stored, logged, or shown. Manual and stub metrics work without external services.

## Not Included

- Real YouTube OAuth.
- Token storage.
- Complex dashboard/charting.
- Experiment decision automation.
