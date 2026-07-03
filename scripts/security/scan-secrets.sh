#!/usr/bin/env bash
# AdsPilot secret scanner — blocks credentials from entering git.
# Zero external deps (bash + python3). Two modes:
#   scan-staged   scans files staged for commit (used by the pre-commit hook)
#   scan-tree     scans all tracked files (manual audit: bash scripts/security/scan-secrets.sh scan-tree)
# Exit 0 = clean, 1 = secrets found. Designed to be self-safe: contains no
# literal secrets, only patterns.

set -euo pipefail
MODE="${1:-scan-staged}"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

# Files we never scan (examples/templates are allowed to show fake shapes).
is_excluded() {
  case "$1" in
    *.example|*.template|*.example.*|*.md|*node_modules/*|*.next/*|*/dist/*|*/build/*) return 0 ;;
    *) return 1 ;;
  esac
}

# Collect target file list per mode.
collect() {
  if [ "$MODE" = "scan-staged" ]; then
    git diff --cached --name-only --diff-filter=ACM
  elif [ "$MODE" = "scan-tree" ]; then
    git ls-files
  else
    echo "usage: $0 [scan-staged|scan-tree]" >&2; exit 2
  fi
}

# The detector runs in python3 for reliable regex + JWT role decoding.
scan_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  is_excluded "$f" && return 0
  python3 - "$f" <<'PY'
import sys, re, base64, json

path = sys.argv[1]
try:
    with open(path, 'r', errors='replace') as fh:
        text = fh.read()
except Exception:
    sys.exit(0)

findings = []

# Allowlist substrings: a match on the same line is treated as a placeholder.
ALLOW = ('process.env', 'os.getenv', 'os.environ', 'getEnv(', '${', 'your-', 'your_',
         'example', 'placeholder', 'REPLACE', 'changeme', 'dummy', '<YOUR', 'xxxxx',
         'REDACTED', 'FAKE', 'sample')

def line_allowed(line):
    return any(a in line for a in ALLOW)

# High-signal patterns. Name -> compiled regex.
PATTERNS = {
    'JWT (HS256, may be Supabase anon/service_role)':
        re.compile(r'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}'),
    'Generic JWT':
        re.compile(r'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'),
    'Google API key':      re.compile(r'AIza[0-9A-Za-z_-]{35}'),
    'Google OAuth token':  re.compile(r'ya29\.[0-9A-Za-z_-]{20,}'),
    'Google OAuth refresh':re.compile(r'\b1//[0-9A-Za-z_-]{30,}'),
    'Google OAuth secret': re.compile(r'GOCSPX-[0-9A-Za-z_-]{20,}'),
    'GitHub PAT':          re.compile(r'\bghp_[A-Za-z0-9]{36}\b'),
    'GitHub fine PAT':     re.compile(r'\bgithub_pat_[A-Za-z0-9_]{22,}'),
    'OpenAI key':          re.compile(r'\bsk-[A-Za-z0-9_-]{20,}'),
    'Anthropic key':       re.compile(r'\bsk-ant-[A-Za-z0-9_-]{20,}'),
    'Slack token':         re.compile(r'\bxox[baprs]-[A-Za-z0-9-]{10,}'),
    'Private key block':   re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----'),
    'DB URL with password':re.compile(r'\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis)://[^\s:/@]+:[^\s@]{6,}@'),
}

def jwt_role(tok):
    try:
        payload = tok.split('.')[1]
        payload += '=' * ((4 - len(payload) % 4) % 4)
        d = json.loads(base64.urlsafe_b64decode(payload))
        return d.get('role'), d.get('ref')
    except Exception:
        return None, None

for i, line in enumerate(text.splitlines(), 1):
    if line_allowed(line):
        continue
    for name, rx in PATTERNS.items():
        m = rx.search(line)
        if not m:
            continue
        token = m.group(0)
        detail = name
        if token.startswith('eyJ'):
            role, ref = jwt_role(token)
            if role:
                detail = f'{name} [role={role}, ref={ref}]'
                if role == 'service_role':
                    detail = 'CRITICAL service_role key (full RLS bypass) ' + detail
        # DB URLs: skip benign forms — local defaults, literal placeholders,
        # URL-encoded socket paths (%2F...), template vars, and sentinel strings.
        if 'URL with password' in name:
            if re.search(r':(password|pass|changeme|user|xxxx+|devpassword|postgres|root|admin|secret)@', line, re.I):
                continue
            if re.search(r':(PASSWORD|USER|PASS|\$\{|\{[a-z_]+\}|%2[45Ff]|%28)', line):
                continue
            if re.search(r'@(localhost|127\.0\.0\.1|db|postgres|mysql|redis|host)[:/@]', line):
                continue
        findings.append((i, detail, token[:24] + ('…' if len(token) > 24 else '')))
        break  # one finding per line is enough

if findings:
    print(f'\n  ✗ {path}')
    for ln, detail, snip in findings:
        print(f'      line {ln}: {detail}\n                 └─ {snip}')
    sys.exit(1)
sys.exit(0)
PY
}

echo "🔒 secret scan (${MODE})…"
FOUND=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if ! scan_file "$f"; then
    FOUND=1
  fi
done < <(collect)

if [ "$FOUND" -ne 0 ]; then
  cat >&2 <<'MSG'

🚫 Commit blocked: credentials detected in staged changes.

  Replace the value with an environment variable, e.g.:
      const key = process.env.SUPABASE_SERVICE_KEY;
  Put the real value in .env (already gitignored), never in tracked files.

  If this is a genuine false positive, bypass with:  git commit --no-verify
  (Use sparingly. A real service_role key in public history requires rotation,
   not just removal — removing it from HEAD does not revoke it.)
MSG
  exit 1
fi

echo "✅ clean — no credentials found"
exit 0
