# personal-website

个人知识站点（纯静态，只读）。Obsidian 笔记库渲染 + 自制 HTML 工具页，部署在 GitHub Pages：
**https://xxinjie21.github.io/personal-website/**

## 目录结构

```
personal-website/
├── src/
│   ├── layouts/      # 全局布局：顶部导航、倒计时、只读徽标
│   ├── views/        # 主页 / 笔记页 / 自定义页面
│   ├── components/   # 阅读器、文件树、图标、首页 3D 雕塑
│   ├── router/       # history 路由（无 # 的干净路径）
│   ├── lib/store.js  # 只读空进度（不存任何数据）
│   ├── lib/graph.js  # 双链解析、笔记索引
│   ├── style/        # 暖白亮色主题 CSS 变量
│   └── data/         # parse 脚本生成的 site-manifest.json
├── custom-pages/     # 自制 HTML 页面，丢进来即自动识别
├── notes/            # Gitee 笔记库（git 子模块：xxj0817/obsidian-notes）
├── build-script/     # 解析 md / frontmatter / 双链 / 标签 / 页面清单
└── public/           # favicon、笔记图片、自定义页构建副本
```

> `notes/` 为子模块：更新笔记后在 `notes/` 内 `git pull`，再回到项目根目录 `npm run parse` 重新生成清单。

## 命令

```bash
npm install
npm run parse     # 扫描 notes/ 与 custom-pages/，生成 src/data/site-manifest.json
npm run dev       # 本地开发 http://localhost:5173
npm run build     # 产出 dist/（静态托管）
npm run preview   # 预览构建产物
```

## 部署

`.github/workflows/build.yml`：

- 触发：push master / 手动 Run workflow / `repository_dispatch`（`gitee-notes-updated`）/ 每 5 分钟轮询
- 流程：checkout（含子模块）→ `git submodule update --remote notes` → `npm ci` → `npm run build` → 复制 `dist/index.html` 为 `dist/404.html`（history 路由回退）→ `actions/deploy-pages`
- Pages 子路径部署时 `VITE_BASE=/personal-website/` 控制资源前缀；本地 dev 默认 `/`

详见 `部署与同步说明.md`。

## 说明

- 站点纯只读：不写入 localStorage、不请求后端、不保存学习状态
- 深链（`/notes?note=...`）走 Pages 的 404 回退，页面正常渲染但 HTTP 状态为 404，属 GitHub Pages 固有行为
