$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

$path = "D:\Dasrboard_ADB\BOM MENU.xlsx"
$outPath = "D:\Dasrboard_ADB\bom.csv"

Write-Host "`n=== Converting BOM MENU.xlsx ==="
$wb = $excel.Workbooks.Open($path)
$ws = $wb.Sheets.Item(1)
$rows = $ws.UsedRange.Rows.Count

$outCsv = @()
$currentMenu = ""

for ($r = 1; $r -le $rows; $r++) {
    $col1 = $ws.Cells.Item($r, 1).Text
    $col3 = $ws.Cells.Item($r, 3).Text
    
    if ($col1 -match "Standart Recipe") {
        $currentMenu = $col3.Trim()
    }
    elseif ($currentMenu -ne "" -and $ws.Cells.Item($r, 2).Text -ne "" -and $ws.Cells.Item($r, 2).Text -ne "Ingredient") {
        $ingredient = $ws.Cells.Item($r, 2).Text.Trim()
        $qty = $ws.Cells.Item($r, 3).Text.Trim()
        $unit = $ws.Cells.Item($r, 4).Text.Trim()
        
        if ($qty -ne "" -and $qty -ne "QTY") {
            $obj = New-Object PSObject -Property @{
                Menu = $currentMenu
                Ingredient = $ingredient
                Qty = $qty
                Unit = $unit
            }
            $outCsv += $obj
        }
    }
}

$outCsv | Select-Object Menu, Ingredient, Qty, Unit | Export-Csv -Path $outPath -NoTypeInformation -Encoding UTF8

$wb.Close($false)
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null

Write-Host "BOM converted successfully to $outPath with $($outCsv.Count) ingredients."
