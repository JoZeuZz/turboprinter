# MoneyPrinterTurbo — Personal Fork (LXC / Proxmox)

This is a personal fork of [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo)
focused on **Spanish short‑form vertical video** (TikTok/Reels/Shorts), with
clip‑by‑clip timeline editing before the final render. It is designed to run on
a CPU‑only Debian/Ubuntu **LXC container on Proxmox**, with persistent storage.

The LLM provider is configurable via `LLM_PROVIDER` (`gemini`, `lmstudio` or
`openai`, the latter two for any OpenAI‑compatible endpoint) — **no
OpenAI/Anthropic API key is required at runtime**, and ChatGPT/Claude web are
never automated.

---

## 2. Install on an LXC (Debian/Ubuntu)

> Use an **unprivileged** LXC. CPU‑only works; GPU is optional and not required.

```bash
# System dependencies
apt update
apt install -y git ffmpeg python3 python3-venv build-essential curl imagemagick

# uv (dependency/runtime manager; project uses pyproject.toml + uv.lock)
curl -LsSf https://astral.sh/uv/install.sh | sh
#   ^ then restart your shell, or: source $HOME/.local/bin/env
```

Python must be **>=3.11,<3.13** (3.12 recommended). `uv` will fetch a matching
interpreter automatically if your system Python is outside that range.

```bash
# Clone your fork (origin = your fork, upstream = original)
git clone https://github.com/JoZeuZz/turboprinter.git
cd turboprinter
git remote add upstream https://github.com/harry0703/MoneyPrinterTurbo.git   # if missing

# Install the locked environment
uv sync --frozen        # or: uv sync   (to re-resolve)
```

---

## 3. Configure `config.toml`

```bash
cp config.example.toml config.toml
```

`config.toml` is **git‑ignored** (never commit it — it holds your keys). Key
points for a personal, keyless‑at‑runtime setup:

- **LLM provider (script/keywords):** prefer local/self‑hosted. Examples:
  - **Ollama:** `llm_provider = "ollama"`, set `ollama_model_name`. The fork
    auto‑detects the host from inside containers.
  - **Pollinations:** `llm_provider = "pollinations"` (free, optional key).
  - **OpenAI‑compatible gateway** (LM Studio, OpenRouter, etc.): set
    `llm_provider = "openai"` + `openai_base_url` + `openai_model_name`.
  - **Manual:** leave the script field and paste your own script in the
    WebUI/CLI (`--video-script`) — no provider needed.
- **Subtitles:** `subtitle_provider = "edge"` (online) or `"whisper"` (local,
  CPU). Whisper runs on CPU by default (`[whisper] device = "CPU"`,
  `compute_type = "int8"`).
- **Stock material:** add `pexels_api_keys` / `pixabay_api_keys` /
  `coverr_api_keys` only if you want online sources; otherwise rely on the
  **local library** (section 6).
- **Quality stack:** set `[quality] enabled = true` and pick a `profile`,
  `target_platform`, `subtitle_style`, etc.

---

## 3b. LLM providers: DeepSeek (primary) & Gemini (fallback)

This fork optimizes two cloud LLM providers for Spanish content while keeping
Ollama, LiteLLM and all upstream providers intact. No OpenAI/Anthropic API key
is required at runtime, and ChatGPT/Claude web are never automated.

### Recommended `config.toml` (no real keys committed)

```toml
[app]
# Set DeepSeek as the main provider for this personal fork.
llm_provider = "deepseek"

# ----- DeepSeek (primary, low cost) -----
deepseek_api_key = ""                 # paste locally, never commit
deepseek_base_url = "https://api.deepseek.com"
deepseek_model_name = "deepseek-v4-flash"
deepseek_thinking_enabled = false     # keep voiceover clean, avoid reasoning cost
deepseek_reasoning_effort = "high"    # only used when thinking is enabled

# ----- Gemini (fallback / quality comparison) -----
gemini_api_key = ""
gemini_model_name = "gemini-2.5-flash"
gemini_base_url = ""                  # optional custom endpoint

# ----- Optional fallback chain + timeouts -----
llm_fallback_providers = ["gemini"]   # [] disables fallback (default)
llm_request_timeout_seconds = 120
llm_connect_timeout_seconds = 30
```

Notes:

