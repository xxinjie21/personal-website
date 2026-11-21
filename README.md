# personal-website

个人知识可视化站点（纯静态）。Obsidian 笔记库只读渲染 + 自制 HTML 工具页；进度经 Cloudflare Worker 中转私有 Gist 同步。

## 目录结构

```
personal-website/
├── src/
│   ├── layouts/      # 全局布局：顶部导航、倒计时、同步状态
│   ├── views/        # 主页 / 笔记页 / 自定义页面
│   ├── components/   # GraphCanvas 图谱画布
│   ├── router/       # hash 路由
│   ├── lib/store.js  # localStorage + Worker 同步层（预留）
│   ├── lib/graph.js  # 图谱模型：双链解析、邻居、状态统计
│   ├── style/        # Obsidian 主题 CSS 变量
│   └── data/         # parse 脚本生成的 site-manifest.json
├── custom-pages/     # 自制 HTML 页面，丢进来即自动识别
├── notes/            # Gitee 笔记库（git 子模块：xxj0817/obsidian-notes）
├── build-script/     # 解析 md / frontmatter / 双链 / 标签 / 页面清单
└── public/           # favicon 等静态资源
```

> `notes/` 为子模块：更新笔记后在 `notes/` 内 `git pull`，再回到项目根目录 `npm run parse` 重新生成清单。

## 命令

```bash
npm install
npm run parse     # 扫描 notes/ 与 custom-pages/，生成 src/data/site-manifest.json
npm run dev       # 本地开发
npm run build     # 产出 dist/（静态托管）
npm run preview   # 预览构建产物
```

## 同步配置（.env.development / .env.production）

- `VITE_WORKER_URL`：Cloudflare Worker 地址
- `VITE_AUTH_KEY`：前端与 Worker 共享的 Bearer 密钥

同步逻辑见 `src/lib/store.js`：启动 GET 远端合并本地；改动防抖 PUT 推回；Worker 不可用时回退纯 localStorage。

## 进度数据结构

```json
{
  "noteStatus": { "<noteId>": "not-started | learning | mastered" },
  "wordProgress": { "count": 0, "round": 0, "lastDate": "" },
  "updatedAt": ""
}
```

## 待办（按方案阶段）

- 阶段 2（骨架已通）：171 篇笔记已入图谱，环形/力导向可切换、标签过滤、邻居高亮、状态着色、统计/标签面板、分享链接、触摸缩放。待细化：节点标签密度过高需默认隐藏/悬停显示；节点点击命中体偏小需优化；力导向斥力参数可调。
- 阶段 3：Obsidian 三栏阅读页
- 阶段 4：生词本等自定义页面、快捷键、偏好记忆
- 阶段 5：Pages 静态部署；上线后把 Worker 的 `ALLOWED_ORIGIN` 从 `*` 改为实际 Pages 域名
