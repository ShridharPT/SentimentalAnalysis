# Moodmate Setup Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Moodmate - Personal Diary Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verify models directory exists
Write-Host "Verifying models directory..." -ForegroundColor Yellow
if (-not (Test-Path "models")) {
    New-Item -ItemType Directory -Path "models" -Force | Out-Null
    Write-Host "[OK] Models directory created" -ForegroundColor Green
} else {
    Write-Host "[OK] Models directory exists" -ForegroundColor Green
}

# Verify model files are present
Write-Host ""
Write-Host "Verifying model files..." -ForegroundColor Yellow

$files = @(
    "sentiment_model.pkl",
    "vectorizer.pkl",
    "label_mapping.pkl"
)

$allFilesPresent = $true
foreach ($file in $files) {
    $dest = "models\$file"
    
    if (Test-Path $dest) {
        Write-Host "[OK] Found: $file" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Missing: $file" -ForegroundColor Red
        $allFilesPresent = $false
    }
}

if (-not $allFilesPresent) {
    Write-Host ""
    Write-Host "[WARNING] Some model files are missing. Please ensure all model files are in the models/ directory." -ForegroundColor Yellow
}

# Install dependencies
Write-Host ""
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
pip install -r requirements.txt

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Run: python app.py" -ForegroundColor White
Write-Host "2. Open: http://localhost:5000" -ForegroundColor White
Write-Host ""
