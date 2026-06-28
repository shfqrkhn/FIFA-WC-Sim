import hashlib, json, os, subprocess, sys

CORE_FILES=['docs/index.html','data/latest-update.json','data/update-health.json']
AUDIT_FILES=CORE_FILES+['data/prediction-audit.json','data/calibration-state.json']
CORE_CMDS=[[sys.executable,'scripts/apply_scoreboard.py','--no-fetch'],[sys.executable,'scripts/enrich_predictions.py'],[sys.executable,'scripts/enrich_rest_travel.py'],[sys.executable,'scripts/enrich_weather.py','--no-fetch'],[sys.executable,'scripts/enrich_data_quality.py'],[sys.executable,'scripts/update_health.py']]

def digest(p):
    return hashlib.sha256(open(p,'rb').read()).hexdigest() if os.path.exists(p) else None

def snap(files):
    return {p:digest(p) for p in files}

def read_base_data():
    html=open('docs/index.html',encoding='utf-8').read()
    marker='const BASE_DATA = '
    start=html.index(marker)+len(marker)
    end=html.index(';\nconst BLOCKED_PATCH_KEYS',start)
    return json.loads(html[start:end])

def snapshot_bytes(files):
    return {p:(open(p,'rb').read() if os.path.exists(p) else None) for p in files}

def restore_bytes(snapshot):
    for path,content in snapshot.items():
        if content is None:
            if os.path.exists(path): os.remove(path)
        else:
            os.makedirs(os.path.dirname(path),exist_ok=True)
            open(path,'wb').write(content)

def run(cmds):
    for c in cmds: subprocess.run(c,check=True)

if not os.path.exists('data/update-health.json'):
    run(CORE_CMDS)

before=snap(CORE_FILES); run(CORE_CMDS); after=snap(CORE_FILES); run(CORE_CMDS); final=snap(CORE_FILES)
if before!=after or after!=final:
    print('deterministic idempotence failed')
    print('before=',before)
    print('after=',after)
    print('final=',final)
    raise SystemExit(1)

data=read_base_data()
audit_now=data.get('generatedAt') or '2026-07-20T00:00:00Z'
NODE='node'
audit_cmds=[
    [sys.executable,'scripts/apply_scoreboard.py','--no-fetch'],
    [NODE,'scripts/freeze-predictions.mjs','--now',audit_now],
    [NODE,'scripts/score-predictions.mjs','--now',audit_now],
    [NODE,'scripts/update-calibration.mjs','--now',audit_now],
    [NODE,'scripts/validate-calibration.mjs']
]
saved=snapshot_bytes(AUDIT_FILES)
try:
    audit_before=snap(AUDIT_FILES); run(audit_cmds); audit_after=snap(AUDIT_FILES); run(audit_cmds); audit_final=snap(AUDIT_FILES)
finally:
    restore_bytes(saved)
if audit_before!=audit_after or audit_after!=audit_final:
    print('audit/calibration convergence failed')
    print('before=',audit_before)
    print('after=',audit_after)
    print('final=',audit_final)
    raise SystemExit(1)

print('deterministic idempotence passed')
