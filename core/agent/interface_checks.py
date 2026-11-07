"""Boundary regressions run only inside the disposable interface selftest checkout."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

from core.agent.interface_runner import sanitize
from core.agent.interfaces import read
from core.selfcheck.validate import validate


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

    for provider, bad_key, good_key in (("cj","campaign_ids","advertiser_ids"),("impact","advertiser_ids","campaign_ids")):
        action = "affiliate."+provider+".offers"
        call(provider+" rejects another provider's filter",action,{bad_key:["sample"]},1)
        call(provider+" accepts its own filter in preview",action,{good_key:["sample"]},0,lambda r:r["dry_run"] is True)
    for schema in ("traffic.budget","traffic.deploy","traffic.convert_api","judgment.judge"):
        doc=read(checkout/"schemas/interfaces"/(schema+".response.schema.json"))
        results[schema+" rejects empty successful response"] = bool(validate(doc,{}))
    deploy=read(checkout/"schemas/interfaces/traffic.deploy.response.schema.json")
    results["Google deploy apply response permits absent dry plan"] = not validate(
        deploy,{"mode":"apply","created":{"campaign":["sample"]},"applied":True})
    call("incomplete week yields safe fail JSON","selfcheck.acceptance",{"runs_dir":"runs/missing-week"},1,
         lambda r:r == {"verdict":"fail","reason":"ledger.db missing"})
    call("simulator cannot target production runs directory","loop.simulate",{"runs_dir":"runs","days":1},4)
    for action, req in (("loop.simulate",{"days":1}),("selfcheck.acceptance",{}),("judge.calibrate",{})):
        call(action+" rejects escaping path",action,dict(req,runs_dir="../outside"),4)
        call(action+" rejects apply",action,dict(req,runs_dir="runs/test",apply=True,config=relative),1)
    call("IP lookup refuses apply without host consent","ipintel.ipapi-is.lookup",{"ips":["192.0.2.23"],"apply":True},4)
    call("IP lookup needs a key even with host consent","ipintel.ipapi-is.lookup",
         {"ips":["192.0.2.23"],"apply":True,"config":relative},4,extra_env={"IPAPI_IS_KEY":""})
    call("IP lookup does not fabricate unknown address data","ipintel.ipapi-is.lookup",
         {"ips":["192.0.2.77"]},0,lambda r:r=={"rows":[]})
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
    sample = "boundary-test-canary"
    results["sensitive response value removed at every occurrence"] = (
        sanitize({"nested":{"sessionToken":sample},"detail":"echo "+sample}, ()) ==
        {"nested":{},"detail":"[redacted]"})
    for name in ("token","apiToken","client_credential","passwd","passPhrase","refresh-token"):
        call("nested sensitive field rejected: "+name,"judgment.llm.judge",
             {"node":"campaign.adjust","choices":[{"id":"keep"}],"state":{"rows":[{name:sample}]}},1,
             lambda r:sample not in str(r))
    call("public affiliate sub-id preserved","affiliate.impact.link",
         {"token":"SAMPLE00001","base":"https://example.com/item"},0,
         lambda r:r.get("token")=="SAMPLE00001" and "SAMPLE00001" in r["url"])
    call("signed url rejected","affiliate.cj.link",
         {"base":"https://example.com/?Signature="+sample,"token":"SAMPLE00001"},1,
         lambda r:sample not in str(r))
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
        for action, req in (("loop.simulate",{"days":1}),("selfcheck.acceptance",{}),("judge.calibrate",{})):
            call(action+" rejects linked run tree",action,dict(req,runs_dir="runs/linked-canary"),4)
        call("implicit run target rejects linked directory","loop.run",{"run_id":"linked-canary"},4)
        results["run canary preserved"]=list(outside.iterdir())==[canary]
        if os.name=="nt":
            linked_dir.rmdir()
        else:
            linked_dir.unlink()
    return results
