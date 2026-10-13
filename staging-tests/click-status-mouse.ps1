Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class NativeMouse {
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int X,int Y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint dx,uint dy,uint data,UIntPtr extra);
 public const uint LEFTDOWN=0x0002, LEFTUP=0x0004;
}
"@
$root=[System.Windows.Automation.AutomationElement]::RootElement
$cond=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,'Ενεργοποίηση — Kalypsis Desktop')
$win=$root.FindFirst([System.Windows.Automation.TreeScope]::Children,$cond)
$buttons=$win.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
$btn=$buttons | Where-Object { $_.Current.ControlType.ProgrammaticName -eq 'ControlType.Button' -and $_.Current.BoundingRectangle.X -gt 400 -and $_.Current.BoundingRectangle.Y -gt 500 -and $_.Current.BoundingRectangle.Y -lt 650 } | Select-Object -First 1
$r=$btn.Current.BoundingRectangle
[NativeMouse]::SetCursorPos([int]($r.X+$r.Width/2),[int]($r.Y+$r.Height/2)) | Out-Null
[NativeMouse]::mouse_event([NativeMouse]::LEFTDOWN,0,0,0,[UIntPtr]::Zero)
Start-Sleep -Milliseconds 80
[NativeMouse]::mouse_event([NativeMouse]::LEFTUP,0,0,0,[UIntPtr]::Zero)
