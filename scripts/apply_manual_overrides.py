import copy
import json
import os
import sys

from automation_utils import utc_stamp


HTML_PATH = os.environ.get('FIFA_WC_HTML_PATH', 'docs/index.html')
DEFAULT_OVERRIDE_PATH = os.environ.get('FIFA_WC_MANUAL_OVERRIDES', 'data/manual-overrides.json')
MARKER = 'const BASE_DATA = '
END_MARKER = ';\nconst BLOCKED_PATCH_KEYS'
BLOCKED_KEYS = {'__proto__', 'prototype', 'constructor'}
TEAM_KEYS = {'injuryPenalty', 'suspensionPenalty', 'fairPlay', 'sourceNote'}
MATCH_KEYS = {'availability', 'lineups', 'context', 'discipline', 'sourceNote', 'note'}
CURRENT_STATS_KEYS = {
    'source', 'sourceUrl', 'url', 'updatedTo', 'lastUpdated',
    'topScorers', 'topScorersSource',
    'conductScores', 'thirdPlaceTableSource',
}
SIDE_KEYS = {'A', 'B'}
AVAILABILITY_KEYS = {
    'status', 'sourceTier', 'sourceStatus', 'tier', 'source', 'sourceUrl', 'url', 'note',
    'keyAbsences', 'confirmedKeyAbsences', 'confirmedSuspensions', 'suspensions',
    'keeperDowngrade', 'rotationRisk'
}
CONTEXT_KEYS = {'goalAdj', 'note', 'source', 'sourceUrl', 'url'}
TRUSTED_STATUS_MARKERS = ('manual_verified', 'official', 'verified', 'team-confirmed', 'federation')


def override_path():
    args = sys.argv[1:]
    if '--file' in args:
        i = args.index('--file')
        if i + 1 >= len(args):
            raise SystemExit('--file requires a path')
        return args[i + 1]
    positional = [arg for arg in args if not arg.startswith('--')]
    return positional[0] if positional else DEFAULT_OVERRIDE_PATH


def load_base_data():
    html = open(HTML_PATH, encoding='utf-8').read()
    start = html.index(MARKER) + len(MARKER)
    end = html.index(END_MARKER, start)
    return html, start, end, json.loads(html[start:end])


def save_base_data(html, start, end, data):
    payload = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    open(HTML_PATH, 'w', encoding='utf-8').write(html[:start] + payload + html[end:])


def reject_blocked_keys(value, path='override'):
    if isinstance(value, dict):
        for key, child in value.items():
            if key in BLOCKED_KEYS:
                raise ValueError(f'blocked key at {path}.{key}')
            reject_blocked_keys(child, f'{path}.{key}')
    elif isinstance(value, list):
        for i, child in enumerate(value):
            reject_blocked_keys(child, f'{path}[{i}]')


def load_overrides(path):
    if not os.path.exists(path):
        return None
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    if not isinstance(data, dict) or data.get('schema') != 1:
        raise ValueError('manual override file must be an object with schema: 1')
    reject_blocked_keys(data)
    return data


def has_source(row):
    if not isinstance(row, dict):
        return False
    return bool(row.get('source') or row.get('sourceUrl') or row.get('url'))


def has_trusted_status(row):
    value = str(row.get('sourceTier') or row.get('tier') or row.get('sourceStatus') or row.get('status') or '').lower()
    if any(bad in value for bad in ('unverified', 'unknown', 'rumor', 'rumour', 'missing', 'neutral')):
        return False
    return any(marker in value for marker in TRUSTED_STATUS_MARKERS)


def require_source(row, label):
    if not has_source(row):
        raise ValueError(f'{label} override requires source, sourceUrl, or url')


def stats_source(row, field):
    if has_source(row):
        return True
    source_key = 'topScorersSource' if field == 'topScorers' else 'thirdPlaceTableSource'
    source = str(row.get(source_key) or '')
    if not source or 'not refreshed' in source.lower() or 'example only' in source.lower():
        return False
    return True


def number(value, label, lo, hi):
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        raise ValueError(f'{label} must be numeric')
    if parsed < lo or parsed > hi:
        raise ValueError(f'{label} must be between {lo} and {hi}')
    return round(parsed, 3)


