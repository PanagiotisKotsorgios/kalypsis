Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::RootElement
$cond=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,'Ενεργοποίηση — Kalypsis Desktop')
$win=$root.FindFirst([System.Windows.Automation.TreeScope]::Children,$cond)
if($null -eq $win){'WINDOW_NOT_FOUND'; exit 2}
$btnCond=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty,'Έλεγχος κατάστασης')
$btn=$win.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$btnCond)
if($null -eq $btn){'BUTTON_NOT_FOUND'; exit 3}
$pattern=$btn.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
$pattern.Invoke()
'CLICKED'
