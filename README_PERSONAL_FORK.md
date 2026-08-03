# MoneyPrinterTurbo — Personal Fork (LXC / Proxmox)

This is a personal fork of [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo)
focused on **Spanish short‑form vertical video** (TikTok/Reels/Shorts), with
clip‑by‑clip timeline editing before the final render. It is designed to run on
a CPU‑only Debian/Ubuntu **LXC container on Proxmox**, with persistent storage.

The LLM provider is configurable via `LLM_PROVIDER` (`gemini`, `lmstudio` or
`openai`, the latter two for any OpenAI‑compatible endpoint) — **no
OpenAI/Anthropic API key is required at runtime**, and ChatGPT/Claude web are
never automated.

> This fork was rewritten from Python (FastAPI + Streamlit + MoviePy) to
> TypeScript (Express + React + Vite + FFmpeg CLI). Everything below describes
> the TypeScript stack.

---

## 1. Install on an LXC (Debian/Ubuntu)

> Use an **unprivileged** LXC. CPU‑only works; GPU is optional and not required.

```bash
# System dependencies
apt update && apt install -y git ffmpeg curl

# Node 20 (via nodesource or nvm — pick one and document it)
# <!-- TODO: verify the exact install command used on the target LXC -->

# Clone your fork
git clone https://github.com/JoZeuZz/turboprinter.git /opt/turboprinter
cd /opt/turboprinter

# Install the locked dependency tree
npm ci
```

`ffmpeg` and `ffprobe` must be on `PATH` — the render pipeline
(`src/server/render.ts`) shells out to them directly.

---

## 2. Configure `.env`

Create a `.env` file in the project root (it is git‑ignored — never commit it,
it holds your keys). **Never write a real key value in this document** — use
an empty value or an obvious placeholder like `<your-key>`.

| Variable | Purpose |
|---|---|
| `PEXELS_API_KEY` | Pexels stock search |
| `PEXELS_KEY` | alternate name read as a fallback for `PEXELS_API_KEY` (undocumented in `.env.example`) |
| `GEMINI_API_KEY` | Gemini LLM |
| `LLM_PROVIDER` | `gemini` \| `lmstudio` \| `openai` |
| `OPENAI_API_BASE` | OpenAI‑compatible endpoint (e.g. LM Studio) |
| `OPENAI_API_KEY` | key for the OpenAI‑compatible endpoint |
| `OPENAI_MODEL` | model name for the OpenAI‑compatible endpoint |
| `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` | YouTube OAuth |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` | TikTok OAuth |
| `RENDER_COMMAND_TIMEOUT_MS` | optional, milliseconds, default `1800000` (30 min) — per-command ceiling for ffmpeg/ffprobe during a render; raise it on slow hardware or for very long videos |

Example:

```bash
PEXELS_API_KEY=<your-key>
LLM_PROVIDER=gemini
GEMINI_API_KEY=<your-key>
```

`config.toml` is a Python‑era leftover. The server still parses a small
allow-listed subset of its keys for backwards compatibility (see section 7),
but it should **not** be used to configure new setups — use `.env`.

---

## 3. LLM providers

LLM support lives in `src/server/llm.ts` (91 lines). It supports **Gemini** and
any **OpenAI‑compatible endpoint**, including a local one such as LM Studio.
The runtime does **not** require an OpenAI or Anthropic API key — that is an
explicit project constraint — and ChatGPT/Claude web are never automated.

Select the provider with `LLM_PROVIDER` in `.env`:

- `LLM_PROVIDER=gemini` + `GEMINI_API_KEY`
- `LLM_PROVIDER=openai` (or `lmstudio`) + `OPENAI_API_BASE` + `OPENAI_API_KEY`
  + `OPENAI_MODEL` — points at any OpenAI‑compatible endpoint, local or
  hosted.

```bash
# .env — Gemini
LLM_PROVIDER=gemini
GEMINI_API_KEY=<your-key>
```

```bash
# .env — local OpenAI-compatible endpoint (e.g. LM Studio)
LLM_PROVIDER=lmstudio
OPENAI_API_BASE=http://127.0.0.1:1234/v1
OPENAI_API_KEY=<not-required-by-most-local-servers>
OPENAI_MODEL=<model-name-loaded-in-lm-studio>
```

There is no DeepSeek‑ or Groq‑specific code path in the TypeScript server.
Never commit `.env` or paste real API keys into the repository.

---

## 4. Persistent storage (Proxmox)

The app writes only under the project's `storage/`:

- `storage/projects_db.json` — the proyecto database
- `storage/renders/<tema>/<proyecto>/` — render output and cache
- `storage/local_videos/` — the local material library
- `storage/youtube-credentials.json`, `storage/tiktok-credentials.json` —
  OAuth refresh tokens

Keep `storage/` on a **persistent mount** so it survives container rebuilds.

Suggested Proxmox bind mounts (host → container):

```
/tank/mpt/storage   ->  /opt/turboprinter/storage
/tank/mpt/env       ->  /opt/turboprinter/.env   (single file)
```

`storage/`, `.env` and `.claude/` are git‑ignored, so they are never
committed.

---

## 5. Run

```bash
# Development (Vite middleware, hot reload) — port 3000
npm run dev

