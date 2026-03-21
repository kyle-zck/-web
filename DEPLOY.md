# 部署说明（Vercel / 分支）

## 分支建议

| 分支 | 用途 |
|------|------|
| `dev` | 首次联调、Preview 部署 |
| `main` | 生产环境（Production） |

## 部署前检查

1. 本地执行 `npm run build`，必须通过。
2. 在 Vercel 项目 **Settings → Environment Variables** 中，为 **Preview** / **Production** 配置变量（名称见仓库根目录 `.env.example`）。
3. **不要**在代码中硬编码密钥；`.env.local` 已在 `.gitignore` 中，勿提交。

## `data/*.json`

仓库内 `data/` 下 JSON 为示例/本地数据。若生产环境由数据库或外部存储管理剧目，请在 Vercel 上评估是否改为忽略该目录或改用初始化脚本。
