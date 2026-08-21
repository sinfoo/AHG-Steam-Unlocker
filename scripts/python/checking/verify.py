from _path_utils import data_path
import json

with open(rdata_path('dist-electron\win-unpacked\resources\fixes.json'), 'r') as f:
    fixes = json.load(f)

onlinemap = [f for f in fixes if f.get('source') == 'online-fix.me']
ryuu = [f for f in fixes if f.get('source') == 'ryuu.lol']

print('=== FINAL FIXES ===')
print('Total:', len(fixes))
print('online-fix.me:', len(onlinemap))
print('ryuu.lol:', len(ryuu))

target_met = len(fixes) >= 3104
print('Target (3104):', 'YES!' if target_met else 'NO')