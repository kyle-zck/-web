# 部署说明（分支 / 数据 / 构建）

## 分支建议

| 分支 | 用途 |
|------|------|
| `dev` | 联调、Vercel **Preview** |
| `main` | **Production**（生产） |

在 Vercel：**Settings → Git → Production Branch** 设为 `main`；推送 `dev` 会自动生成预览部署。

## Vercel 逐步操作

**分步点击路径、Production 分支、`dev` 预览、Deploy Hooks 说明** 见 **[`VERCEL.md`](./VERCEL.md)**。  
**第 3 步：没有数据库时如何建 Neon + Vercel 弹窗怎么填** 见 **[`VERCEL-STEP3-ENV-AND-DB.md`](./VERCEL-STEP3-ENV-AND-DB.md)**。

## 部署前检查

1. 本地 `npm run build` 必须通过。
2. Vercel 中为 **Preview** 与 **Production** 分别配置环境变量（变量名见 [`.env.example`](./.env.example)）。
3. 勿提交 `.env.local`；勿在代码中硬编码密钥。
4. **Vercel 上请使用 `SERIES_STORAGE=pg` + `DATABASE_URL`**，勿依赖 `data/*.json` 持久化（见 `VERCEL.md`）。

## `data/*.json` 与 Git

- 根目录 **`data/*.json` 已加入 `.gitignore`**，不再进入版本库（避免误提交业务/用户数据）。
- 保留 **`data/.gitkeep`** 保证 `data/` 目录存在。
- 新克隆后本地缺少 JSON 时：开发环境下多数接口会返回默认值或在首次写入时创建文件（仅本机有效）。
