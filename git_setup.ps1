# ========================================================
# JobEaseAI - Automated Git Initializer & Commit (PowerShell)
# ========================================================

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "      JobEaseAI - Automated Git Initializer & Commit" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Cyan

# Verify Git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Git was not found in PATH." -ForegroundColor Red
    Write-Host "Please install Git from https://git-scm.com/" -ForegroundColor Yellow
    exit 1
}

# 1. Initialize repo
if (-not (Test-Path ".git")) {
    Write-Host "[1/4] Initializing new Git repository with main branch..." -ForegroundColor Green
    git init -b main
} else {
    Write-Host "[1/4] Existing Git repository detected." -ForegroundColor Yellow
}

# 2. Stage files
Write-Host "`n[2/4] Staging files..." -ForegroundColor Green
git add .
git status -s

# 3. Commit
Write-Host "`n[3/4] Creating initial structured commit..." -ForegroundColor Green
git commit -m "feat: complete implementation of JobEaseAI with 1-page guardrails, AI JD evaluator, 3 templates, and full documentation"

# 4. Instructions
Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "[4/4] SUCCESS! All files committed locally to 'main'." -ForegroundColor Green
Write-Host "========================================================`n" -ForegroundColor Cyan
Write-Host "To link and push your project to GitHub, execute:" -ForegroundColor White
Write-Host "  1. Create an empty repository on GitHub at: https://github.com/new (Name: JobEaseAI)" -ForegroundColor Gray
Write-Host "  2. Link remote origin:" -ForegroundColor Gray
Write-Host "     git remote add origin https://github.com/<YOUR_USERNAME>/JobEaseAI.git" -ForegroundColor Yellow
Write-Host "  3. Push to GitHub:" -ForegroundColor Gray
Write-Host "     git push -u origin main" -ForegroundColor Yellow
Write-Host "`nDetailed instructions available in GITHUB_GUIDE.md" -ForegroundColor Cyan
Write-Host ""
