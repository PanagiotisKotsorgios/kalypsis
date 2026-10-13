Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::RootElement
$wins=$root.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
foreach($x in $wins){ if([string]::IsNullOrWhiteSpace($x.Current.Name) -and $x.Current.ControlType.ProgrammaticName -eq 'ControlType.Window'){ "BLANK WINDOW"; $desc=$x.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition); foreach($d in $desc){ if(-not [string]::IsNullOrWhiteSpace($d.Current.Name)){ "$($d.Current.ControlType.ProgrammaticName) :: $($d.Current.Name)" } } } }
