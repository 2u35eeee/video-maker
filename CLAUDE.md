# video-maker house rules

Videos here are programs. Each project page paints any moment on demand via `window.seek(t)`;
the engine walks time, screenshots each frame and pipes it to ffmpeg. Target: Douyin, 9:16, 1080×1920.

## Project contract

`projects/<NNN-name>/` contains:
- `index.html` + `scene.js` — canvas page. Must set `window.VIDEO = { duration }`, `window.seek(t)`, and `window.ready = true` once fonts/assets are loaded.
- `timeline.js` — BPM, section times and event times. Imported by both the scene and the audio, so cuts and sound can't drift.
- `audio.mjs` (optional) — `node audio.mjs out.wav`, built with `engine/lib/synth.mjs`.

## Narrated videos (科普)

- `script.json` holds the lines: `say` (spoken, write numbers in Chinese so TTS reads them right) and `sub` (on-screen, 【】 = highlighted keyword).
- `uv run engine/tts.py projects/<name> [--voice eric] [--tempo 1.1]` → `out/<name>/vo.wav` + `projects/<name>/vo.js` (line timings; commit it). Lines are cached, so editing one line only regenerates that line.
- `uv run engine/vo_check.py projects/<name>` transcribes each line with Whisper to catch misreadings. Dialect voices (eric, dylan) score low by nature; listen instead.
- Scenes key every shot to `cue('<line id>').start`, never to hard-coded seconds, so re-voicing keeps picture in sync.
- TTS: Qwen3-TTS 1.7B CustomVoice (local, MLX). Voices the user likes: serena, dylan (京腔), eric (四川话). Speed: put "语速偏快" in `instruct` plus `tempo` 1.1–1.2.

## Commands

```bash
node engine/stills.mjs projects/<name> --every 0.5      # stills + out/<name>/contact.png
node engine/stills.mjs projects/<name> --at 3.2,6.1     # specific moments
node engine/render.mjs projects/<name> [--fps 60] [--from 4 --to 8] [--no-audio]
```

## Tooling

- **Python: uv only.** `uv add <pkg>` to add deps, `uv run <script>` to run. Never `pip install` or use the system `python3` (it's 3.9). Python is pinned to 3.12 in `.python-version`; `pyproject.toml` + `uv.lock` are committed.
- **Node: npm** for the render engine (Playwright). `npm install` after clone.

## Rules

- **Deterministic.** No `Date.now()`, `requestAnimationFrame`, `Math.random()` or CSS animations. Everything is a function of `t`; use `rand(seed)` from `engine/lib/motion.js`.
- **Springs, not easing curves**, from `engine/lib/motion.js`. Tiny overshoot on UI (`snappy`), none on big type (`heavy`). Any value with more than one target uses `track()`; never restart a spring.
- **Cut on the beat.** Section boundaries and hits come from `timeline.js`.
- **Douyin safe area.** Keep text and key subjects inside x 90–900, y 220–1560. The right edge (like/comment/share) and the bottom ~360 px (caption, music bar) are covered by app UI.
- **Hook in the first 2 seconds.** The first frame must already say something.
- **Critique loop before every full render.** Render stills, look at them, list the 3 worst problems, fix, repeat. Render the MP4 only once the stills hold up.
- **Never commit renders or keys.** `out/` and `.env` are git-ignored; API keys live in `.env` only.
