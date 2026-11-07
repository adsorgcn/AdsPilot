#!/usr/bin/env python3
"""AdsPilot JSON interface. Use --list, [ID] --selftest, or ID [--input file]."""
import argparse
import json
import math
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile

from core.agent.interfaces import CATALOG, ROOT, read
from core.agent.interface_checks import check as check_boundaries
from core.agent.interface_runner import InterfaceError, dispatch, environment


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise InterfaceError("invalid command line")


def build_parser():
    p = Parser(description=__doc__)
    p.add_argument("interface", nargs="?")
    p.add_argument("--input")
    p.add_argument("--config")
    p.add_argument("--apply", action="store_true")
    p.add_argument("--list", action="store_true")
    p.add_argument("--selftest", action="store_true")
    return p


def selftest(rows):
    """Run actual interface calls against sample data in an isolated copy, never against the operator's ledger."""
    results = []
    with tempfile.TemporaryDirectory(prefix="adspilot-check-") as d:
        checkout = Path(d)/"repo"
        checkout.mkdir()
        for folder in ("core","plugins","schemas","soul","reference","tests","config"):
            source = ROOT/folder
            if folder == "config":
                (checkout/folder).mkdir()
                shutil.copy2(source/"adspilot.example.json",checkout/folder)
            else:
                shutil.copytree(source,checkout/folder,ignore=shutil.ignore_patterns("__pycache__","*.pyc",".env","*.db"))
        for filename in ("VERSION","CHANGELOG.md","adspilot.py"):
            shutil.copy2(ROOT/filename,checkout/filename)
        env = environment(False)
        for row in rows:
            if row["id"] in ("selfcheck.acceptance","judge.calibrate"):
                request = read(checkout/row["fixture"])
                days = 7 if row["id"] == "selfcheck.acceptance" else 1
                # Each call receives its own fixture, even when tested on its own.
                subprocess.run([sys.executable,str(checkout/"core/loop/daily.py"),"--simulate-days",str(days),
                                "--runs-dir",str(checkout/request["runs_dir"])],check=True,capture_output=True,
                               cwd=checkout,env=env,timeout=180)
            proc = subprocess.run([sys.executable,str(checkout/"adspilot.py"),row["id"],"--input",row["fixture"]],
                                  cwd=checkout,env=env,capture_output=True,encoding="utf-8",timeout=600)
            ok = proc.returncode == 0
            if ok:
                actual = json.loads(proc.stdout)
                expected = read(ROOT/"tests/fixtures/interfaces"/(row["id"]+".response.json"))
                # Compare stable discriminators. The full response is schema-checked by dispatch.
                if isinstance(expected,dict):
                    keys = {"type","dry_run","interface","action","valid","verdict","node","choice","mode","sub_id_param","run_id","rows","adjustments","proposal_only","days","thresholds","evidence","dates","runs_dir","fx","money_unit"}
                    if row["id"] == "loop.run":
                        keys.discard("evidence")
                    for key in keys.intersection(expected):
                        if key == "rows" and row["id"].startswith("ipintel."):
                            ok &= actual.get(key) == expected[key]
                        elif key == "rows" and isinstance(expected[key], list):
                            ok &= isinstance(actual.get(key), list) and len(actual[key]) == len(expected[key])
                        else:
                            ok &= actual.get(key) == expected[key]
                elif isinstance(expected,list):
                    ok = isinstance(actual,list) and len(actual)==len(expected)
            if ok and isinstance(actual,dict) and actual.get("dry_run") is True and row["script"].startswith("plugins/"):
                native = subprocess.run([sys.executable,str(checkout/row["script"]),"--selftest"],cwd=checkout,
                                        env=env,capture_output=True,timeout=60)
                ok = native.returncode == 0
            results.append({"interface":row["id"],"pass":bool(ok),"exit_code":proc.returncode})
        boundaries = check_boundaries(checkout) if len(rows)>1 else {}
    return {"interfaces":results,"passed":sum(item["pass"] for item in results),"total":len(results),
            "boundary_checks":boundaries}


def main(argv):
    args = build_parser().parse_args(argv)
    rows = read(CATALOG)
    if args.list:
        if args.interface or args.input or args.apply or args.selftest:
            raise InterfaceError("--list takes no action")
        return rows,0
    selected = [row for row in rows if row["id"]==args.interface]
    if args.interface and not selected:
        raise InterfaceError("unknown interface")
    if args.selftest:
        if args.apply or args.config or args.input:
            raise InterfaceError("--selftest uses its own offline fixture")
        result = selftest(selected or rows)
        return result, int(result["passed"] != result["total"] or not all(result["boundary_checks"].values()))
    if not selected:
        raise InterfaceError("specify an interface, --list, or --selftest")
    def pairs(items):
        result = {}
        for k, v in items:
            if k in result:
                raise InterfaceError("duplicate JSON field")
            result[k] = v
        return result

    def number(value):
        n = float(value)
        if not math.isfinite(n):
            raise InterfaceError("invalid JSON number")
        return n

    data = Path(args.input).read_text(encoding="utf-8") if args.input else sys.stdin.read()
    req = json.loads(data, object_pairs_hook=pairs, parse_float=number, parse_constant=number)
    if not isinstance(req,dict):
        raise InterfaceError("expected a JSON object")
    if args.config:
        req["config"]=args.config
    if args.apply:
        req["apply"]=True
    return dispatch(selected[0],req),0


if __name__ == "__main__":
    try:
        body, rc = main(sys.argv[1:])
    except InterfaceError as exc:
        rc = exc.code
        body = exc.body if exc.body is not None else {"error":str(exc),"exit_code":rc}
    except (ValueError, OSError, KeyError, TypeError, IndexError, AttributeError, RuntimeError, OverflowError, sqlite3.Error, subprocess.SubprocessError):
        rc = 1
        body = {"error":"invalid input or interface execution failed","exit_code":1}
    print(json.dumps(body,ensure_ascii=False,indent=2,allow_nan=False))
    sys.exit(rc)
