Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class WinApi { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd,int nCmdShow); }
"@
$p=Get-Process -Id 40268
$p.Refresh()
[WinApi]::ShowWindow($p.MainWindowHandle,9) | Out-Null
[WinApi]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 700
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$bounds=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp=New-Object System.Drawing.Bitmap($bounds.Width,$bounds.Height)
$g=[System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location,[System.Drawing.Point]::Empty,$bounds.Size)
$bmp.Save('E:\project\staging-tests\ui5-connection-20261012.png',[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
