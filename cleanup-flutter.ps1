$ErrorActionPreference = "Stop"

function Test-NextRoot {
  (Test-Path "next.config.mjs") -or (Test-Path "next.config.js") -or (Test-Path "app") -or (Test-Path "components")
}
if (-not (Test-NextRoot)) { Write-Host "Not a Next.js root. Aborting." -ForegroundColor Yellow; exit 1 }

# Next.js TS files we never delete
$neededTs = @("lib/supabase.ts","lib/utils.ts")
$neededTs | ForEach-Object { if (-not (Test-Path $_)) { Write-Host "Warning: missing $_" -ForegroundColor Yellow } }

# Flutter-only roots/config that are safe to remove if present
$candidates = @(
  "android","ios","linux","macos","windows",
  "web","test",
  "pubspec.yaml","analysis_options.yaml","devtools_options.yaml","local.properties",
  ".dart_tool",".flutter-plugins",".flutter-plugins-dependencies",".packages"
)

# Flutter code inside lib/ (Dart). Keep TS.
$libDartFiles = @("lib/main.dart")
$libDartDirs  = @("lib/screens","lib/providers","lib/widgets","lib/data","lib/utils") | Where-Object { Test-Path $_ }

# Extra safety: skip any lib/* directory that contains .ts or .tsx (in case your web uses it)
$safeLibDirs = @()
foreach ($d in $libDartDirs) {
  $hasTs = Get-ChildItem -Path $d -Recurse -Include *.ts,*.tsx -ErrorAction SilentlyContinue
  if ($hasTs) {
    Write-Host "Skipping $d (contains TS/TSX)" -ForegroundColor Yellow
  } else {
    $safeLibDirs += $d
  }
}

# Build DRY-RUN list
$toRemove = @()
foreach ($p in $candidates + $libDartFiles + $safeLibDirs) { if (Test-Path $p) { $toRemove += $p } }

Write-Host "`n== DRY RUN ==" -ForegroundColor Cyan
if ($toRemove.Count -eq 0) { Write-Host "Nothing to remove."; exit 0 }

Write-Host "Will remove:"
$toRemove | ForEach-Object { Write-Host "  - $_" }

# Also list stray .dart files under lib (these will be removed too)
if (Test-Path "lib") {
  $dartFiles = Get-ChildItem -Path lib -Recurse -Filter *.dart -ErrorAction SilentlyContinue
  if ($dartFiles) {
    Write-Host "`nPlus these Dart files in lib/:"
    $dartFiles | ForEach-Object { Write-Host "  - $($_.FullName)" }
  }
}

$ans = Read-Host "`nProceed with deletion? (y/N)"
if ($ans -notin @("y","Y")) { Write-Host "Aborted."; exit 0 }

# Delete roots/config
foreach ($p in $candidates)   { if (Test-Path $p) { Remove-Item $p -Recurse -Force } }

# Delete Dart-only things in lib/
foreach ($p in $safeLibDirs)  { if (Test-Path $p) { Remove-Item $p -Recurse -Force } }
foreach ($p in $libDartFiles) { if (Test-Path $p) { Remove-Item $p -Force } }

# Remove any remaining .dart under lib/
if (Test-Path "lib") {
  Get-ChildItem -Path lib -Recurse -Filter *.dart | Remove-Item -Force
}

Write-Host "`nCleanup complete ✅  Next.js files (app/, components/, styles/, next.config.*, and lib/*.ts) remain untouched." -ForegroundColor Green
