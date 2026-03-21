# 海外短剧 Web 平台（Next.js）

## 技术栈
- Next.js（App Router）
- TypeScript
- Tailwind CSS（深色主题 + 紫色强调 `#7C3AED`）

## 目录结构（已按需求初始化）
- `components/ui/`：通用 UI（`BottomNav`、`Badge`、`SeriesRow` 等）
- `components/player/`：播放器/轮播相关（`HeroCarousel`）
- `app/series/`：短剧详情路由
- `app/profile/`：个人中心路由
- `lib/utils/`：工具函数（`cn`）
- `constants/`：Mock 数据（Trending / New Arrivals / Category Tags）

## 运行
```bash
npm install
npm run dev
```

然后打开 `http://localhost:3000`

## 部署（Vercel）

- 分支约定与构建检查：见根目录 [`DEPLOY.md`](./DEPLOY.md)。
- **在 Vercel 控制台中的具体操作**（导入项目、环境变量、`main`/`dev`、无持久磁盘说明）：见 [`VERCEL.md`](./VERCEL.md)。
- **第 3 步：新建 Postgres（如 Neon）+ 环境变量弹窗逐项填写**：见 [`VERCEL-STEP3-ENV-AND-DB.md`](./VERCEL-STEP3-ENV-AND-DB.md)。
- 环境变量模板：[`.env.example`](./.env.example)。

## 图片占位
当前 Mock 数据引用了 `public/images/series/` 下的图片文件名，见 `public/images/series/README.txt`。
