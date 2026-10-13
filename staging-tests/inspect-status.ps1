Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::RootElement
$cond=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,'Ενεργοποίηση — Kalypsis Desktop')
$win=$root.FindFirst([System.Windows.Automation.TreeScope]::Children,$cond)
$btnCond=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,'Έλεγχος κατάστασης')
$btn=$win.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$btnCond)
$btn.Current.ControlType.ProgrammaticName
$btn.Current.IsEnabled
$btn.GetSupportedPatterns() | ForEach-Object { $_.ProgrammaticName }