def side_object(value, allowed, label):
    if not isinstance(value, dict):
        raise ValueError(f'{label} must be an object')
    out = {}
    for key, child in value.items():
        if key not in SIDE_KEYS:
            raise ValueError(f'{label} has unsupported side {key}')
        if not isinstance(child, dict):
            raise ValueError(f'{label}.{key} must be an object')
        filtered = {}
        for child_key, child_value in child.items():
            if child_key not in allowed:
                raise ValueError(f'{label}.{key}.{child_key} is not supported')
            filtered[child_key] = child_value
        out[key] = filtered
    return out


def validate_availability(value):
    out = side_object(value, AVAILABILITY_KEYS, 'availability')
    for side, row in out.items():
        if not has_source(row):
            raise ValueError(f'availability.{side} requires source metadata')
        if not has_trusted_status(row):
            raise ValueError(f'availability.{side} requires official, verified, team-confirmed, federation, or manual_verified status')
        for key in ('keyAbsences', 'confirmedKeyAbsences', 'confirmedSuspensions', 'suspensions', 'keeperDowngrade', 'rotationRisk'):
            if key in row:
                row[key] = number(row[key], f'availability.{side}.{key}', 0, 8)
    return out


def validate_context(value):
    out = side_object(value, CONTEXT_KEYS, 'context')
    for side, row in out.items():
        if 'goalAdj' in row:
            require_source(row, f'context.{side}')
            row['goalAdj'] = number(row['goalAdj'], f'context.{side}.goalAdj', -0.22, 0.22)
    return out


def validate_top_scorers(value, parent):
    if not isinstance(value, list):
        raise ValueError('currentStats.topScorers must be a list')
    if value and not stats_source(parent, 'topScorers'):
        raise ValueError('currentStats.topScorers requires source metadata or topScorersSource')
    out = []
    for i, row in enumerate(value):
        if not isinstance(row, dict):
            raise ValueError(f'currentStats.topScorers[{i}] must be an object')
        allowed = {'player', 'team', 'goals', 'source', 'sourceUrl', 'url', 'note'}
        extra = set(row) - allowed
        if extra:
            raise ValueError(f'currentStats.topScorers[{i}] unsupported keys: {", ".join(sorted(extra))}')
        if not row.get('player') or not row.get('team'):
            raise ValueError(f'currentStats.topScorers[{i}] requires player and team')
        next_row = dict(row)
        next_row['goals'] = int(number(row.get('goals'), f'currentStats.topScorers[{i}].goals', 0, 99))
        out.append(next_row)
    return out


def validate_conduct_scores(value, parent):
    if not isinstance(value, list):
        raise ValueError('currentStats.conductScores must be a list')
    if value and not stats_source(parent, 'conductScores'):
        raise ValueError('currentStats.conductScores requires source metadata or thirdPlaceTableSource')
    out = []
    for i, row in enumerate(value):
        if not isinstance(row, dict):
            raise ValueError(f'currentStats.conductScores[{i}] must be an object')
        allowed = {'team', 'score', 'source', 'sourceUrl', 'url', 'note'}
        extra = set(row) - allowed
        if extra:
            raise ValueError(f'currentStats.conductScores[{i}] unsupported keys: {", ".join(sorted(extra))}')
        if not row.get('team'):
            raise ValueError(f'currentStats.conductScores[{i}] requires team')
        next_row = dict(row)
        next_row['score'] = number(row.get('score'), f'currentStats.conductScores[{i}].score', -100, 100)
        out.append(next_row)
    return out


def merge_dict(base, patch):
    current = copy.deepcopy(base) if isinstance(base, dict) else {}
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(current.get(key), dict):
            current[key] = merge_dict(current[key], value)
        else:
            current[key] = copy.deepcopy(value)
    return current


def upsert_source(data, source):
    if not isinstance(source, dict) or not source.get('name'):
        raise ValueError('sources entries require a name')
    sources = data.get('sources')
    if not isinstance(sources, list):
        sources = []
    for i, row in enumerate(sources):
        if isinstance(row, dict) and row.get('name') == source.get('name'):
            sources[i] = dict(row, **source)
            data['sources'] = sources
            return True
    sources.append(source)
    data['sources'] = sources
    return True


