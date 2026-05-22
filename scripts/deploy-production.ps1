# AllowanceAI — one-shot production deploy helper
# Prerequisites: gh auth login, MongoDB Atlas URI, OpenAI key, Gmail app password

param(
  [string]$VercelToken = $env:VERCEL_TOKEN,
  [string]$MongoUri = $env:MONGO_URI,
  [switch]$SkipVercel
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "==> GitHub push"
gh auth status
if (-not (git remote get-url origin 2>$null)) {
  git remote add origin https://github.com/Platypus12345/AllowanceAI.git
}
gh repo create Platypus12345/AllowanceAI --public --source . --remote origin --push 2>$null
if ($LASTEXITCODE -ne 0) {
  git push -u origin main
}

Write-Host "==> Render: open dashboard and apply render.yaml blueprint"
Write-Host "    https://dashboard.render.com/select-repo?type=blueprint"
Write-Host "    Set MONGO_URI, CLIENT_URL (after Vercel), AI_SERVICE_URL, OPENAI_API_KEY"

if (-not $SkipVercel -and $VercelToken) {
  Write-Host "==> Vercel deploy (client/)"
  $env:VERCEL_TOKEN = $VercelToken
  npx vercel link --cwd client --yes
  npx vercel --cwd client --prod --yes --token $VercelToken
} else {
  Write-Host "==> Vercel: import repo at https://vercel.com/new"
  Write-Host "    Root Directory: client"
  Write-Host "    VITE_API_URL=https://allowanceai-api.onrender.com"
}

Write-Host "Done. Update Render CLIENT_URL with your Vercel URL, then redeploy API."
