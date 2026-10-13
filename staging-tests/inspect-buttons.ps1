Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::RootElement
$cond=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,'Ενεργοποίηση — Kalypsis Desktop')
$win=$root.FindFirst([System.Windows.Automation.TreeScope]::Children,$cond)
$buttons=$win.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)
foreach($x in $buttons){ if($x.Current.ControlType.ProgrammaticName -eq 'ControlType.Button'){ "$($x.Current.Name) enabled=$($x.Current.IsEnabled)"; $x.GetSupportedPatterns() | ForEach-Object { "  $($_.ProgrammaticName)" } } }
