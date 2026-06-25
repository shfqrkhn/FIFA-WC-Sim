import subprocess
subprocess.run(['python3','scripts/apply_scoreboard.py','--no-fetch'],check=True)
subprocess.run(['python3','scripts/enrich_predictions.py'],check=True)
subprocess.run(['python3','scripts/enrich_rest_travel.py'],check=True)
subprocess.run(['python3','scripts/enrich_weather_no_fetch.py'],check=True)
print('deterministic update smoke passed')
