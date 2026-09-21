@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo       JobEaseAI - Automated Git Initializer & Commit
echo ========================================================
echo.

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed or not in PATH!
    echo Please install Git from https://git-scm.com/
    pause
    exit /b 1
)

echo [1/4] Checking Git repository status...
if not exist ".git" (
    echo [*] Initializing new Git repository with main branch...
    git init -b main
) else (
    echo [*] Existing Git repository detected.
)

echo.
echo [2/4] Staging files...
git add .
git status -s

echo.
echo [3/4] Creating commit...
git commit -m "feat: complete implementation of JobEaseAI with 1-page guardrails, AI JD evaluator, 3 templates, and full documentation"

echo.
echo ========================================================
echo [4/4] SUCCESS! Code committed locally to 'main' branch.
echo ========================================================
echo.
echo To push to your GitHub account:
echo   1. Create an empty repository at: https://github.com/new
echo      (Repository Name: JobEaseAI)
echo   2. Run this command to link your GitHub repository:
echo      git remote add origin https://github.com/YOUR_USERNAME/JobEaseAI.git
echo   3. Run this command to push:
echo      git push -u origin main
echo.
echo See GITHUB_GUIDE.md for detailed troubleshooting and token setup.
echo.
pause
