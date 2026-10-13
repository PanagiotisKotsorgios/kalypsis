Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$sh=New-Object -ComObject WScript.Shell
$sh.AppActivate('Έλεγχος σύνδεσης — Kalypsis Desktop') | Out-Null
Start-Sleep -Milliseconds 250
$bounds=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp=New-Object System.Drawing.Bitmap($bounds.Width,$bounds.Height)
$g=[System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location,[System.Drawing.Point]::Empty,$bounds.Size)
$bmp.Save('E:\project\staging-tests\connection-wizard-final-20261012b.png',[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
