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
  throw "manifest.json was not found. Please run update.bat inside the extension folder."
}

$currentManifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json
$currentVersion = [string]$currentManifest.version

Write-Step "Checking latest GitHub release"
$releaseApi = "https://api.github.com/repos/$Owner/$Repo/releases/latest"
$release = Invoke-RestMethod -Uri $releaseApi -Headers @{ "User-Agent" = "xhs-topic-picker-updater" }
$latestVersion = ([string]$release.tag_name).TrimStart("v", "V")

Write-Host "Current version: $currentVersion"
Write-Host "Latest version:  $latestVersion"

if ($latestVersion -eq $currentVersion) {
  Write-Host "Already up to date." -ForegroundColor Green
  exit 0
}

$asset = $release.assets | Where-Object { $_.name -match "\.zip$" } | Select-Object -First 1
if (-not $asset) {
  throw "No zip asset was found in the latest GitHub Release. Please upload xhs-topic-picker-deepseek.zip."
}

$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("xhs-topic-picker-update-" + [Guid]::NewGuid().ToString("N"))
$zipPath = Join-Path $tempRoot $asset.name
$extractDir = Join-Path $tempRoot "extract"

New-Item -ItemType Directory -Path $tempRoot, $extractDir | Out-Null

try {
  Write-Step "Downloading $($asset.name)"
  Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath -Headers @{ "User-Agent" = "xhs-topic-picker-updater" }

  Write-Step "Extracting package"
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force

  $sourceManifest = Get-ChildItem -Path $extractDir -Filter "manifest.json" -Recurse | Select-Object -First 1
  if (-not $sourceManifest) {
    throw "The downloaded zip does not contain manifest.json, so it does not look like an extension package."
  }

  $sourceDir = Split-Path -Parent $sourceManifest.FullName
  $sourceVersion = [string]((Get-Content -Raw -Encoding UTF8 -LiteralPath $sourceManifest.FullName | ConvertFrom-Json).version)

  Write-Step "Copying files into the extension folder"
  Get-ChildItem -LiteralPath $sourceDir -Force | ForEach-Object {
    $destination = Join-Path $targetDir $_.Name
    Copy-Item -LiteralPath $_.FullName -Destination $destination -Recurse -Force
  }

  Write-Host ""
  Write-Host "Update complete: $currentVersion -> $sourceVersion" -ForegroundColor Green
  Write-Host "Open chrome://extensions/ or edge://extensions/ and click Reload for this extension."
  Start-Process "chrome://extensions/" -ErrorAction SilentlyContinue
} finally {
  if (Test-Path -LiteralPath $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
