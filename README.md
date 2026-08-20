# 明日方舟 · 基建模拟器（ak.aln）

纯前端基建排布工具：拖拽进驻、效率对照、满配峰值提示、单设施存班换班、常见策略一键布置。

**作者：** [uimnoo](https://github.com/uimnoo)（B 站同名）  
**在线演示：** https://uimnoo.github.io/ak.aln/  
**仓库：** https://github.com/uimnoo/ak.aln

> 非官方工具。基建技能数据参考 **PRTS**，并经作者本人账号实测核对。  
> **现状：** 干员库暂按作者全精二池；人间烟火相关计算仍在打磨。  
> **计划：** MAA 识别 JSON 导入号池筛选 → 人间烟火校准 → 按号池自动排班。

---

## 能做什么

- **拖拽排布**：制造 / 贸易 / 发电 / 中枢 / 会客 / 办公室 / 宿舍 / 训练
- **满配峰值排序**：干员库按顶配估算，并标注条件（如「需铃兰」「靠宿舍等级」）
- **存班换班**：每个设施独立 A/B/C；设施为空时可拉回已存班
- **策略一键**：彩虹永动→双月、但书违约、自动化清流等
- **本地存档**：浏览器本地保存布局与班次，无需登录

---

## 快速开始

### 方式一：在线用（推荐）

打开演示站即可：  
https://uimnoo.github.io/ak.aln/

### 方式二：本地打开

```bash
git clone https://github.com/uimnoo/ak.aln.git
cd ak.aln
```

用浏览器直接打开 `index.html`（或起一个静态服务）：

```bash
# 任选其一
npx --yes serve .
python -m http.server 8080
```

---

## 演示站说明（GitHub Pages）

本仓库通过 **GitHub Pages** 发布静态页，推送 `main` 后约 1～2 分钟可访问：

| 项目 | 内容 |
|------|------|
| 地址 | https://uimnoo.github.io/ak.aln/ |
| 来源 | `main` 分支根目录（`index.html`） |
| 工作流 | `.github/workflows/pages.yml` |

若打不开：到仓库 **Settings → Pages**，确认 Source 为 **GitHub Actions**，并查看 Actions 是否跑通。

---

## 技术栈

- 纯静态：`index.html` + `app.js` + `engine.js` + `data.js` + `style.css` + `author-preset.js`
- 干员头像走公开 CDN 镜像，无后端

---

## 免责声明

本项目与鹰角网络无关，仅供博士学习交流与个人排布参考。请勿用于商业用途。
