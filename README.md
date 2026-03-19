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

## 图片占位
当前 Mock 数据引用了 `public/images/series/` 下的图片文件名，见 `public/images/series/README.txt`。
