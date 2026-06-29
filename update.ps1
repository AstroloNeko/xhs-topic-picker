param(
  [string]$Owner = "AstroloNeko",
  [string]$Repo = "xhs-topic-picker"
)

$ErrorActionPreference = "Stop"

function Write-Step($Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

$targetDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$manifestPath = Join-Path $targetDir "manifest.json"

if (-not (Test-Path -LiteralPath $manifestPath)) {
  throw "没有在当前文件夹找到 manifest.json。请把 update.bat 放在插件文件夹里运行。"
}

$currentManifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json
$currentVersion = [string]$currentManifest.version

Write-Step "正在检查 GitHub 最新版本"
$releaseApi = "https://api.github.com/repos/$Owner/$Repo/releases/latest"
$release = Invoke-RestMethod -Uri $releaseApi -Headers @{ "User-Agent" = "xhs-topic-picker-updater" }
$latestVersion = ([string]$release.tag_name).TrimStart("v", "V")

Write-Host "当前版本：$currentVersion"
Write-Host "最新版本：$latestVersion"

if ($latestVersion -eq $currentVersion) {
  Write-Host "已经是最新版本，不需要更新。" -ForegroundColor Green
  exit 0
}

$asset = $release.assets | Where-Object { $_.name -match "\.zip$" } | Select-Object -First 1
if (-not $asset) {
  throw "最新 Release 没有找到 zip 附件。请在 GitHub Release 里上传 xhs-topic-picker-deepseek.zip。"
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("xhs-topic-picker-update-" + [Guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $tempRoot $asset.name
$extractDir = Join-Path $tempRoot "extract"

New-Item -ItemType Directory -Path $tempRoot, $extractDir | Out-Null

try {
  Write-Step "正在下载 $($asset.name)"
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath -Headers @{ "User-Agent" = "xhs-topic-picker-updater" }

  Write-Step "正在解压"
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force

  $sourceManifest = Get-ChildItem -Path $extractDir -Filter "manifest.json" -Recurse | Select-Object -First 1
  if (-not $sourceManifest) {
    throw "下载的 zip 里没有 manifest.json，无法确认这是插件包。"
  }

  $sourceDir = Split-Path -Parent $sourceManifest.FullName
  $sourceVersion = [string]((Get-Content -Raw -Encoding UTF8 -LiteralPath $sourceManifest.FullName | ConvertFrom-Json).version)

  Write-Step "正在覆盖插件文件"
  Get-ChildItem -LiteralPath $sourceDir -Force | ForEach-Object {
    $destination = Join-Path $targetDir $_.Name
    Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force
  }

  Write-Host ""
  Write-Host "更新完成：$currentVersion -> $sourceVersion" -ForegroundColor Green
  Write-Host "请打开 chrome://extensions/ 或 edge://extensions/，点击本插件的“重新加载”。"
  Start-Process "chrome://extensions/" -ErrorAction SilentlyContinue
} finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
