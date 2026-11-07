"""Boundary regressions run only inside the disposable interface selftest checkout."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def check(checkout):
    results = {}
    config = json.loads((checkout/"config/adspilot.example.json").read_text(encoding="utf-8"))
    config.update(apply=True)
    cp = checkout/"config/interface-test.json"
    cp.write_text(json.dumps(config),encoding="utf-8")
    relative = cp.relative_to(checkout).as_posix()

    def call(name, interface, request, rc, assertion=None, extra_env=None):
        child = subprocess.run([sys.executable,str(checkout/"adspilot.py"),interface],
                               input=json.dumps(request),capture_output=True,encoding="utf-8",
                               env=dict(os.environ, **(extra_env or {})),timeout=40,cwd=checkout)
        output=json.loads(child.stdout)
        results[name] = child.returncode == rc and (assertion(output) if assertion else True)
        return output

    call("apply needs local consent","deploy.cloudflare.publish",{"site":True,"apply":True},4)
    call("local consent alone stays dry","deploy.cloudflare.publish",{"site":True,"config":relative},0,
         lambda r:r["dry_run"] is True)
    call("unexpected flag rejected","traffic.google-ads.deploy",{"remove_campaign":"--apply"},1)
    call("traversal rejected","selfcheck.validate",{"schema":"../VERSION","document":{}},1)
    call("private output escape rejected","traffic.google-ads.convert",
         {"conversions":{"type":"adspilot.conversions","rows":[]},"output_file":"../outside.csv"},1)
    call("credential in ordinary field rejected","affiliate.cj.link",
         {"base":"https://example.com/"+ "test-canary-abc","token":"SAMPLE00001"},1,
         lambda r:"test-canary-abc" not in str(r),{"CJ_ACCESS_TOKEN":"test-canary-abc"})
    call("tracking query rejected","affiliate.cj.link",
         {"base":"https://example.com/item?gc"+"lid=sample-only","token":"SAMPLE00001"},1)
    call("ledger export URL pinned","ledger.subid",{"operation":"pull","url":"https://example.invalid", "apply":True,"config":relative},4)
    for op in ("mint","stats"):
        call("subid "+op,"ledger.subid",{"operation":op},0)
    def local(name, params, expected=0, assertion=None):
        return call(name,"ledger.subid",dict(params,apply=True,config=relative),expected,assertion)
    token="SAMPLE00008"
    local("subid record",{"operation":"record","token":token,"campaign":"sample"})
    local("subid lookup",{"operation":"lookup","token":token},assertion=lambda r:r["token"]==token and "gclid" not in r)
    data=checkout/"data"
    data.mkdir(exist_ok=True)
    (data/"sample.jsonl").write_text(json.dumps({"token":"SAMPLE00009","campaign":"sample"})+"\n",encoding="utf-8")
    local("subid import",{"operation":"import","input_file":"data/sample.jsonl"},assertion=lambda r:r["new"]==1)
    local("subid export",{"operation":"export","output_file":"data/sample-export.jsonl"},assertion=lambda r:r["rows"]==2)
    local("subid unconfigured pull",{"operation":"pull"},4)
    local("existing output protected",{"operation":"export","output_file":"data/sample-export.jsonl"},4)
    with tempfile.TemporaryDirectory(prefix="adspilot-canary-") as path:
        outside=Path(path)
        canary=outside/"canary.html"
        canary.write_text("canary",encoding="utf-8")
        site=checkout/"site"
        site.mkdir(exist_ok=True)
        link=site/"sample.html"
        page={"step":"page","slug":"sample","content":json.loads((checkout/"tests/fixtures/lp-content.example.json").read_text(encoding="utf-8"))}
        try:
            link.symlink_to(canary)
        except (OSError,NotImplementedError):
            pass  # Windows without symlink privileges: exercise junctions below.
        else:
            call("implicit page target rejects symlink","launch.run",page,4)
            results["page canary preserved"]=canary.read_text(encoding="utf-8")=="canary"
            link.unlink()
        os.link(str(canary),str(link))
        call("implicit page target rejects hard link","launch.run",page,4)
        results["hard link canary preserved"]=canary.read_text(encoding="utf-8")=="canary"
        link.unlink()
        linked_dir=checkout/"runs/linked-canary"
        linked_dir.parent.mkdir(exist_ok=True)
        if os.name=="nt":
            import _winapi
            _winapi.CreateJunction(str(outside),str(linked_dir))
        else:
            linked_dir.symlink_to(outside,target_is_directory=True)
        call("implicit run target rejects linked directory","loop.run",{"run_id":"linked-canary"},4)
        results["run canary preserved"]=list(outside.iterdir())==[canary]
        if os.name=="nt":
            linked_dir.rmdir()
        else:
            linked_dir.unlink()
    return results
