param(
    [Parameter(Mandatory=$true)][string]$JdkPath,
    [Parameter(Mandatory=$true)][string]$PrivateDirectory,
    [Parameter(Mandatory=$true)][string]$InputBundle,
    [Parameter(Mandatory=$true)][string]$OutputBundle
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path -LiteralPath $InputBundle)) { throw 'Build an unsigned AAB first' }
if (Test-Path -LiteralPath $OutputBundle) { throw 'Refusing to overwrite a release bundle' }
$keystore = Join-Path $PrivateDirectory 'set4u-upload.keystore'
try {
    $env:SET4U_UPLOAD_PASSWORD = Get-Content -LiteralPath (Join-Path $PrivateDirectory 'upload-password.txt') -Raw
    & (Join-Path $JdkPath 'bin/jarsigner.exe') -keystore $keystore -storepass:env SET4U_UPLOAD_PASSWORD -keypass:env SET4U_UPLOAD_PASSWORD -sigalg SHA256withRSA -digestalg SHA-256 -signedjar $OutputBundle $InputBundle set4u-upload
    if ($LASTEXITCODE -ne 0) { throw 'Bundle signing failed' }
    & (Join-Path $JdkPath 'bin/jarsigner.exe') -verify $OutputBundle
    if ($LASTEXITCODE -ne 0) { throw 'Bundle signature verification failed' }
} finally {
    Remove-Item Env:SET4U_UPLOAD_PASSWORD -ErrorAction SilentlyContinue
}
