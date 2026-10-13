from pathlib import Path
import re
s=Path(r'G:\kalypsis-desktop\src\Kalypsis.Desktop\Views\DashboardView.xaml').read_text(encoding='utf8')
def f(m):
 x=m.group(0)
 if not any(ch in x for ch in 'ΞΟβ'): return x
 try:return x.encode('cp1253').decode('utf8')
 except:return x
d=re.sub(r'"[^"\r\n]*"',f,s)
x=d[d.find('Text='):d.find('Text=')+80]
print(repr(x)); print([hex(ord(c)) for c in x[:40]])
