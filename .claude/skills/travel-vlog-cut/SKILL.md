---
name: travel-vlog-cut
description: 把几十分钟到几小时的旅行素材（空镜、风景、日常，非口播）自动剪成有故事感、跟着 BGM 起伏走的 vlog，并直接写进 CapCut 国际版（桌面版）草稿。流程是 ffmpeg 抽帧 → Claude/子代理看图做全量标注 → 按歌曲段落自动排片 → 写入转场、动画、运镜关键帧、音量曲线和字幕。当用户想"把旅行素材剪成 vlog""用 CapCut 自动剪片""按音乐卡点排镜头""做精简版/长版旅行视频"时使用。Use for: auto-editing travel footage into a CapCut draft, beat/section-synced cuts, cinematic travel vlog.
---

# 旅行 vlog 自动剪辑（CapCut 草稿）

## 能做什么、不能做什么
- 能做：从全部素材里挑镜头、排故事线、按 BGM 段落定剪辑点，写进 CapCut 草稿（片段、变速、推拉摇运镜、转场、淡入淡出、模糊背景、旋转、BGM 音量曲线、字幕及字幕动画）。人最后只需打开草稿微调、调色、导出。
- 不能做：**剪映 6.0+ 的草稿是加密的，读写不了**（不做破解）。必须用 **CapCut 国际版**，已验证 9.5.0（草稿 schema 360000）。10.x 以上有写入被判"已损坏"的报告，先用测试草稿验证。
- 调色（滤镜/LUT）写不进去，交给用户在 CapCut 里加一个调整图层。

## 环境（Windows 原生）
1. `winget install OpenJS.NodeJS.LTS Gyan.FFmpeg OliverBetz.ExifTool`。在 Git Bash 里 PATH 不会自动生效，照 `scripts/env.sh.example` 写一个 `env.sh`，每条命令先 `. ./env.sh`。**注意 `$LOCALAPPDATA` 是 `C:\...` 形式，不能直接拼进 PATH，要写成 `/c/Users/...`。**
2. 建工作目录（例如 `D:\vlog-work`，路径不要有中文和空格），把本 skill 的 `scripts/` 复制进去（成为 `<work>/scripts`），再 clone 两个仓库到 `<work>/` 下：
   - `git clone https://github.com/JmsLdrn/capcut-mcp`：只用它的 `src/core.js`（无依赖、不联网），不用注册 MCP。
   - `git clone https://github.com/renezander030/capcut-cli`：只读 `src/enums.json`（转场、动画的素材 ID）和 `docs/draft-schema/`，不用 npm install。
   - 运行第三方代码前先读一遍。
3. **一定要设置 `CAPCUT_DRAFTS_DIR`**：capcut-mcp 里写死了 `D:/Capcut/CapCut Drafts`，如果这个文件夹恰好存在，会被优先选中。
4. 素材只读，中间文件都放在 `<work>/out/`。DJI 相机的 `.LRF` 是低清代理文件，抽帧、分析都用它，速度快很多。

## 流程
| 步 | 命令 | 产物 |
|---|---|---|
| 1 元数据 | `node scripts/manifest.mjs <素材目录>`（全部）/ `... <素材目录> 20260924`（单日） | `out/manifest.json` / `manifest_<日>.json` |
| 2 粗筛（不用 AI） | `node scripts/prescreen.mjs out/manifest_<日>.json` | `segments_<日>.json`：镜头切换、过暗、模糊、晃动的标记，只标不删 |
| 3 全量抽帧 | `node scripts/index_sheets.mjs 4` | `out/index_sheets/*.jpg`：每 4 秒一帧、6×5 拼图、带时间戳，外加 `sheets.json` |
| 4 全量标注 | 按天或按张数分给 3～4 个子代理并行（提示词模板见下） | `out/index/index_*.json`，合并成 `out/index/all.json` |
| 5 BGM 分析 | `node scripts/beats.mjs <mp3> bgm_<歌>.json` | onsets、每 0.1 秒的 rms、能量曲线、段落 |
| 6 排片 | 写剧本 spec（见 `examples/long_spec.example.json`）→ `node scripts/build_long.mjs spec.json out/edit_plan_x.json` | 编辑计划 JSON |
| 7 试跑、检查 | `node scripts/to_capcut2.mjs out/edit_plan_x.json <草稿名> --dry` → `node scripts/preview_sheet.mjs out/edit_plan_x.md out/manifest.json out/tmp/check.jpg 30` | 可读计划 `.md`、每个镜头的首/中/尾抽帧图 |
| 8 写入 | 用户**完全退出 CapCut**（包括托盘）后，去掉 `--dry` 再跑一次 | 草稿（写入前自动备份到 `<work>/backup/`） |

BGM 的歌曲文件：让用户在草稿里从曲库拖一首歌进去，读 `materials.audios[].path`，路径在 `CapCut/User Data/Cache/music/*.mp3`。

### 模板草稿（每个新草稿都要）
让用户在 CapCut 里新建草稿，名字用英文和数字，然后：
- 放 **1 段视频**；
- 放 **1 个"默认文本"**（不能用"文字模板/花字模板"，那是 `text_template`，做不了模板）。注意**文字不透明度**，脚本会强制改成 100%；
- 放用到的**每首歌**（曲库的歌类型是 `music`，脚本会复制它的原始素材数据，保证和曲库关联上）；
- 然后完全退出 CapCut。画布比例写在 spec 的 `canvas` 里。

