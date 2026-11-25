# Run de Agent Manager: levanta el laboratorio local WP+Woo (C:\wp-lab).
# Si el lab no existe, solo avisa (no falla).
$ErrorActionPreference = 'Stop'
$lab = 'C:\wp-lab\arrancar.ps1'
if (Test-Path $lab) {
  Write-Host "== Arrancando laboratorio WP+Woo =="
  & $lab
} else {
  Write-Host "No se encontro C:\wp-lab\arrancar.ps1 (laboratorio no instalado)."
}