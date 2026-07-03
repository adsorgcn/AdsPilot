#!/usr/bin/env python3
import sys, json, statistics

def load(path):
    f = sys.stdin if path == '-' else open(path, 'r')
    for line in f:
        line=line.strip()
        if not line: continue
        try:
            yield json.loads(line)
        except Exception:
            continue

def pctl(arr, p):
    if not arr: return 0
    arr = sorted(arr)
    k = int(round((p/100.0)*(len(arr)-1)))
    return arr[k]

def main():
    if len(sys.argv) < 2:
        print("usage: capacity-summarize.py <ndjson-file-or->", file=sys.stderr)
        sys.exit(2)
    path = sys.argv[1]
    slo = []
    qlen = []
    stats = []
    for rec in load(path):
        if 'slo' in rec and isinstance(rec['slo'], dict): slo.append(rec['slo'])
        b = rec.get('browser', {})
        if isinstance(b.get('queue'), dict):
            qlen.append(int(b['queue'].get('length', 0)))
        if isinstance(b.get('stats'), dict):
            stats.append(b['stats'])
    out = {}
    # Browser queue length summary
    out['browser_queue_len'] = {
        'avg': round(sum(qlen)/len(qlen),2) if qlen else 0,
        'p95': pctl(qlen, 95) if qlen else 0,
        'max': max(qlen) if qlen else 0,
        'samples': len(qlen),
    }
    # Extract service P95 from SLO snapshots when available
    # Expect shape: slo: { services: {adscenter: {p95_ms:...}, siterank:{...}, ... } }
    agg = {}
    for s in slo:
        services = s.get('services') or {}
        for name, m in services.items():
            p95 = m.get('p95_ms') or m.get('p95') or 0
            if p95:
                agg.setdefault(name, []).append(float(p95))
    out['service_p95_ms'] = {k: {'avg': round(sum(v)/len(v),1), 'p95_of_p95': round(pctl(v,95),1), 'samples': len(v)} for k,v in agg.items()}
    print(json.dumps(out, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()

