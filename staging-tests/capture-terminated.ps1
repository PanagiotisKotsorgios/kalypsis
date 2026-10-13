Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$sh = New-Object -ComObject WScript.Shell
$sh.AppActivate('Ενεργοποίηση — Kalypsis Desktop') | Out-Null
Start-Sleep -Milliseconds 400
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bmp.Save('E:\project\staging-tests\ui-terminated-license-20261012.png', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
