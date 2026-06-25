import hashlib, os, subprocess, sys

FILES = ['docs/index.html', 'data/latest-update.json']
PIPELINE = [
    ['python3', 'scripts/apply_scoreboard.py'],
    ['python3', 'scripts/enrich_predictions.py'],
    ['python3', 'scripts/enrich_rest_travel.py'],
    ['python3', 'scripts/enrich_weather.py'],
    ['python3', 'scripts/enrich_data_quality.py'],
]

def digest(path):
    if not os.path.exists(path): return None
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()

def snapshot():
    return {p: digest(p) for p in FILES}

def run(cmd):
    subprocess.run(cmd, check=True)

for cmd in PIPELINE:
    run(cmd)
first = snapshot()
for cmd in PIPELINE:
    run(cmd)
second = snapshot()
if first != second:
    print('IDEMPOTENCE FAILED')
    print('first=', first)
    print('second=', second)
    raise SystemExit(1)
print('Idempotence passed.')
