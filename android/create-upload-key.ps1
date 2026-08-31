param(
    [Parameter(Mandatory=$true)][string]$JdkPath,
    [Parameter(Mandatory=$true)][string]$PrivateDirectory
)
$ErrorActionPreference = 'Stop'
$keytool = Join-Path $JdkPath 'bin/keytool.exe'
if (!(Test-Path -LiteralPath $keytool)) { throw 'JDK keytool was not found' }
$privatePath = [IO.Path]::GetFullPath($PrivateDirectory)
New-Item -ItemType Directory -Path $privatePath -Force | Out-Null
$keystore = Join-Path $privatePath 'set4u-upload.keystore'
$passwordFile = Join-Path $privatePath 'upload-password.txt'
if ((Test-Path -LiteralPath $keystore) -or (Test-Path -LiteralPath $passwordFile)) {
    throw 'Existing signing material found. Refusing to replace or rotate it.'
}
$password = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(36))
try {
    # This file is deliberately outside the source tree. Never publish or commit it.
    [IO.File]::WriteAllText($passwordFile, $password)
    $env:SET4U_UPLOAD_PASSWORD = $password
    & $keytool -genkeypair -keystore $keystore -storetype PKCS12 -alias set4u-upload -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=Set4U Upload, OU=Android Release, O=Set4U' -storepass:env SET4U_UPLOAD_PASSWORD -keypass:env SET4U_UPLOAD_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'Key generation failed' }
    & $keytool -exportcert -rfc -keystore $keystore -alias set4u-upload -storepass:env SET4U_UPLOAD_PASSWORD -file (Join-Path $privatePath 'upload-certificate.pem')
    if ($LASTEXITCODE -ne 0) { throw 'Certificate export failed' }
    & $keytool -list -v -keystore $keystore -alias set4u-upload -storepass:env SET4U_UPLOAD_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'Certificate verification failed' }
} finally {
    Remove-Item Env:SET4U_UPLOAD_PASSWORD -ErrorAction SilentlyContinue
    $password = $null
}
Write-Output 'Upload key created. Keep the separate private folder secure and backed up; never upload it.'
