Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::RootElement
$wins=$root.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
foreach($x in $wins){ if($x.Current.Name -match 'Kalypsis|Έλεγχος|Κατάστασης|Ενεργοποίηση'){ "$($x.Current.Name) :: $($x.Current.ControlType.ProgrammaticName)" } }
