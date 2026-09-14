# 蛊真人 · 静读

为手机与电脑设计的静态小说阅读器。豆沙绿（默认）、纸色、明亮和夜读四种主题，支持黑体／宋体切换、字号、行距、段距、正文宽度、专注模式、可选的 20 分钟休息提醒、章节搜索、书签、前后翻章和浏览器本地阅读进度。调整排版后会尽量保持当前段落。无需后端或第三方 CDN。进度和书签按设备、浏览器分别保存，不跨设备同步。

## 本地预览

在项目目录运行 `python -m http.server 8080 --directory docs`，访问 http://localhost:8080 。同一局域网的手机可使用电脑的局域网 IP 和端口 8080 访问（需要防火墙允许）。不要直接双击 HTML，浏览器会限制本地 JSON 读取。

## 更新书籍

原始 EPUB 放在项目根目录，运行 `python scripts/build_book.py`。脚本按照 EPUB spine 顺序提取正文与目录至 `docs/book`。现有 EPUB 含卷首信息、序言和章节共 2,555 篇。使用 `scripts/clean_text.py` 中经过核实的规则清除来源链接、下载广告、网站水印和残留标记，保留小说正文和作者附言，不加载书内脚本或外部资源。每次构建会生成 `reports/cleaning-audit.json`，记录原文件 SHA-256 及逐段清理前后对照。原始 EPUB 不修改，已从 Git 中忽略，生成的正文数据包含在网站内。

## GitHub Pages

将项目推送到目标仓库的 `main` 分支。在仓库 Settings → Pages → Build and deployment 中将 Source 设为 GitHub Actions，然后运行 Deploy reader to GitHub Pages 工作流。工作流只发布 `docs` 目录，兼容仓库子路径。

官方说明：https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

发布的网站包含小说正文；GitHub Pages 网站访问者可以读取这些正文。仓库与线上地址待指定后配置。

默认字体为设备可用的苹方、微软雅黑或 Noto Sans 中文黑体，常规字重。首次使用时手机默认 20px、电脑 22px，行距 2 倍；已有字号与行距偏好保留。豆沙绿背景 #C7EDCC，正文 #283B2D，对比度约 9.36:1。配色与字号是阅读偏好，不宣称医疗护眼效果。
