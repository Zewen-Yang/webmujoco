```bash
# 1. 初始化 git（如果还没的话）
cd /Users/zewen/Documents/Alwin-Yang/webmujoco
git init
git add .
git commit -m "Initial commit with GitHub Pages deploy"

# 2. 在 GitHub 网站创建一个空仓库，比如叫 webmujoco
# 3. 关联并推送
git branch -M main
git remote add origin https://github.com/<your-username>/webmujoco.git
git push -u origin main
```
