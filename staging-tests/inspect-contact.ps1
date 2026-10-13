Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::RootElement
$wins=$root.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
foreach($x in $wins){ if($x.Current.Name -match 'Επικοινωνία'){ "WINDOW=$($x.Current.Name)"; $desc=$x.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition); foreach($d in $desc){ if($d.Current.ControlType.ProgrammaticName -eq 'ControlType.Button'){ $r=$d.Current.BoundingRectangle; "$($d.Current.Name) x=$($r.X) y=$($r.Y) w=$($r.Width)" } } } }
