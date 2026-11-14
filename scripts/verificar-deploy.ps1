<#
  verificar-deploy.ps1 — espera a que el archivo SERVIDO coincida con el LOCAL.

  Compara el SHA256 del TEXTO normalizado (CRLF -> LF), asi el EOL de git
  (core.autocrlf) no da falsos negativos. Solo para assets de texto (js/css/php).

  Uso: pwsh -NoProfile -File scripts/verificar-deploy.ps1 `
         -Url https://muyunicos.com/wp-content/themes/generatepress-child/assets/js/calculadora_stickers.js `
         -Local ..\muyunicos\assets\js\calculadora_stickers.js

  Sale 0 con DEPLOY OK o 1 si no coincide tras N intentos. No despliega.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string] $Url,
    [Parameter(Mandatory)][string] $Local,
    [int] $Intentos = 8,
    [int] $Segundos = 20
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Local)) { throw ('No existe el local: ' + $Local) }

function HashTexto([string] $ruta) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $txt = [System.IO.File]::ReadAllText($ruta) -replace "`r`n", "`n"
    return ([BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($txt)))).Replace('-', '')
}

$esperado = HashTexto $Local
for ($i = 1; $i -le $Intentos; $i++) {
    $sep = if ($Url.Contains('?')) { '&' } else { '?' }
    $u = $Url + $sep + 'nc=' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        Invoke-WebRequest -Uri $u -OutFile $tmp -TimeoutSec 30
        if ((HashTexto $tmp) -eq $esperado) {
            'DEPLOY OK (intento ' + $i + '): ' + $Local
            exit 0
        }
        'intento ' + $i + ': el servido NO coincide (' + (Get-Item $tmp).Length + ' bytes)'
    } catch {
        'intento ' + $i + ': ' + $_.Exception.Message
    } finally {
        Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds $Segundos
}
Write-Host ('DEPLOY PENDIENTE: el servido no coincide con el local tras ' + $Intentos + ' intentos.')
exit 1