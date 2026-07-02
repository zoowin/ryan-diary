# Ryan 成长日记 — 部署指南

## 方案一：Vercel 部署（推荐，完全免费）

### 第一步：安装 Vercel CLI
```bash
npm i -g vercel
```

### 第二步：登录 Vercel
```bash
vercel login
```
会让你输入邮箱，然后去邮箱点确认链接。

### 第三步：部署
```bash
cd "vercel-deploy"
vercel --prod
```
按提示操作，选择免费方案即可。

部署成功后会得到一个 `https://xxx.vercel.app` 的链接，永久有效！

### 第四步：设置环境变量（OCR 功能需要）
部署后在 Vercel 后台 → Settings → Environment Variables 添加：
- `VOL_ACCESS_KEY` = 你的火山引擎 Access Key
- `VOLC_SECRET_KEY` = 你的火山引擎 Secret Key  
- `VOLC_ARK_API_KEY` = 你的 Ark API Key

（这三个值和 `volc-keys.env` 里的一样）

设置完后点 "Redeploy" 让环境变量生效。

---

## 方案二：GitHub Pages（纯静态，OCR 不可用）

如果不需要 OCR 功能，可以直接用 GitHub Pages 免费托管静态页面：

1. 在 GitHub 新建一个仓库（比如 `ryan-diary`）
2. 把 `public/index.html` 推送到仓库
3. 在仓库 Settings → Pages → Source 选择 `main` 分支
4. 等待 1-2 分钟，会生成 `https://你的用户名.github.io/ryan-diary/` 链接

⚠️ 注意：GitHub Pages 纯静态托管，**OCR 功能无法使用**（需要后端代理）。

---

## 部署后测试

1. 打开部署好的链接
2. 选择角色 → 设置密码 → 进入主页
3. 测试记录功能（应该完全正常）
4. 测试 OCR：上传截图 → 看是否能识别

---

## 常见问题

**Q: Vercel 免费额度够用吗？**
A: 完全够用。Vercel 免费方案：
- 无限带宽（个人使用）
- 100GB 带宽/月
-  serverless 函数执行时间 10 秒/次
- 完全够一个家庭使用

**Q: 部署后数据会丢吗？**
A: 所有数据存在浏览器 localStorage 里，只要不清除浏览器数据就不会丢。建议定期用"设置→导出数据"备份。

**Q: 能让其他人也用吗？**
A: 把链接发给他们就行，每个人打开后都会独立创建自己的家庭账号（数据互不干扰）。
