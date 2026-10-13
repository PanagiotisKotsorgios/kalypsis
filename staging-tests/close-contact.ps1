Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::RootElement
$wins=$root.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
foreach($w in $wins){ if($w.Current.Name -ne 'Ενεργοποίηση — Kalypsis Desktop'){ $all=$w.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition); foreach($x in $all){ if($x.Current.ControlType.ProgrammaticName -eq 'ControlType.Button' -and $x.Current.IsEnabled){$r=$x.Current.BoundingRectangle; if($r.X -gt 1000 -and $r.Y -gt 650){$x.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); break}} } } }
