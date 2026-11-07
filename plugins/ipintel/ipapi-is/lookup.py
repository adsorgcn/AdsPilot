#!/usr/bin/env python3
"""ipapi.is bulk IP lookup. Defaults to offline documentation addresses."""
import argparse
import http.client
import ipaddress
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

SAMPLE = Path(__file__).resolve().parents[3] / "tests/fixtures/ipapi-is.sample.json"


def addresses(request):
    if not isinstance(request, dict) or set(request) != {"ips"}:
        raise ValueError("expected an ips array")
    ips = request["ips"]
    if not isinstance(ips, list) or not 1 <= len(ips) <= 100:
        raise ValueError("expected 1..100 IP addresses")
    normalized = []
    for addr in ips:
        if not isinstance(addr, str) or "%" in addr:
            raise ValueError("expected an IPv4 or IPv6 literal")
        normalized.append(str(ipaddress.ip_address(addr)))
    return list(dict.fromkeys(normalized))


def rows(data, ips):
    if not isinstance(data, dict):
        raise ValueError("invalid API reply")
    result = []
    for addr in ips:
        entry = data.get(addr)
        if not isinstance(entry, dict) or entry.get("ip") != addr:
            raise ValueError("incomplete API reply")
        flags = {name: entry.get(name) for name in ("is_datacenter", "is_proxy")}
        location = entry.get("location")
        code = location.get("country_code") if isinstance(location, dict) else None
        if not isinstance(code, str) or not re.fullmatch("[A-Z]{2}", code) or any(type(flag) is not bool for flag in flags.values()):
            raise ValueError("missing flag or country")
        result.append(dict(ip=addr, country=code, **flags))
    return {"rows": result}


def fixture_lookup(ips):
    sample = json.loads(SAMPLE.read_text(encoding="utf-8"))
    return rows(sample, [ip for ip in ips if ip in sample])


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # The POST body contains the user's key and IPs.
        return None


def live_lookup(ips, key):
    payload = json.dumps({"ips": ips, "key": key}).encode("utf-8")
    req = urllib.request.Request("https://api.ipapi.is", data=payload,
                                 headers={"Content-Type": "application/json", "Accept": "application/json"})
    with urllib.request.build_opener(NoRedirect()).open(req, timeout=15) as response:
        body = response.read(8 * 1024 * 1024 + 1)
    if len(body) > 8 * 1024 * 1024:
        raise ValueError("oversized API reply")
    return rows(json.loads(body), ips)


def selftest():
    ips = addresses({"ips": ["192.0.2.23", "2001:db8::23", "192.0.2.23"]})
    result = fixture_lookup(ips)
    assert result == {"rows": [
        {"ip": ips[0], "country": "US", "is_datacenter": False, "is_proxy": False},
        {"ip": ips[1], "country": "CA", "is_datacenter": False, "is_proxy": True}]}
    assert fixture_lookup(["192.0.2.99"]) == {"rows": []}
    try:
        rows({ips[0]: {"ip": ips[0]}}, ips[:1])
    except ValueError:
        pass
    else:
        raise AssertionError("anonymous response accepted")
    return {"selftest": "ok", "rows": len(result["rows"]), "network": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()
    if args.selftest:
        print(json.dumps(selftest()))
        return 0
    try:
        request = json.loads(args.input.read_text(encoding="utf-8") if args.input else sys.stdin.read())
        ips = addresses(request)
    except (OSError, ValueError):
        print('{"error":"invalid input; expected 1..100 IP literals"}')
        return 4
    if args.apply:
        key = os.environ.get("IPAPI_IS_KEY")
        if not key:
            print('{"error":"missing IPAPI_IS_KEY"}')
            return 4
        if any(not ipaddress.ip_address(ip).is_global or ipaddress.ip_address(ip).is_multicast for ip in ips):
            print('{"error":"live lookup requires public unicast IP literals"}')
            return 4
        try:
            result = live_lookup(ips, key)
        except urllib.error.HTTPError as error:
            print(json.dumps({"error": "IP lookup HTTP failure", "status": error.code}))
            return 4 if error.code in (401, 403) else 3
        except (OSError, http.client.HTTPException, ValueError):
            print('{"error":"IP lookup failed or provider response incomplete"}')
            return 3
    else:
        result = fixture_lookup(ips)
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())
