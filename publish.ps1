param(
  [string]$EnvId = "lf-test-1992-d7gnr8s2yfa97cf4f",
  [string]$CloudPath = "/biaoju"
)

$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path -LiteralPath $PSScriptRoot).Path
if ($projectRoot -eq "F:\Game\Law Firm Simulator") {
  throw "Safety check failed: this release script must never target Law Firm Simulator."
}
if ([string]::IsNullOrWhiteSpace($CloudPath) -or $CloudPath -eq "/") {
  throw "Safety check failed: Biaoju must deploy to an isolated subpath, never the hosting root."
}
if ($CloudPath.TrimEnd("/") -ne "/biaoju") {
  throw "Safety check failed: the approved CloudBase target is /biaoju only."
}

Push-Location -LiteralPath $projectRoot
try {
  & npm.cmd test -- --run
  if ($LASTEXITCODE -ne 0) { throw "Tests failed." }

  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw "Build failed." }

  $distDirectory = Join-Path $projectRoot "dist"
  $browserEntry = Join-Path $distDirectory "index.html"
  if (-not (Test-Path -LiteralPath $browserEntry -PathType Leaf)) { throw "Missing browser release entry." }

  & tcb.cmd hosting deploy $distDirectory $CloudPath -e $EnvId
  if ($LASTEXITCODE -ne 0) { throw "CloudBase deployment failed." }

  Write-Host "Biaoju was published to the isolated CloudBase path $CloudPath." -ForegroundColor Green
}
finally {
  Pop-Location
}
