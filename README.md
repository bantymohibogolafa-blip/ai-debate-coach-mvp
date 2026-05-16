# 网页版 AI 二辩攻辩陪练系统 MVP

一个面向高中生辩论训练项目展示的最小可行版本。前端使用 React + Vite，后端使用 Node.js + Express，后端读取 `.env` 中的 DeepSeek API Key。

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
PORT=3001
```

## 本地运行步骤

1. 安装依赖：

```bash
npm install
```

2. 配置后端环境变量：

```bash
cp server/.env.example server/.env
```

3. 将 `server/.env` 中的 `DEEPSEEK_API_KEY` 改成自己的 Key。

4. 同时启动前后端：

```bash
npm run dev
```

5. 打开前端页面：

```text
http://localhost:5173
```

后端默认运行在：

```text
http://localhost:3001
```

## 部署方式

推荐部署成一个 Node 服务：先构建前端，再由 Express 托管 `client/dist`，同时提供 `/api` 接口。

### 通用部署配置

在部署平台中填写：

```text
Build Command: npm install && npm run build
Start Command: npm start
Node Version: 18 或以上
```

环境变量填写：

```env
DEEPSEEK_API_KEY=sk-your-deepseek-api-key
DEEPSEEK_API_URL=https://api.deepseek.com/chat/completions
DEEPSEEK_MODEL=deepseek-chat
NODE_ENV=production
```

不要把 `server/.env` 上传到公开仓库，线上环境变量应在部署平台后台配置。

### 使用 Render / Railway / Zeabur 等 Node 平台

1. 将项目推送到 GitHub。
2. 在平台中新建 Web Service / Node Service。
3. 选择该 GitHub 仓库。
4. 设置构建命令：

```bash
npm install && npm run build
```

5. 设置启动命令：

```bash
npm start
```

6. 添加环境变量 `DEEPSEEK_API_KEY`、`DEEPSEEK_API_URL`、`DEEPSEEK_MODEL`、`NODE_ENV`。
7. 部署完成后，打开平台分配的域名即可访问页面。

### 使用宝塔 / 服务器 / VPS

1. 在服务器安装 Node.js 18+。
2. 上传项目代码。
3. 在项目根目录执行：

```bash
npm install
npm run build
```

4. 创建 `server/.env`，填入 DeepSeek API Key。
5. 启动服务：

```bash
NODE_ENV=production npm start
```

Windows PowerShell 可使用：

```powershell
$env:NODE_ENV="production"; npm start
```

6. 使用 Nginx 反向代理到 Node 服务端口，例如 `3001`。

## 常见报错解决办法

### 1. 前端提示「请求失败」

检查后端是否已启动，终端中是否能看到：

```text
Server running on http://localhost:3001
```

### 2. 后端提示 `Missing DEEPSEEK_API_KEY`

说明没有创建 `server/.env`，或 `.env` 中没有填写 `DEEPSEEK_API_KEY`。

### 3. DeepSeek 返回 401 / 403

API Key 错误、失效或账户权限不足。请重新生成 Key，并确认填在 `server/.env` 中。

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
