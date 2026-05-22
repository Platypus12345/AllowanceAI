# Push AllowanceAI to GitHub using Git only (no gh CLI required)
# Prerequisite: create empty repo at https://github.com/new named "AllowanceAI"

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host ""
Write-Host "=== AllowanceAI GitHub Push ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Step 1: Create the repo in your browser (if you have not already):"
Write-Host "  https://github.com/new?name=AllowanceAI&description=AI-powered+personal+finance"
Write-Host "  - Owner: Platypus12345"
Write-Host "  - Name: AllowanceAI"
Write-Host "  - Public"
Write-Host "  - Do NOT add README, .gitignore, or license (repo must be empty)"
Write-Host ""

$open = Read-Host "Open that page now? (Y/n)"
if ($open -ne 'n' -and $open -ne 'N') {
    Start-Process "https://github.com/new?name=AllowanceAI&description=AI-powered+personal+finance"
}

Read-Host "Press Enter after you have created the empty repo on GitHub"

if (-not (git remote get-url origin 2>$null)) {
    git remote add origin https://github.com/Platypus12345/AllowanceAI.git
}

git add -A
$status = git status --porcelain
if ($status) {
    git commit -m "Sync AllowanceAI project for production"
}

Write-Host ""
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push -u origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Success! Repo: https://github.com/Platypus12345/AllowanceAI" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Push failed. Sign in when Windows prompts you, or use a Personal Access Token:" -ForegroundColor Red
    Write-Host '  git remote set-url origin https://Platypus12345:<YOUR_TOKEN>@github.com/Platypus12345/AllowanceAI.git'
    Write-Host "  git push -u origin main"
}
