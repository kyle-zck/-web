# 本地开发常见问题

## 为什么要固定 `PORT=3000`？

同时开多个 `next dev` 时，Next 会在 **3000 被占用时自动改用 3001、3002…**。  
浏览器若仍打开 **旧端口**，会出现：

- `/_next/static/chunks/...` **404 / 500**
- 一改代码就 **整页报错**（热更新拿到的 chunk 与当前 dev 进程不一致）

**做法**：只保留 **一个** 终端跑 `npm run dev`，地址始终用终端里打印的 **Local: http://localhost:3000**。

## 一键：关掉旧进程 + 清缓存 + 重新启动

```bash
npm run dev:reset
```

等价于：释放常见端口 → 删除 `.next` → 在 **3000** 端口启动开发服务器。

浏览器打开：<http://localhost:3000>

## 仍建议排查

1. **不要用多个项目共抢同一端口**：改代码前先 `npm run dev:kill` 或 `dev:reset`。
2. **Turbo 模式不稳定时**：不要用 `dev:turbo`，改用普通 `npm run dev`。
3. **磁盘/同步盘**：项目放在本机磁盘；避免把仓库放在网盘同步目录里再开发（易触发异常监听与缓存）。

---

## 控制台里 `layout.css`、`main-app.js`、`error.js` 等一堆 404？

这是 **开发模式下的正常现象**（尤其在**刚保存文件、热更新、或重启 dev** 的瞬间），原因一般是：

1. **HTML 里引用的 chunk 带 hash**（例如 `main-app-abc123.js`），你一改代码或重新编译，**旧 hash 的文件被删掉**，浏览器若仍按旧地址请求 → **404**。
2. **页面没等编译完成就刷新**，或 **多个标签页 / 多个 dev 进程** 混用，也会出现「HTML 与当前 dev 进程不一致」。

### 怎么处理

1. **等终端出现** `✓ Compiled ...` **再刷新**（不要连点保存+立刻强刷）。
2. **硬刷新**：macOS `Cmd + Shift + R`（或关掉该标签重新打开 `http://localhost:3000`）。
3. 仍不行：执行 **`npm run dev:reset`**，然后**只保留一个**浏览器标签访问本站。
4. 调试时可在开发者工具 **Network** 里勾选 **Disable cache**（打开 DevTools 时禁用缓存），减少旧资源干扰。

### 黄色警告：preload font「未在几秒内使用」

来自 `next/font`（如 Inter）的预加载提示，**一般可忽略**，不影响功能；与上面的 404 不是同一类问题。

### 项目内已做的减轻措施

首页已**去掉**对 `ContinueWatching` 的 `next/dynamic` 分包，改为静态 `import`，减少开发模式下 `_rsc_components_*` 分包丢失导致的整页 404/白屏。

`middleware` 的 `matcher` 已与 **Next 官方文档**对齐（排除 `_next/static`、`_next/image`、webpack / HMR 等），避免中间件误介入静态资源，导致 **无 CSS、控制台 layout.css / main-app.js 404**。