## 草稿写入的要点（踩过的坑）
- CapCut 9.x 真正读取的时间线在 **`Timelines/<content.id>/draft_content.json`**，打开时会拿它覆盖顶层文件。所以必须同时写：顶层的 `draft_content.json` 和 `template-2.tmp`，`Timelines/<id>/` 下的 `draft_content.json` 和 `template-2.tmp`，以及两处的 `.bak`。`to_capcut2.mjs` 已经处理。
- 模板是从草稿里现有的片段"收割"来的。重复运行时，要剥掉上次写入的动画、转场、关键帧、变速和模糊背景，否则会被复制到每个镜头上（脚本已处理）。
- 素材的 `duration` 必须是文件的真实长度，不能沿用模板片段的长度。变速时 `source_timerange.duration = 时长 × 速度`。草稿的总 `duration` 要重新计算。
- 转场和动画要用 **CapCut 自己写出的结构**：数字 ID，`effect_id`、`resource_id`、`third_resource_id` 三者一致，`source_platform: 1`，`path` 指向缓存。做法是让用户手动加一次想用的转场和动画，读出来存成 `out/fx_library.json`，脚本会优先使用。capcut-cli 表里的旧式 UUID 转场（Dissolve、Black Fade 等）实测也能被 9.5 识别。
- 关键帧：`UNIFORM_SCALE`（没有 KFType 前缀）、`KFTypePositionX`、`KFTypeVolume` 都能渲染。**alpha 关键帧对视频不生效**，淡入淡出要用 `Fade In/Fade Out` 动画。
- 竖拍素材：用 `canvas_blur` 模糊背景。相机侧着拍的：`rotation: 90`（顺时针）、`scale: 0.75`，再加模糊背景。
- 字幕：CapCut 按文本框中心定位，`+y` 朝上，草稿里不记录渲染后的尺寸。左上角的位置是估算的（`glyph ≈ 0.006 × 字号 × 画布高`），长字幕一定要让用户确认没出画面。

## 剪辑手法（用户认可的风格：温馨高级、慢节奏）
- **跟着歌的起伏剪**：用 rms 找音乐起来和回落的位置作为锚点，精确到 0.1 秒。每段之间的剪辑点吸附到 ±0.3 秒内最强的起音点。歌的拍子不均匀时（BPM 测出来差 3 倍），不要硬套节拍网格。
- 故事结构：冷开场 → 音乐起来的那一刻给画面最大的变化（比如出隧道由暗转亮）→ 各章节 → 回落处放安静的画面（发呆、溪水）→ 尾奏放背影走远并淡出。
- 平均每个镜头 4.4～4.6 秒。推近幅度 4%，平移 ±3%（缩放 1.06）。高速车内的镜头 1.5 倍速，固定机位拍云可以 6 倍速做延时。
- 转场要柔和：段落之间用叠化，章节之间用黑场，少用闪白和拉幕。同一文件的连续素材被前后接在一起时，自动加 0.8 秒叠化。
- 音量：BGM 开头 2 秒淡入、结尾 6～7 秒淡出。出现笑声、溪水、参拜声时，BGM 压到 60%～65%，前后各用 2 秒过渡。片段原声渐入渐出 0.8 秒。**不要有突然的音量变化**。
- 字幕：只写"在做什么"的口语化短句（如「坐缆车，往云里去」），**不写地名、店名**。放左上角，字号 7（DAY n 用 9），打字机或淡入淡出 0.8 秒。字幕用 `match` 关键词挂到对应的镜头上，不要挂在歌曲的时间点上，否则会和画面对不上。
- 排片器的规则：同一文件最多 5 个镜头（5 分的时刻不限）；同一段素材不重复使用；排除带地名或文字的画面、口袋误拍、倒置、人脸近景（4 分以下）以及不足 4 秒的文件。用 `excludeMoments` 手动剔除检查时发现的问题镜头。

## 标注子代理的提示词要点
- 让它们用 Read 看**每一张**拼图，瓦片从左到右、从上到下读，时间戳就是源文件里的秒数。
- 每个文件从 0 到结尾切成**连续**的时刻，中间不留空档，边界落在 4 秒网格上。完成后用 node 自检覆盖是否完整。
- 每个时刻的字段：`desc`（具体的中文描述），`people`、`actions` 从受控词表里选（开车、坐车、走路、吃东西、喝东西、拍照、自拍、挥手、参拜、说笑、发呆、看风景、坐缆车、购物、接水、充电、撑伞、其他），以及 `scene`、`light`、`camera`（含"口袋/误拍"）、`orientation`（横/竖/侧转90度/倒置）、`quality`、`score`（1～5）、`issues`（手挡镜头、带地名文字、人脸近景等）。
- 强调要按字面打动作标签：远景里的参拜也要标"参拜"。旋转过的画面也要描述内容，并标明方向。已知的难点可以直接写进提示词作为例子。

## 验证（每次写入前后）
- 试跑的输出里会列出：超出所属时刻 1 秒以上的镜头、复用素材的镜头。
- 文字核对：每条字幕出现的时刻，画面对应的 `desc` 是什么；字幕之间的间隔 ≥ 0.3 秒；同一文件的镜头之间素材重叠为 0。
- 抽帧检查：第一次全量看；之后只看有变化的镜头，省 token。
- 写入后读回草稿确认：总时长、各轨道数量、BGM 首尾音量为 0，以及两处时间线镜像内容一致。然后请用户打开 CapCut 目视确认。**转场、动画是否真的渲染，只有打开 CapCut 才能确认。**

## 发布前提醒用户
同伴的面部画面要先征得本人同意。曲库音乐的授权以 CapCut 的规则为准。
