# video-maker

用 Claude Code + Opus 5.5 以代码生成短视频（主要面向抖音 9:16 竖屏）。

## 思路

模型不直接产出视频，而是写一个确定性的 `seek(t)` 程序：
Playwright 逐帧截图 → ffmpeg 合成 MP4。改一行代码即可重新渲染。

## 快速开始

```bash
npm install      # 渲染引擎（Node / Playwright）
uv sync          # Python 工具（TTS 等），统一用 uv 管理
node engine/stills.mjs projects/001-showreel --every 0.5   # 出静帧 + 联系表，先审片
node engine/render.mjs projects/001-showreel               # 出 MP4（含合成配乐）→ out/
```

## 目录

| 目录 | 用途 |
|---|---|
| `engine/` | 渲染引擎：seek(t) 渲染器、弹簧动画、合成音频、自审循环 |
| `projects/` | 每个视频一个子目录（brief + 源码） |
| `refs/` | 参考帧 / 风格素材 |
| `skills/` | 封装好的 Claude Code skills（如 `/motion-reel`） |
| `out/` | 渲染输出（不入库） |

## 作品

| 项目 | 内容 |
|---|---|
| `001-showreel` | 16 秒竖屏 showreel，120 BPM，8 个镜头全部代码绘制 + 代码合成配乐 |

## 参考

- [How to build motion design studio with Opus 5.5](https://x.com/0xMovez/status/2104216919033192746)
- [Anatomy skill](https://skills.wheresryan.sh/anatomy) — 一句话生成可交互的等轴测“机器”解释图
- Starter: https://github.com/JohnHeibel/ClaudeAnimationBase
- Node canvas skill: https://github.com/buildwithhanif/claude-animation-skill
- HyperFrames: https://github.com/heygen-com/hyperframes
- Remotion AI skills: https://www.remotion.dev/docs/ai/skills
- 案例集: https://github.com/athemeroy/awesome-opus-5-5-videos
