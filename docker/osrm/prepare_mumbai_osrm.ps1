param(
    [string]$DataDir = "./docker/osrm/data"
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
$AbsDataDir = (Resolve-Path $DataDir).Path

Write-Host "[1/4] Downloading Mumbai OSM extract..."
if (-not (Test-Path "$AbsDataDir\mumbai-latest.osm.pbf")) {
    Invoke-WebRequest -Uri "https://download.openstreetmap.fr/extracts/asia/india/maharashtra.osm.pbf" -OutFile "$AbsDataDir\mumbai-latest.osm.pbf.tmp"
    Move-Item -Force "$AbsDataDir\mumbai-latest.osm.pbf.tmp" "$AbsDataDir\mumbai-latest.osm.pbf"
}

Write-Host "[2/4] Running osrm-extract with car profile..."
docker run --rm -t -v "${AbsDataDir}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/mumbai-latest.osm.pbf

Write-Host "[3/4] Running CH contraction preprocessing..."
docker run --rm -t -v "${AbsDataDir}:/data" osrm/osrm-backend osrm-contract /data/mumbai-latest.osrm

Write-Host "[4/4] Done. Start server with:"
Write-Host "docker run --rm -t -i -p 5000:5000 -v \"${AbsDataDir}:/data\" osrm/osrm-backend osrm-routed --algorithm ch /data/mumbai-latest.osrm"
