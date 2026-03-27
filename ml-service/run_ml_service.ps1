param(
  [switch]$Lite,
  [switch]$Install
)

$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

if ($Install) {
  if ($Lite) {
    Write-Host "Installing lite requirements (no TensorFlow / SentenceTransformers)..."
    pip install -r "requirements-lite.txt"
  } else {
    if (Test-Path "requirements.txt") {
      Write-Host "Installing full requirements..."
      pip install -r "requirements.txt"
    } else {
      Write-Host "requirements.txt not found; installing lite requirements instead..."
      pip install -r "requirements-lite.txt"
    }
  }
}

# IMPORTANT:
# Run the correct FastAPI app export: `app` is the FastAPI instance in `main.py`.
# This avoids the common `Could not import module "app"` error when using a wrong uvicorn target.
Write-Host "Starting ML service on http://127.0.0.1:8000 ..."
uvicorn main:app --reload --host 127.0.0.1 --port 8000