def apply_team_override(data, row):
    if not isinstance(row, dict):
        raise ValueError('team override must be an object')
    require_source(row, 'team')
    team_id = row.get('id')
    name = row.get('name')
    team = next((t for t in data.get('teams', []) if (team_id and t.get('id') == team_id) or (name and t.get('name') == name)), None)
    if not team:
        raise ValueError(f'team override target not found: {team_id or name}')
    changed = False
    for key, value in row.items():
        if key in {'id', 'name', 'source', 'sourceUrl', 'url'}:
            continue
        if key not in TEAM_KEYS:
            raise ValueError(f'team override key not supported: {key}')
        next_value = value
        if key in {'injuryPenalty', 'suspensionPenalty'}:
            next_value = number(value, key, 0, 40)
        elif key == 'fairPlay':
            next_value = number(value, key, -100, 100)
        if team.get(key) != next_value:
            team[key] = next_value
            changed = True
    return changed


def apply_match_override(data, row):
    if not isinstance(row, dict):
        raise ValueError('match override must be an object')
    require_source(row, 'match')
    no = row.get('no')
    if not isinstance(no, int):
        raise ValueError('match override requires integer no')
    rows = list(data.get('matches') or []) + list(data.get('knockout') or [])
    match = next((m for m in rows if m.get('no') == no), None)
    if not match:
        raise ValueError(f'match override target not found: {no}')
    changed = False
    for key, value in row.items():
        if key in {'no', 'source', 'sourceUrl', 'url'}:
            continue
        if key not in MATCH_KEYS:
            raise ValueError(f'match override key not supported: {key}')
        next_value = value
        if key in {'availability', 'lineups'}:
            next_value = validate_availability(value)
            next_value = merge_dict(match.get(key), next_value)
        elif key == 'context':
            next_value = validate_context(value)
            next_value = merge_dict(match.get(key), next_value)
        if match.get(key) != next_value:
            match[key] = next_value
            changed = True
    return changed


def apply_current_stats_override(data, row):
    if not isinstance(row, dict):
        raise ValueError('currentStats override must be an object')
    for key in row:
        if key not in CURRENT_STATS_KEYS:
            raise ValueError(f'currentStats override key not supported: {key}')
    current = data.get('currentStats')
    if not isinstance(current, dict):
        current = {}
        data['currentStats'] = current
    patch = {}
    for key, value in row.items():
        if key == 'topScorers':
            patch[key] = validate_top_scorers(value, row)
        elif key == 'conductScores':
            patch[key] = validate_conduct_scores(value, row)
        else:
            patch[key] = value
    before = json.dumps(current, sort_keys=True)
    current.update(copy.deepcopy(patch))
    return before != json.dumps(current, sort_keys=True)


def apply_overrides(data, overrides):
    changed = False
    for source in overrides.get('sources') or []:
        changed = upsert_source(data, source) or changed
    for row in overrides.get('teams') or []:
        changed = apply_team_override(data, row) or changed
    for row in overrides.get('matches') or []:
        changed = apply_match_override(data, row) or changed
    if overrides.get('currentStats'):
        changed = apply_current_stats_override(data, overrides.get('currentStats')) or changed
    maintenance = data.setdefault('maintenance', {})
    if overrides.get('notes'):
        notes = maintenance.get('manualOverrideNotes')
        if not isinstance(notes, list):
            notes = []
        note = {'note': overrides.get('notes')}
        if overrides.get('updatedAt'):
            note['updatedAt'] = overrides.get('updatedAt')
        if note not in notes:
            notes.append(note)
            maintenance['manualOverrideNotes'] = notes
            changed = True
    return changed


def main():
    path = override_path()
    overrides = load_overrides(path)
    if overrides is None:
        print(json.dumps({'manualOverrides': 'absent', 'path': path, 'changed': False}, indent=2))
        return 0
    html, start, end, data = load_base_data()
    before = json.dumps(data, sort_keys=True)
    changed = apply_overrides(data, overrides) and before != json.dumps(data, sort_keys=True)
    if changed:
        data['generatedAt'] = utc_stamp()
        save_base_data(html, start, end, data)
    print(json.dumps({'manualOverrides': 'applied', 'path': path, 'changed': changed}, indent=2))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({'manualOverrides': 'failed', 'error': str(exc)}, indent=2), file=sys.stderr)
        raise SystemExit(1)
