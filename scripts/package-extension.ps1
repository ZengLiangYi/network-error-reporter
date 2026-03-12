$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot "manifest.json"

if (-not (Test-Path $manifestPath)) {
  throw "manifest.json not found."
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = $manifest.version

if (-not $version) {
  throw "Extension version is missing in manifest.json."
}

$releaseRoot = Join-Path $projectRoot "release"
$packageName = "network-error-reporter-$version"
$stageDir = Join-Path $releaseRoot $packageName
$zipPath = Join-Path $releaseRoot "$packageName.zip"

if (Test-Path $stageDir) {
  Remove-Item $stageDir -Recurse -Force
}

if (Test-Path $zipPath) {
  Remove-Item $zipPath -Force
}

New-Item -ItemType Directory -Path $stageDir -Force | Out-Null

$includePaths = @(
  "manifest.json",
  "devtools.html",
  "devtools.js",
  "panel.html",
  "panel.css",
  "README.md",
  "PRIVACY.md",
  "RELEASE.md",
  "icons",
  "panel"
)

foreach ($relativePath in $includePaths) {
  $sourcePath = Join-Path $projectRoot $relativePath
  if (-not (Test-Path $sourcePath)) {
    throw "Missing required path: $relativePath"
  }

  $destinationPath = Join-Path $stageDir $relativePath
  $destinationParent = Split-Path -Parent $destinationPath
  if ($destinationParent -and -not (Test-Path $destinationParent)) {
    New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
  }

  if ((Get-Item $sourcePath).PSIsContainer) {
    Copy-Item $sourcePath -Destination $destinationPath -Recurse -Force
  } else {
    Copy-Item $sourcePath -Destination $destinationPath -Force
  }
}

Compress-Archive -Path (Join-Path $stageDir "*") -DestinationPath $zipPath -Force

Write-Output "Created package:"
Write-Output $zipPath
