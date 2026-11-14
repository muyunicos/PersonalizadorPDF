<#
  verificar-deploy.ps1 — espera a que el archivo SERVIDO coincida con el LOCAL.

  Uso: pwsh -NoProfile -File scripts/verificar-deploy.ps1 `
         -Url https://muyunicos.com/wp-content/themes/generatepress-child/assets/js/calculadora_stickers.js `
         -Local ..\muyunicos\assets\js\calculadora_stickers.js

  Sale 0 con DEPLOY OK (mismo SHA256) o 1 si no coincide tras N intentos.
  No despliega: solo verifica. El deploy lo dispara el push + el webhook.
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
$esperado = (Get-FileHash -LiteralPath $Local -Algorithm SHA256).Hash
for ($i = 1; $i -le $Intentos; $i++) {
    $sep = if ($Url.Contains('?')) { '&' } else { '?' }
    $u = $Url + $sep + 'nc=' + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        Invoke-WebRequest -Uri $u -OutFile $tmp -TimeoutSec 30
        $actual = (Get-FileHash -LiteralPath $tmp -Algorithm SHA256).Hash
        if ($actual -eq $esperado) {
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
DEPLOY PENDIENTE: el servido no coincide con el local tras $Intentos intentos.
exit 1