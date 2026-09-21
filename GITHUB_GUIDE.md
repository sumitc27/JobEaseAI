# Step-by-Step Guide: Publishing JobEaseAI to GitHub

This guide walks you through publishing **JobEaseAI** to your GitHub account with complete documentation, commit history, and clean repository structure.

---

## Step 1: Create a New Repository on GitHub

1. Open your web browser and go to [github.com/new](https://github.com/new).
2. Set the **Repository name** to: `JobEaseAI` (or any name you prefer).
3. (Optional) Add a **Description**: `AI-powered resume tailoring tool with strict 1-page formatting guardrails and targeted JD suggestions.`
4. Choose **Public** or **Private**.
5. ⚠️ **IMPORTANT**: Under **"Initialize this repository with:"**, leave all checkboxes **UNCHECKED**:
   - ❌ Do NOT check *Add a README file* (we already have a complete one).
   - ❌ Do NOT check *Add .gitignore* (we already have a complete one).
   - ❌ Do NOT check *Choose a license* (we already have an MIT license).
6. Click the green **"Create repository"** button.

---

## Step 2: Initialize Git and Commit Locally

You can use either the automated script or the command line:

### Option A: The 1-Click Script (Easiest)
- In File Explorer, go to `c:\Users\sumit\Desktop\JobEaseAI`.
- Double-click **`git_setup.bat`** (or right-click `git_setup.ps1` -> *Run with PowerShell*).
- It will automatically initialize Git, stage all project files, and create a structured initial commit.

---

### Option B: Using the Terminal (PowerShell or CMD)
Open a terminal in `c:\Users\sumit\Desktop\JobEaseAI` and run:

```powershell
# 1. Initialize Git on the 'main' branch
git init -b main

# 2. Stage all project files and documentation
git add .

# 3. Create the initial commit
git commit -m "feat: initial implementation of JobEaseAI with 1-page guardrails, AI JD match engine, and 3 resume templates"
```

---

## Step 3: Link Your GitHub Repository & Push

Replace `<YOUR_GITHUB_USERNAME>` with your actual GitHub username and run:

```powershell
# 1. Add your GitHub remote repository
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/JobEaseAI.git

# 2. Verify remote is set
git remote -v

# 3. Push all code and documentation to GitHub
git push -u origin main
```

---

## Step 4: Verify on GitHub

1. Refresh your repository page on GitHub (`https://github.com/<YOUR_GITHUB_USERNAME>/JobEaseAI`).
2. You should see:
   - ✅ The complete project files and directories (`public/`, `services/`, `server.js`).
   - ✅ The rich **`README.md`** rendered on your repository homepage with badges and diagrams.
   - ✅ The **MIT License** badge on the sidebar.
   - ✅ Clean `.gitignore` preventing unwanted files from being tracked.

---

## 💡 Troubleshooting Common GitHub Issues

### Issue 1: "fatal: remote origin already exists"
If you previously added a remote URL, update it with:
```powershell
git remote set-url origin https://github.com/<YOUR_GITHUB_USERNAME>/JobEaseAI.git
```

### Issue 2: "Authentication failed" (Password Authentication Deprecation)
GitHub requires a **Personal Access Token (PAT)** or SSH key instead of your account password:
1. Go to [github.com/settings/tokens](https://github.com/settings/tokens) -> **Generate new token (classic)**.
2. Select scopes: `repo` (Full control of private repositories).
3. Copy the token and paste it as your password when Git prompts you in the terminal.

### Issue 3: Using GitHub Desktop (GUI Alternative)
If you prefer a visual app:
1. Open **GitHub Desktop**.
2. Click **File** -> **Add Local Repository...**.
3. Select `c:\Users\sumit\Desktop\JobEaseAI`.
4. Click **Publish repository** to push it directly to your GitHub account.
