$headers = @{
  'x-testing-mode'    = 'true'
  'x-force-period-date' = '2025-11-01'
  'x-force-period-type' = '1-15'
}

$response = Invoke-RestMethod -Method Post -Uri 'https://iam-sistema-de-gestion.vercel.app/api/calculator/period-closure/close-period' -Headers $headers -ContentType 'application/json'
$response | ConvertTo-Json -Depth 6 | Tee-Object -FilePath force_close_response.json