- `deepseek_model_name` defaults to `deepseek-v4-flash` if left empty.
  `deepseek-chat` / `deepseek-reasoner` still work (V3.2 non‑thinking / thinking
  modes) but trigger a warning recommending you verify model availability in the
  [official docs](https://api-docs.deepseek.com).
- With `deepseek_thinking_enabled = false`, the client sends
  `extra_body={"thinking": {"type": "disabled"}}`. Set it to `true` to enable
  step‑by‑step reasoning plus `deepseek_reasoning_effort`. If a model/gateway
  rejects those params, the error message tells you to disable thinking or fix
  the model name.
- `<think>…</think>` blocks are always stripped before scripts, keywords,
  subtitles or TTS, regardless of provider.

### Fallback behaviour

- Empty `llm_fallback_providers` → identical to upstream (single provider).
- When set, the primary `llm_provider` is tried first, then each fallback in
  order. A misconfigured or failing provider is skipped (with a log line, never
  the API key) and the next one is tried. The primary and duplicates are
  de‑duplicated, so there is no infinite loop.

### Recommended workflow

1. **Script:** generate with DeepSeek, *or* paste a manual script from
   ChatGPT/Claude into the WebUI script field / CLI `--video-script`.
2. **Keywords & metadata:** generate with DeepSeek (cheap, clean output).
3. **Fallback:** enable Gemini in `llm_fallback_providers` (or the WebUI
   *AI Provider (avanzado)* expander) to compare quality when DeepSeek output
   isn't convincing.
4. **Render:** run the pipeline as usual.

Per‑run overrides without editing `config.toml`:

```bash
uv run python cli.py --video-subject "..." --llm-provider gemini --llm-model gemini-2.5-flash
```

### Costs & security

- DeepSeek is usually the economical option, but **verify current pricing in the
  official docs before intensive use** — model names and prices change.
- Never commit `config.toml` or paste real API keys into the repository. The
  WebUI masks keys and the service layer redacts credentials from error messages
  and logs.
- Do not expose the WebUI publicly without authentication / a reverse proxy
  (see section 7).

### LLM Provider Registry (Plan 011a)

`app/services/quality/llm_providers/` defines `OpenAICompatProvider`, `GeminiProvider`, and a `get_provider()` dispatcher. Currently, `_generate_response_single` in `llm.py` keeps known providers inline (openai, groq, deepseek, etc.) to preserve `test_llm.py` test patches on `llm.OpenAI`. The registry routes only unknown/custom provider names.

To complete the migration: update `test_llm.py` to patch `openai_compat.OpenAI` instead of `llm.OpenAI`, then remove the `_inline` set from `_generate_response_single`.

---

## 4. Persistent storage (Proxmox)

The app writes only under the project's `storage/` (tasks, cache, local videos,
local library) and downloads Whisper models under `models/`. Keep these on a
**persistent mount** so they survive container rebuilds.

Suggested Proxmox bind mounts (host → container):

```
/tank/mpt/storage   ->  /opt/turboprinter/storage
/tank/mpt/models    ->  /opt/turboprinter/models
/tank/mpt/config    ->  /opt/turboprinter/config.toml   (single file)
```

`storage/`, `models/`, `config.toml` and `.claude/` are git‑ignored, so they are
never committed.

---

## 5. Run (WebUI / API / CLI)

```bash
# WebUI (Streamlit)
uv run streamlit run ./webui/Main.py --server.address 127.0.0.1 --server.port 8501

# API (FastAPI/uvicorn)
uv run python main.py            # binds to [listen_host]:[listen_port] from config

# CLI (headless, ideal for LXC/cron)
uv run python cli.py --video-subject "Tu tema" --quality-enabled \
    --quality-profile high --quality-target-platform shorts \
    --quality-subtitle-style premium --quality-content-package
uv run python cli.py --help      # see the flag group
```

---

## 6. Local material library

Index your own (licensed/owned) clips so the pipeline prefers them over stock:

```bash
uv run python -m app.services.quality.library_cli index /ruta/a/tus/videos \
    --source user --license CC0 --tags naturaleza,ciudad
uv run python -m app.services.quality.library_cli stats
uv run python -m app.services.quality.library_cli list
```

The index lives in `storage/local_library/library.db`. With
`[quality] enabled = true` and `prefer_local_assets = true`, indexed clips are
ranked and used **before** downloading stock. Indexing **never moves or deletes**
your media; `remove` only deletes the database row.

> Only index media you own or that is licensed for your use. Do not download
> from platforms outside the supported stock APIs.

---

## 7. Security hardening (personal deployment)

