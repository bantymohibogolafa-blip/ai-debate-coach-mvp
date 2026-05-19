# 网页版 AI 二辩攻辩陪练系统 MVP

这是一个面向高中生辩论训练项目展示的最小可行版本。前端使用 React + Vite，后端使用 Node.js + Express，后端从 `.env` 读取 DeepSeek API Key，不会把密钥暴露到前端。

## 完整项目目录

```text
ai-debate-coach-mvp/
├─ package.json
├─ .gitignore
├─ README.md
├─ client/
│  ├─ package.json
│  ├─ index.html
│  ├─ vite.config.js
│  └─ src/
│     ├─ App.jsx
│     ├─ main.jsx
│     └─ styles.css
└─ server/
   ├─ package.json
   ├─ .env.example
   └─ src/
      ├─ index.js
      ├─ deepseek.js
      └─ prompts.js
```

## 安装依赖命令

```bash
npm install
```

## .env 示例

复制 `server/.env.example` 为 `server/.env`：

```env
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=deepseek-chat
ALIYUN_NLS_APPKEY=your-aliyun-nls-appkey
ALIYUN_ACCESS_KEY_ID=your-aliyun-access-key-id
ALIYUN_ACCESS_KEY_SECRET=your-aliyun-access-key-secret
ALIYUN_NLS_URL=https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr
ALIYUN_NLS_TOKEN_URL=http://nls-meta.cn-shanghai.aliyuncs.com/
PORT=3001
```

## 本地运行步骤

1. 安装依赖：

```bash
npm install
```

2. 创建后端环境变量文件：

```bash
cp server/.env.example server/.env
```

Windows PowerShell 可使用：

```powershell
Copy-Item server/.env.example server/.env
```

3. 把 `server/.env` 中的 `DEEPSEEK_API_KEY` 改成自己的 Key。

4. 同时启动前后端：

```bash
npm run dev
```

如果 Windows PowerShell 提示 `npm.ps1 cannot be loaded`，改用：

```powershell
npm.cmd run dev
```

5. 打开前端页面：

```text
http://localhost:5173
```

后端默认运行在：

```text
http://localhost:3001
```

## Render 部署配置

Build Command:

```bash
npm install && npm run build
```

Start Command:

```bash
npm start
```

环境变量：

```env
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=deepseek-chat
NODE_ENV=production
ALIYUN_NLS_APPKEY=your-aliyun-nls-appkey
ALIYUN_ACCESS_KEY_ID=your-aliyun-access-key-id
ALIYUN_ACCESS_KEY_SECRET=your-aliyun-access-key-secret
ALIYUN_NLS_URL=https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr
ALIYUN_NLS_TOKEN_URL=http://nls-meta.cn-shanghai.aliyuncs.com/
```

不要把真实的 `server/.env` 上传到公开仓库。线上环境变量应在 Render 后台配置。

## 常见报错解决办法

### 1. 前端提示“请求失败”

检查后端是否启动，终端中应看到：

```text
Server running on http://localhost:3001
```

本地开发时，前端通过 `client/vite.config.js` 把 `/api` 代理到 `http://localhost:3001`。

### 2. 后端提示 `Missing DEEPSEEK_API_KEY`

说明没有创建 `server/.env`，或者 `.env` 中没有填写 `DEEPSEEK_API_KEY`。Render 上则需要在 Environment 页面添加该变量。

### 3. DeepSeek 返回 401 / 403

API Key 错误、失效或账号权限不足。请重新生成 Key，并确认填在后端环境变量中。

### 4. DeepSeek 返回 429

请求过于频繁或额度不足。稍后重试，或检查 DeepSeek 控制台额度。

### 5. 端口被占用

后端端口可在 `server/.env` 中修改：

```env
PORT=3002
```

如果修改后端端口，也要同步修改 `client/vite.config.js` 的代理目标。

### 6. Node 版本过低

建议使用 Node.js 18 或以上版本，因为后端使用内置 `fetch` 调用 DeepSeek API。

### 7. Render 免费实例首次访问很慢

Render 免费实例闲置后会休眠，第一次打开可能需要等待几十秒。看到服务恢复后再次刷新即可。
