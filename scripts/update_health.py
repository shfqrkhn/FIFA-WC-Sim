import datetime, json, os

HTML_PATH='docs/index.html'
MARKER='const BASE_DATA = '
END=';\nconst BLOCKED_PATCH_KEYS'
html=open(HTML_PATH,encoding='utf-8').read()
s=html.index(MARKER)+len(MARKER); e=html.index(END,s); data=json.loads(html[s:e])
ms=[m for m in data.get('matches',[]) if m.get('stage')=='group']
todo=[m for m in ms if not m.get('played')]
w=data.get('weatherByMatch') if isinstance(data.get('weatherByMatch'),dict) else {}
failed_weather=[{'match':k,'error':v.get('error')} for k,v in w.items() if isinstance(v,dict) and v.get('error')]
latest={}
if os.path.exists('data/latest-update.json'):
    try: latest=json.load(open('data/latest-update.json',encoding='utf-8'))
    except Exception: latest={'error':'latest-update unreadable'}
health={
    'generatedAt':datetime.datetime.utcnow().replace(microsecond=0).isoformat()+'Z',
    'scoreboard':{'attempted':True,'appliedChanges':latest.get('appliedChanges',0),'fetchedFinals':latest.get('fetchedFinals',0),'changes':latest.get('changes',[])},
    'weather':{'attempted':True,'coveredUnplayedMatches':len([m for m in todo if str(m.get('no')) in w]),'totalUnplayedMatches':len(todo),'failedMatches':failed_weather},
    'dataQuality':data.get('dataQuality',{}),
    'principle':'Failed or missing sources degrade to neutral inputs unless validated data is available.'
}
os.makedirs('data',exist_ok=True)
old=None
if os.path.exists('data/update-health.json'):
    try:
        old=json.load(open('data/update-health.json',encoding='utf-8'))
        old={k:v for k,v in old.items() if k!='generatedAt'}
    except Exception: old=None
stable={k:v for k,v in health.items() if k!='generatedAt'}
if old!=stable:
    json.dump(health,open('data/update-health.json','w',encoding='utf-8'),indent=2)
    open('data/update-health.json','a',encoding='utf-8').write('\n')
    changed=True
else: changed=False
print(json.dumps({'updateHealthChanged':changed},indent=2))
