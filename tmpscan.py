from pathlib import Path
s=Path(r'G:\kalypsis-desktop\src\Kalypsis.Desktop\ViewModels\DashboardViewModel.cs').read_text(encoding='utf8')
for i,l in enumerate(s.splitlines(),1):
 if i in [283,284,311]: print(i, [hex(ord(c)) for c in l if ord(c)>127])
