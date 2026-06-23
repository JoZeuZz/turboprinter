# 008 — Reddit ingest

> Fase 9 of the project-mode evolution (see `plans/spec/spec-001.md`). Standalone,
> opt-in, additive. Reddit is a **content source**, not a separate pipeline.

## Flow

```text
reddit url/thread (or manual payload)
   -> RedditIngestService.fetch / from_manual -> StorySource (anonymized)
   -> RedditThreadNormalizer.to_script_text -> text
   -> (user reviews) -> POST /api/v1/projects/from-script (Fase 6)
   -> plan -> media -> timeline -> render
```

## Modules

- `app/domain/sources/models.py` — `StorySource` (generic; `kind` = `reddit` |
  `manual`; carries title/body/comments, `author_anonymized`, `fetched_at`,
  `license_note`).
- `app/application/services/reddit_ingest.py`:
  - `RedditThreadNormalizer` — `anonymize()` replaces `u/...` / `/u/...`
    usernames with neutral labels; `to_script_text()` joins title + body +
    comments into a single script-ready text.
  - `RedditIngestService` — `from_manual()` (pasted text) and `fetch()` (lazy
    PRAW; an injectable `client` keeps tests offline). `get_reddit_ingest_service()`
    factory gated by the flag.

## PRAW (optional)

PRAW is imported lazily inside `_build_client()`. Without it installed, or
without `reddit_client_id`/`reddit_client_secret` in `config.app`, `fetch()`
raises a clear error; `from_manual()` still works. The rest of the system is
unaffected when the flag is off.

## Rules

- Use the official API (OAuth via PRAW); no aggressive scraping; respect rate
  limits.
- Anonymize usernames; never auto-publish to Reddit.
- The output is reviewable text persisted by the caller; the user reviews it
  before audio/video generation.
- Record source/`license_note`; review usage rights before publishing.

## Flag

`TURBOPRINTER_REDDIT_INGEST` (default `false`).

## Out of scope

- Auto-publishing to Reddit.
- Scraping without the API.
- Content moderation/classification.
- New TTS/render (reuses the existing pipeline).
