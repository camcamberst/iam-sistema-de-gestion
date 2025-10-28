# Script de validacion de modales para Windows PowerShell
# Ejecutar con: .\scripts\validate-modals.ps1

Write-Host "Validando estandar de modales..." -ForegroundColor Cyan

# Buscar modales manuales con 'fixed inset-0' (excluyendo StandardModal y ThemeTransition)
$manualModals = Get-ChildItem -Recurse -Include "*.tsx", "*.ts", "*.jsx", "*.js" | 
    Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*components/ui/StandardModal.tsx*" -and $_.FullName -notlike "*components/ThemeTransition.tsx*" } |
    Select-String "fixed inset-0"

if ($manualModals) {
    Write-Host "ERROR: Se encontraron modales manuales que no siguen el estandar:" -ForegroundColor Red
    $manualModals | ForEach-Object { Write-Host "  $($_.Filename):$($_.LineNumber) - $($_.Line.Trim())" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "SOLUCION: Usa el componente StandardModal desde 'components/ui/StandardModal'" -ForegroundColor Green
    Write-Host "DOCUMENTACION: Ver UI_STANDARD_MODALS.md" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Para ignorar temporalmente este check (NO RECOMENDADO):" -ForegroundColor Magenta
    Write-Host "git commit --no-verify -m 'tu mensaje'" -ForegroundColor Magenta
    exit 1
}

# Buscar z-index altos que podrian ser modales
$highZIndex = Get-ChildItem -Recurse -Include "*.tsx", "*.ts", "*.jsx", "*.js" | 
    Where-Object { $_.FullName -notlike "*node_modules*" -and $_.FullName -notlike "*components/ui/StandardModal.tsx*" } |
    Select-String "z-50|z-\[9[0-9]\]|z-\[1[0-9][0-9]\]"

if ($highZIndex) {
    Write-Host "ADVERTENCIA: Se encontraron z-index altos que podrian ser modales:" -ForegroundColor Yellow
    $highZIndex | ForEach-Object { Write-Host "  $($_.Filename):$($_.LineNumber) - $($_.Line.Trim())" -ForegroundColor Yellow }
    Write-Host ""
    Write-Host "RECOMENDACION: Verifica si estos elementos deberian usar StandardModal" -ForegroundColor Green
    Write-Host ""
}

Write-Host "Validacion de modales completada" -ForegroundColor Green
exit 0