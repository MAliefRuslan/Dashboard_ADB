$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false

function Convert-ToCsv($excelFile, $csvFile) {
    Write-Host "`n=== Converting $excelFile ==="
    $wb = $excel.Workbooks.Open($excelFile)
    $ws = $wb.Sheets.Item(1)
    $lastRow = $ws.UsedRange.Rows.Count
    Write-Host "Total Rows: $lastRow"
    
    $wb.SaveAs($csvFile, 6) # 6 = xlCSV
    Write-Host "Saved to $csvFile"
    $wb.Close($false)
}

Convert-ToCsv "D:\Dasrboard_ADB\Master_Data.xlsx" "D:\Dasrboard_ADB\data.csv"
Convert-ToCsv "D:\Dasrboard_ADB\Data_Pengeluaran.xlsx" "D:\Dasrboard_ADB\pengeluaran.csv"
Convert-ToCsv "D:\Dasrboard_ADB\Metode_Pembayaran.xlsx" "D:\Dasrboard_ADB\pembayaran.csv"

Write-Host "`nAll CSVs successfully updated!"
$excel.Quit()
[System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
