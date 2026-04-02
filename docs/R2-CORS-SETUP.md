# R2 CORS 配置指南

## 问题描述

上传视频时出现 `failed to fetch` 或 `net::ERR_INTERNET_DISCONNECTED` 错误，这通常是由于 **Cloudflare R2 桶的 CORS 配置不正确** 导致的。

## 为什么需要 CORS 配置

当浏览器通过 presigned URL 直接上传文件到 R2 时，浏览器会先发送一个 **CORS preflight request (OPTIONS 请求)** 来检查是否允许上传。如果 R2 桶没有配置正确的 CORS 策略，Cloudflare 会拒绝这个请求，导致上传失败。

## 解决方案

### 方法一：通过 Cloudflare Dashboard 配置 CORS

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **R2** → 选择你的桶
3. 点击 **Settings** 标签
4. 找到 **CORS Policy** 部分
5. 点击 **Add CORS Policy**
6. 添加以下配置：

```
Allowed Origin: *
Allowed Methods: GET, PUT, POST, HEAD
Allowed Headers: *
Expose Headers: ETag
Max Age (seconds): 3600
```

或者，如果你需要更严格的配置：

```
Allowed Origin: https://www.popularreels.com (替换为你的域名)
Allowed Methods: GET, PUT, POST, HEAD
Allowed Headers: Content-Type, Content-MD5, Content-Disposition, Content-Encoding, Content-Language, If-Match, If-None-Match, Cache-Control, Expires
Expose Headers: ETag
Max Age (seconds): 3600
```

### 方法二：通过 R2 API 配置 CORS

使用 Cloudflare API 添加 CORS 规则：

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/r2/buckets/<BUCKET_NAME>/cors" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "cors": [
      {
        "maxAgeSeconds": 3600,
        "allowedOrigins": ["*"],
        "allowedMethods": ["GET", "PUT", "POST", "HEAD"],
        "allowedHeaders": ["*"],
        "exposeHeaders": ["ETag"]
      }
    ]
  }'
```

### 方法三：使用 AWS CLI 配置

```bash
# 安装 AWS CLI 并配置凭证
aws configure set aws_access_key_id <ACCESS_KEY>
aws configure set aws_secret_access_key <SECRET_KEY>
aws configure set region auto
aws configure set endpoint_url https://069888bd80f28f6b7c8e05b49dbfaff5.r2.cloudflarestorage.com

# 创建 CORS 配置文件 cors.json
cat > cors.json << 'EOF'
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3600
    }
]
EOF

# 应用 CORS 配置
aws s3api put-bucket-cors --bucket web --cors-configuration file://cors.json
```

## 验证 CORS 配置

### 1. 使用 curl 测试

```bash
curl -X OPTIONS "https://069888bd80f28f6b7c8e05b49dbfaff5.r2.cloudflarestorage.com/test-file" \
  -H "Origin: https://www.popularreels.com" \
  -H "Access-Control-Request-Method: PUT" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v
```

应该返回类似：
```
< access-control-allow-origin: *
< access-control-allow-methods: GET, PUT, POST, HEAD
```

### 2. 在浏览器开发者工具中检查

1. 打开浏览器的开发者工具 (F12)
2. 切换到 **Network** 标签
3. 尝试上传文件
4. 查找 **OPTIONS** 请求（preflight）
5. 检查响应头中是否包含：
   - `Access-Control-Allow-Origin`
   - `Access-Control-Allow-Methods`
   - `Access-Control-Allow-Headers`

## 常见问题

### Q: 错误 `net::ERR_INTERNET_DISCONNECTED` 是什么原因？

A: 这通常是以下原因之一：
1. R2 桶的 CORS 配置不正确
2. Presigned URL 已过期（15分钟后过期）
3. 网络连接问题
4. R2 桶没有启用公开访问

### Q: CORS 配置后还是不生效？

A: 请检查：
1. CORS 规则是否添加到了正确的桶
2. 清除浏览器缓存或使用隐私模式测试
3. 等待几分钟让配置生效
4. 检查 `allowedOrigins` 是否包含你的网站域名

### Q: 可以使用通配符 `*` 吗？

A: 可以，但不推荐用于生产环境。通配符会允许任何网站访问你的桶。建议只允许你的网站域名。

## 相关文档

- [Cloudflare R2 CORS 文档](https://developers.cloudflare.com/r2/api/data-operations/cors/)
- [AWS S3 CORS 文档](https://docs.aws.amazon.com/AmazonS3/latest/userguide/cors.html)
- [项目文档：Supabase + R2](./SUPABASE-R2.md)
