import hashlib, os, subprocess
files=['docs/index.html','data/latest-update.json']
cmds=[['python3','scripts/apply_scoreboard.py','--no-fetch'],['python3','scripts/enrich_predictions.py'],['python3','scripts/enrich_rest_travel.py'],['python3','scripts/enrich_weather_no_fetch.py']]
def digest(p):
    return hashlib.sha256(open(p,'rb').read()).hexdigest() if os.path.exists(p) else None
def snap():
    return {p:digest(p) for p in files}
for c in cmds: subprocess.run(c,check=True)
a=snap()
for c in cmds: subprocess.run(c,check=True)
b=snap()
if a!=b:
    print('deterministic idempotence failed')
    print(a)
    print(b)
    raise SystemExit(1)
print('deterministic idempotence passed')
