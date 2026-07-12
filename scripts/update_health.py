import datetime, json, os
from automation_utils import utc_stamp

HTML_PATH='docs/index.html'
MARKER='const BASE_DATA = '
END=';\nconst BLOCKED_PATCH_KEYS'

html=open(HTML_PATH,encoding='utf-8').read()
s=html.index(MARKER)+len(MARKER); e=html.index(END,s); data=json.loads(html[s:e])
ms=[m for m in data.get('matches',[]) if m.get('stage')=='group']
ko=data.get('knockout',[]) if isinstance(data.get('knockout'),list) else []
all_matches=ms+ko
todo=[m for m in all_matches if not m.get('played')]
played=[m for m in all_matches if m.get('played')]
played_group=[m for m in ms if m.get('played')]
played_ko=[m for m in ko if m.get('played')]
w=data.get('weatherByMatch') if isinstance(data.get('weatherByMatch'),dict) else {}
failed_weather=[{'match':k,'error':v.get('error')} for k,v in w.items() if isinstance(v,dict) and v.get('error')]
today=datetime.datetime.now(datetime.timezone.utc).date()
def match_day(m):
    raw=str(m.get('date') or '')
    try:
        return datetime.date.fromisoformat(raw[:10]) if raw else None
    except ValueError:
        return None
unplayed_days=[match_day(m) for m in todo]
unplayed_days=[d for d in unplayed_days if d]
overdue=[m for m in todo if (match_day(m) and match_day(m)<today)]
future_days=sorted(d for d in unplayed_days if d>=today)
stats=data.get('currentStats') if isinstance(data.get('currentStats'),dict) else {}
latest={}
if os.path.exists('data/latest-update.json'):
    try: latest=json.load(open('data/latest-update.json',encoding='utf-8'))
    except Exception: latest={'error':'latest-update unreadable'}
audit={'predictions':[]}
if os.path.exists('data/prediction-audit.json'):
    try: audit=json.load(open('data/prediction-audit.json',encoding='utf-8'))
    except Exception: audit={'error':'prediction-audit unreadable','predictions':[]}
calibration={}
if os.path.exists('data/calibration-state.json'):
    try: calibration=json.load(open('data/calibration-state.json',encoding='utf-8'))
    except Exception: calibration={'error':'calibration-state unreadable'}
backtest={}
if os.path.exists('data/backtest-audit.json'):
    try: backtest=json.load(open('data/backtest-audit.json',encoding='utf-8'))
    except Exception: backtest={'error':'backtest-audit unreadable'}
comparative={}
if os.path.exists('data/comparative-results.json'):
    try: comparative=json.load(open('data/comparative-results.json',encoding='utf-8'))
    except Exception: comparative={'error':'comparative-results unreadable'}
predictions=audit.get('predictions',[]) if isinstance(audit,dict) else []
settled=[p for p in predictions if isinstance(p,dict) and p.get('actual_result')]
health={
    'generatedAt':utc_stamp(),
    'scoreboard':{'playedMatches':len(played),'totalMatches':len(all_matches),'playedGroupMatches':len(played_group),'totalGroupMatches':len(ms),'playedKnockoutMatches':len(played_ko),'totalKnockoutMatches':len(ko),'overdueUnplayedMatches':len(overdue),'nextScheduledMatchDay':future_days[0].isoformat() if future_days else None,'currentStats':stats,'latestUpdate':latest},
    'weather':{'coveredUnplayedMatches':len([m for m in todo if str(m.get('no')) in w]),'totalUnplayedMatches':len(todo),'failedMatches':failed_weather},
    'predictionAudit':{'frozenPredictions':len(predictions),'settledPredictions':len(settled),'calibrationStatus':calibration.get('calibration_status'),'resolvedPredictions':calibration.get('resolved_predictions'),'minimumResolvedPredictions':calibration.get('min_resolved_predictions')},
    'backtestAudit':{'sampleStatus':backtest.get('sample_status'),'resolvedPredictions':backtest.get('resolved_predictions'),'rawModel':((backtest.get('overall') or {}).get('metrics') or {}).get('raw_model')},
    'comparativeResults':{'settledOnly':comparative.get('settled_only'),'denominators':comparative.get('denominators'),'outcomeAccuracy':((comparative.get('summary') or {}).get('outcome_accuracy'))},
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