This fork keeps upstream behaviour but documents and provides safer knobs.

- **Do not bind to `0.0.0.0` unless you need LAN access.** The API default is
  `listen_host = "0.0.0.0"`. For a single host, set `listen_host = "127.0.0.1"`
  and reach the service via SSH tunnel or a reverse proxy. For Streamlit, use
  `--server.address 127.0.0.1`.
- **Reverse proxy + auth if exposed.** If you expose the WebUI/API beyond
  localhost, put it behind nginx/Caddy with **HTTP auth or an identity proxy**
  and TLS (see example below). Never expose it unauthenticated to the internet.
- **CORS.** The API defaults to `allow_origins = ["*"]`. Restrict it by setting
  the `CORS_ALLOWED_ORIGINS` environment variable (comma‑separated) to your real
  origin(s), e.g. `CORS_ALLOWED_ORIGINS="https://video.tu-dominio.org"`.
  With an empty allow-list the API falls back to wildcard origins **without**
  `allow_credentials`; to enable credentials you must supply an explicit
  origin allow-list via `CORS_ALLOWED_ORIGINS`.
- **Secrets.** `config.toml` is git‑ignored; keep your keys only there. The fork
  redacts the Pixabay key from logs and never logs full credentials.
- **TLS verification** for stock/LLM requests stays **on** by default
  (`tls_verify = true`). Only disable for trusted proxy/self‑signed setups.
- **Explicit timeouts** are set on external requests (LLM, TTS, stock,
  cross‑post) so a hung provider cannot stall a task indefinitely.
- **Upload limits.** Set `max_upload_size_mb` in `config.toml` (0 = unlimited)
  and/or enforce `client_max_body_size` at the reverse proxy.
- **Task `_meta/` is listing-private, not access-controlled.** Private task
  artifacts (`script.json`, `params`, `manifest.json`, `word_timestamps.json`,
  `subtitle.srt`) live under `storage/tasks/<id>/_meta/` so they no longer appear
  in the `/tasks/<id>/` directory listing. However, the `/tasks` static mount
  still serves the whole task tree, so `/tasks/<id>/_meta/<file>` remains
  fetchable by anyone who can reach the mount (the WebUI sidecar links point
  there by design). These files may contain your pasted script and effective
  render config — do **not** expose the API/WebUI publicly without the reverse
  proxy + auth boundary described below.
- **Redis** (optional, `enable_redis`) is for task state only — keep it private,
  bound to localhost, with a password; do not expose it.
- **No `chmod 777`.** Run as a non‑root user inside the LXC; keep `storage/`
  writable only by that user.

### Example nginx reverse proxy (WebUI, with basic auth + TLS)

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
        proxy_pass         http://127.0.0.1:8501;   # Streamlit
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   Upgrade $http_upgrade;    # Streamlit websockets
        proxy_set_header   Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

---

## 8. systemd services

`/etc/systemd/system/turboprinter-api.service`:

```ini
[Unit]
Description=Turboprinter API
After=network.target

[Service]
User=turboprinter
WorkingDirectory=/opt/turboprinter
ExecStart=/root/.local/bin/uv run python main.py
Restart=on-failure
Environment=CORS_ALLOWED_ORIGINS=https://video.tu-dominio.org

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/turboprinter-webui.service`:

```ini
[Unit]
Description=Turboprinter WebUI
After=network.target

[Service]
User=turboprinter
WorkingDirectory=/opt/turboprinter
ExecStart=/root/.local/bin/uv run streamlit run ./webui/Main.py --server.address 127.0.0.1 --server.port 8501
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now turboprinter-api turboprinter-webui
```

---

## 9. Backups

Back up regularly:

- `config.toml` — your providers, keys and quality settings.
- `storage/local_library/library.db` — the local material index.
- Your local media folder(s) — the actual clips you index.
- `storage/tasks/` — generated outputs you want to keep (large; prune as needed).

A simple snapshot of the persistent mount (section 4) covers all of the above.

---

## 11. Validation

In the LXC, after install or a rebase:

```bash
uv lock --check
uv run python -m compileall app webui
uv run pytest                          # full suite
uv run python cli.py --help            # confirms the flag group
docker compose config                  # only if you use the compose files
```

For a quick end‑to‑end check, run a short render and inspect the output plus
`storage/tasks/<id>/content_package.{json,md}`, `word_timestamps.json` and
`manifest.json` (effective render settings for the task).
