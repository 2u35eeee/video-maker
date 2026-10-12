# video-maker

用 Claude Code + Opus 5.5 以代码生成短视频（主要面向抖音 9:16 竖屏）。

## 思路

模型不直接产出视频，而是写一个确定性的 `seek(t)` 程序：
Playwright 逐帧截图 → ffmpeg 合成 MP4。改一行代码即可重新渲染。

## 目录

| 目录 | 用途 |
|---|---|
| `engine/` | 渲染引擎：seek(t) 渲染器、弹簧动画、合成音频、自审循环 |
| `projects/` | 每个视频一个子目录（brief + 源码） |
| `refs/` | 参考帧 / 风格素材 |
| `skills/` | 封装好的 Claude Code skills（如 `/motion-reel`） |
| `out/` | 渲染输出（不入库） |

## 参考

- [How to build motion design studio with Opus 5.5](https://x.com/0xMovez/status/2104216919033192746)
- [Anatomy skill](https://skills.wheresryan.sh/anatomy) — 一句话生成可交互的等轴测“机器”解释图
- Starter: https://github.com/JohnHeibel/ClaudeAnimationBase
- Node canvas skill: https://github.com/buildwithhanif/claude-animation-skill
- HyperFrames: https://github.com/heygen-com/hyperframes
- Remotion AI skills: https://www.remotion.dev/docs/ai/skills
- 案例集: https://github.com/athemeroy/awesome-opus-5-5-videos
