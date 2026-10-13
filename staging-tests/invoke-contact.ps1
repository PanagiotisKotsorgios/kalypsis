Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::RootElement
$cond=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,'Ενεργοποίηση — Kalypsis Desktop')
$win=$root.FindFirst([System.Windows.Automation.TreeScope]::Children,$cond)
$buttons=$win.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
foreach($x in $buttons){ if($x.Current.ControlType.ProgrammaticName -eq 'ControlType.Button'){ $r=$x.Current.BoundingRectangle; if($x.Current.IsEnabled -and $r.X -lt 500 -and $r.Y -gt 500){ $x.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); 'INVOKED'; break } } }