# Production build, then run
npm run build
npm start                # node dist/server.cjs — port 3000
```

There is **no CLI and no headless mode today**: everything goes through the
HTTP API or the web UI. If you want headless automation, the routes under
`/api/v1/projects/*` are the entry point.

---

## 6. Local material library

There is **no CLI** for the local material library. Videos go into
`storage/local_videos/`, either by:

- dropping files there directly, or
- uploading through the web UI, which calls
  `POST /api/v1/local-videos/upload`.

`GET /api/v1/local-videos` lists what is currently there. There is no
index/stats/list command — the old `library_cli` is gone.

> Only add media you own or that is licensed for your use.

---

## 7. Security hardening (personal deployment)

- **The bind address and port are hardcoded.** The server binds
  `0.0.0.0:3000` (`server.ts:392` sets `const PORT = 3000;`, `server.ts:2658`
  calls `app.listen(PORT, "0.0.0.0", ...)`). There is no configuration knob
  for either. A firewall or a reverse proxy is the only control today.
- **No CORS middleware exists.** The TypeScript server has no CORS layer and
  reads no environment variable to configure one — do not rely on one.
- **There is no authentication on any route.** Do not expose the port beyond
  localhost or a trusted LAN without a reverse proxy providing auth and TLS
  (see example below).
- **Secrets.** `.env` and `config.toml` are both git‑ignored; keep keys only
  there and `chmod 600` them. `storage/youtube-credentials.json` and
  `storage/tiktok-credentials.json` hold OAuth **refresh tokens** — treat
  them as credentials and never web‑serve the `storage/` root.
- **Config endpoints mask secrets.** `GET` and `PUT /api/v1/config` never
  return secret values — they return the sentinel `__SAVED__` for any
  populated secret. The client only `PUT`s fields the user actually edited,
  so an untouched secret is never sent back and the stored value survives.
  Implemented in `src/server/configMasking.ts`.
- **Only two `storage/` subdirectories are web‑served**: `storage/renders`
  and `storage/local_videos`. The `storage/` root mount was removed
  precisely because the OAuth credential JSONs live inside it
  (`server.ts:2609`, `server.ts:2614`).
- **File permissions.** `.env` and both credential JSONs are written with
  mode `0600` (`src/server/envFile.ts`, `youtubeChannels.ts`,
  `tiktokCredentials.ts`).
- **`config.toml` reaches the process only through an allow-list.**
  `config.toml` keys reach `process.env` only through
  `CONFIG_TOML_ENV_ALLOWLIST` in `server.ts`, not a blanket mirror that hands
  every key in the file to every FFmpeg child process. The allow-list
  includes `pexels_key`, an undocumented alias read as a fallback in
  `getPexelsApiKey()` — this alias is real but not documented in
  `.env.example`.
- **None of the above adds authentication.** The API is still unauthenticated
  by design. A reverse proxy or firewall remains the only access control.
- **No `chmod 777`.** Run as a non‑root user inside the LXC; keep `storage/`
  writable only by that user.
- **Request bodies cannot pick arbitrary filesystem paths or shell arguments
  any more.** `local_video_files` sent to
  `POST /api/v1/projects/:id/media/search` now accepts only bare filenames
  with a known video extension — anything else gets a `400`. `videoUrl` sent
  to `POST /api/v1/youtube/upload` and `POST /api/v1/tiktok/upload` must
  resolve inside `storage/renders`, or the request is rejected before the
  file is touched. `PUT /api/v1/projects/:id` ignores `project_id` and
  `created_at` from the body and validates `project_folder_name` against the
  shape the server itself generates. The containment rules live in
  `src/server/pathSafety.ts` and are unit-tested in
  `src/__tests__/server/pathSafety.test.ts`. Media filenames also reject
  shell metacharacters (`"`, `` ` ``, `$`, `\`) and control characters, since
  they are interpolated into a double-quoted ffprobe/ffmpeg shell word; the
  local video upload endpoint rejects such names outright rather than
  storing them.

### Example nginx reverse proxy (with basic auth + TLS)

```nginx
server {
    listen 443 ssl;
    server_name video.tu-dominio.org;

    ssl_certificate     /etc/letsencrypt/live/video.tu-dominio.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/video.tu-dominio.org/privkey.pem;

    client_max_body_size 300m;        # cap uploads at the proxy

    auth_basic           "Restricted";
    auth_basic_user_file /etc/nginx/.htpasswd;   # htpasswd -c ...

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

---

## 8. systemd service

`/etc/systemd/system/turboprinter.service`:

```ini
[Unit]
Description=TurboPrinter
After=network.target

[Service]
User=turboprinter
WorkingDirectory=/opt/turboprinter
EnvironmentFile=/opt/turboprinter/.env
ExecStart=/usr/bin/node /opt/turboprinter/dist/server.cjs
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

`npm run build` must have been run first — `npm start` (and this unit's
`ExecStart`) runs the bundle in `dist/`.

```bash
systemctl daemon-reload
systemctl enable --now turboprinter
```

---

## 9. Backups

Back up regularly:

- `.env` — your provider keys and configuration. **A backup of this file
  contains secrets.**
- `storage/projects_db.json` — the proyecto database.
- `storage/renders/` — render output and cache.
- `storage/local_videos/` — your local material library.
- `storage/youtube-credentials.json`, `storage/tiktok-credentials.json` —
  OAuth refresh tokens.

A simple snapshot of the persistent mount (section 4) covers all of the above.

---

## 10. Validation

```bash
npm run lint    # tsc --noEmit
npm test        # vitest run
npm run build   # verifies the production bundle still builds
```
