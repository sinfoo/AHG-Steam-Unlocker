# Test version comparison
def _compare_versions(v1, v2):
    try:
        def parse_version(v):
            parts = v.lstrip("v").split(".")
            return [int(p) for p in parts if p.isdigit()]
        v1_parts = parse_version(v1)
        v2_parts = parse_version(v2)
        max_len = max(len(v1_parts), len(v2_parts))
        v1_parts.extend([0] * (max_len - len(v1_parts)))
        v2_parts.extend([0] * (max_len - len(v2_parts)))
        return v1_parts > v2_parts
    except:
        return v1 > v2

# Test cases
tests = [
    ("0.4", "0.31", "v0.4 vs v0.31"),
    ("0.31", "0.4", "v0.31 vs v0.4"),
    ("1.0", "0.9", "v1.0 vs v0.9"),
    ("0.10", "0.9", "v0.10 vs v0.9"),
    ("0.4", "0.4", "v0.4 vs v0.4"),
]

for v1, v2, desc in tests:
    result = _compare_versions(v1, v2)
    print(f"{desc}: {v1} > {v2} = {result}")