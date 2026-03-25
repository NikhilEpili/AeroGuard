from pathlib import Path
text = Path('frontend/src/components/SafeRouteNavigator.jsx').read_text(encoding='utf-8').splitlines()
stack=[]
for i,line in enumerate(text,1):
    idx=0
    while True:
        oi=line.find('<div', idx); ci=line.find('</div>', idx)
        if oi==-1 and ci==-1:
            break
        if oi!=-1 and (ci==-1 or oi<ci):
            stack.append(('div',i)); idx=oi+4
        else:
            if stack:
                stack.pop()
            else:
                print('unmatched close at', i)
            idx=ci+6
print('stack len', len(stack))
if stack:
    for tag,line_no in stack[-20:]:
        print('pending', tag, 'from', line_no)
