"""Translate a validated JSON request to one legacy script, without shell parsing."""
import hashlib
import json
import os
import re
import shutil
import sqlite3
import stat
import subprocess
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from urllib.parse import unquote

from core.agent.interfaces import ROOT, read, short_id
from core.selfcheck.validate import CONFIG_SCHEMA, validate

PRIVATE = ("data", "runs")
OUTCOMES = {1: "invalid request or script failure", 2: "user action required",
            3: "external operation failed", 4: "configuration or credentials required"}
SECRET_FIELD = re.compile(r"(?:gclid|click_?id|password|authorization|cookie|secret|verify_token|(?:api|auth|access|refresh|export|private|global)[_-]?(?:key|token)|(?:^|_)credentials?(?:$|_))", re.I)
SENSITIVE_TEXT = re.compile(
    r"(?:\b(?:gclid|token|[a-z_]*(?:access_token|api_key|password|credential))\s*[=:]"
    r"|[?&](?:key|sig|signature|x-amz-signature|x-goog-signature)=|\bBearer\s+\S"
    r"|[a-z]+://[^/\s]+:[^/\s]+@|(?:sk[-](?:proj-|ant-)?|gh[pousr][_]|github[_]pat[_]"
    r"|xox[baprs][-]|AKI[A]|AIZa)[a-z0-9_-]{8,}|BEGIN [A-Z ]*PRIVATE KEY)", re.I)



class InterfaceError(Exception):
    def __init__(self, message, code=1, body=None):
        super().__init__(message)
        self.code = code
        self.body = body


def credential_values():
    return [v for k, v in os.environ.items() if len(v) >= 4 and (
        sensitive_field(k) or k.endswith(("_TOKEN", "_KEY", "_ACCOUNT_SID", "_CUSTOMER_ID")))]


def sensitive_string(s, values):
    value = unquote(unquote(s))
    return SENSITIVE_TEXT.search(value) or any(secret in value for secret in values)


def sensitive_field(name):
    folded = re.sub(r"[^a-z0-9]", "", name.lower())
    return (SECRET_FIELD.search(name) or "credential" in folded or "password" in folded
            or "passwd" in folded or "passphrase" in folded or "secret" in folded
            or folded.endswith(("token", "tokens", "apikey", "privatekey", "authorization", "cookie"))
            or folded in ("key","auth","bearer","stderr"))


def attribution_names(key, operation, output):
    if key == "affiliate.link" or (key == "ledger.subid" and operation in ("record","lookup")):
        return {"token"}
    if output and key == "ledger.subid" and operation == "mint":
        return {"tokens"}
    return set()


def public_attribution(name, value, allowed):
    if name not in allowed:
        return False
    items = value if name == "tokens" and isinstance(value,list) else [value]
    return bool(items) and all(isinstance(item,str) and re.fullmatch(r"[A-Za-z0-9]{8,32}",item) for item in items)


def sanitize(obj, values, allowed=()):
    # A child response can repeat a secret under an ordinary field. Gather
    # sensitive values first, then remove those values wherever they reappear.
    private = set(values)

    def gather(item, top=False, inside=False):
        if isinstance(item, dict):
            for name, child in item.items():
                hidden = sensitive_field(name) and not (top and public_attribution(name,child,allowed))
                gather(child, inside=inside or hidden)
        elif isinstance(item, list):
            for child in item:
                gather(child, inside=inside)
        elif inside and isinstance(item,str) and item:
            private.add(item)

    def clean(item, top=False):
        if isinstance(item, dict):
            result = {}
            for name, child in item.items():
                if sensitive_string(name, private):
                    continue
                if sensitive_field(name) and not (top and public_attribution(name,child,allowed)):
                    continue
                result[name] = clean(child)
            return result
        if isinstance(item, list):
            return [clean(child) for child in item]
        if isinstance(item,str) and sensitive_string(item, private):
            return "[redacted]"
        return item

    gather(obj,top=True)
    return clean(obj,top=True)


def within(path, directory):
    try:
        path.relative_to(directory)
        return True
    except ValueError:
        return False


def check_node(node):
    try:
        info = node.lstat()
    except FileNotFoundError:
        return
    mode = info.st_mode
    # st_file_attributes predates Python 3.9 and includes junctions on Windows.
    if stat.S_ISLNK(mode) or getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0):
        raise InterfaceError("linked paths are not allowed", 4)
    if stat.S_ISREG(mode) and info.st_nlink > 1:
        raise InterfaceError("hard-linked file is not allowed", 4)
    if not (stat.S_ISREG(mode) or stat.S_ISDIR(mode)):
        raise InterfaceError("unexpected file type", 4)


def safe_path(value, roots, suffix=None, output=False):
    """Resolve only workspace-owned files. Reject symlinks and traversal, even inside a root."""
    p = Path(value)
    if ".." in p.parts or "\\" in value and os.name != "nt" or re.match(r"^[a-zA-Z]:", value) and os.name != "nt":
        raise InterfaceError("invalid file path")
    full = p if p.is_absolute() else ROOT / p
    if os.name == "nt" and any(":" in part for part in full.parts[1:]):
        raise InterfaceError("invalid Windows file path", 4)
    if not any(within(full, ROOT / d) for d in roots):
        raise InterfaceError("file outside permitted directory", 4)
    relative = full.relative_to(ROOT)
    cursor = ROOT
    for part in relative.parts:
        cursor = cursor / part
        check_node(cursor)
    if not within(full.resolve(), ROOT) or (suffix and full.suffix.lower() != suffix):
        raise InterfaceError("invalid file path", 4)
    if output:
        if not full.parent.is_dir():
            raise InterfaceError("output directory does not exist", 4)
        if full.exists():
            raise InterfaceError("choose a new private output file", 4)
    elif not full.is_file():
        raise InterfaceError("input file unavailable", 4)
    return full


def config_for(req):
    arg = req.get("config")
    if not arg:
        arg = "config/adspilot.json" if (ROOT/"config/adspilot.json").is_file() else "config/adspilot.example.json"
    allowed = ["config"]
    if arg == "tests/fixtures/interfaces/loop.config.json":
        allowed.append("tests/fixtures/interfaces")
    path = safe_path(arg, allowed, ".json")
    cfg = read(path)
    if validate(CONFIG_SCHEMA, cfg):
        raise InterfaceError("invalid AdsPilot config", 4)
    apply = req.get("apply", False)
    if apply and (cfg.get("apply") is not True or req.get("dry_run") is True):
        raise InterfaceError("apply needs config.apply=true and dry_run=false", 4)
    return path, cfg, apply


def environment(apply):
    env = dict(os.environ, PYTHONUTF8="1")
    if not apply:
        for name in list(env):
            if sensitive_field(name) or name.endswith(("_KEY", "_TOKEN", "_SID", "_CUSTOMER_ID", "_CLIENT_ID")):
                env.pop(name)
        env["PYTHONPATH"] = str(ROOT / "core/agent/interface_offline")
    return env


def legacy(entry, args, apply, stdin=None):
    proc = subprocess.run([sys.executable, str(ROOT / entry["script"]), *args],
                          input=json.dumps(stdin) if stdin is not None else "",
                          capture_output=True, encoding="utf-8", errors="replace",
                          cwd=ROOT, env=environment(apply), timeout=600)
    return proc.returncode, proc.stdout


def arguments(template, bindings, tmp):
    argv = []
    for token in template:
        match = re.fullmatch(r"(?:(--[a-z-]+)=)?\{([a-z_]+)(?::([a-z]+))?\}", token)
        if not match:
            argv.append(token)
            continue
        flag, key, codec = match.groups()
        value = bindings.get(key)
        if value is None:
            continue
        if codec == "flag":
            if value is True:
                argv.append(flag)
            continue
        if isinstance(value, Path):
            value = str(value)
        elif codec in ("json", "text"):
            file = tmp / (key + (".json" if codec == "json" else ".txt"))
            file.write_text(json.dumps(value) if codec == "json" else value, encoding="utf-8")
            value = str(file)
        elif codec == "literal":
            value = json.dumps(value)
        elif codec == "csv":
            if any("," in item for item in value):
                raise InterfaceError("comma is not allowed in list items")
            value = ",".join(value)
        else:
            value = str(value)
        if value.startswith("--") or "\0" in value:
            raise InterfaceError("invalid option value")
        if flag:
            argv.append(flag)
        argv.append(value)
    return argv


def publish_private(files):
    """Stage in the destination filesystem, then publish without overwriting another caller."""
    created = []
    try:
        for source, dest in files:
            with tempfile.NamedTemporaryFile(dir=dest.parent, delete=False) as fp:
                stage = Path(fp.name)
            try:
                shutil.copyfile(source,stage)
                os.link(str(stage),str(dest))
                created.append(dest)
            finally:
                stage.unlink()
    except OSError:
        for dest in created:
            dest.unlink()
        raise InterfaceError("private output already exists or cannot be created",4)


def database(cfg, tmp, apply):
    path = Path(cfg["data_dir"]) / "ledger.db"
    real = path if path.is_absolute() else ROOT / path
    if apply:
        return real
    snapshot = tmp / "ledger.db"
    if real.is_file():
        source = sqlite3.connect(real.absolute().as_uri() + "?mode=ro", uri=True)
        target = sqlite3.connect(str(snapshot))
        try:
            source.backup(target)
        finally:
            target.close()
            source.close()
    return snapshot


def preview_needed(key, req):
    if key in ("deploy.publish", "deploy.setup", "deploy.status", "judgment.judge",
               "keywords.suggest", "keywords.volume", "traffic.report_api","loop.ack"):
        return True
    if key == "launch.run":
        return req["step"] in ("deploy","verify","go","teardown") or (req["step"] == "offers" and not req.get("offers"))
    if key == "ledger.subid":
        return req["operation"] in ("import","pull","record","export")
    if key == "traffic.deploy":
        return "spec" not in req
    if key == "traffic.convert_api":
        return "remove_action" in req
    offline = {"affiliate.offers":"offers","affiliate.commissions":"csv","affiliate.chargebacks":"commissions"}
    return key in offline and offline[key] not in req


def checked_location(value, directory):
    """A configured workspace path may be nested, but may not escape through a link."""
    p = Path(value)
    raw = p if p.is_absolute() else ROOT / p
    if ".." in p.parts:
        raise InterfaceError("invalid configured path",4)
    # Absolute storage locations belong to the trusted, on-disk config only.
    anchor = ROOT if within(raw,ROOT) else Path(raw.anchor)
    cursor = anchor
    for part in raw.relative_to(anchor).parts:
        cursor = cursor / part
        check_node(cursor)
        if not within(cursor.resolve(),anchor):
            raise InterfaceError("linked configured path is not allowed",4)
    target = raw / directory if directory else raw
    check_node(target)
    if not within(target.resolve(),raw.resolve()):
        raise InterfaceError("linked output path is not allowed",4)
    return target


OFFLINE_RUN_TOOLS = ("loop.simulate", "selfcheck.acceptance", "judge.calibrate")


def private_run_paths(key, req, cfg):
    """Accept the configured run tree only, even on a host with absolute storage paths."""
    runs_base = checked_location(cfg["runs_dir"], None)
    data_base = checked_location(cfg["data_dir"], None)
    if any(p in (ROOT,Path(p.anchor)) for p in (runs_base,data_base)):
        raise InterfaceError("data/runs directory must be dedicated",4)
    target = checked_location(req["runs_dir"], None)
    if not within(target,runs_base) or (key == "loop.simulate" and target == runs_base):
        raise InterfaceError("choose a directory within configured runs_dir",4)
    if target.exists() and not target.is_dir():
        raise InterfaceError("runs_dir must be a directory",4)
    audit_tree(target)
    req["runs_dir"] = target
    if key == "loop.simulate":
        return
    if req.get("ledger"):
        ledger = checked_location(req["ledger"],None)
    elif (target/".adspilot-simulation.json").is_file():
        ledger = target/"data/ledger.db"
    elif target == runs_base:
        ledger = data_base/"ledger.db"
    else:
        ledger = target.parent/"data/ledger.db"
    if not any(within(ledger,p) for p in (runs_base,data_base)) or ledger.suffix.lower() not in (".db",".sqlite",".sqlite3"):
        raise InterfaceError("ledger must be a private SQLite file",4)
    for suffix in ("","-wal","-shm","-journal"):
        checked_location(str(ledger)+suffix,None)
    req["ledger"] = ledger
    if key == "judge.calibrate":
        soul = safe_path(req.get("soul",cfg["soul"]),["soul"],".md")
        if not soul.name.endswith(".soul.md"):
            raise InterfaceError("expected a SOUL file",4)
        req["soul"] = soul
        if req.get("use_config_fx"):
            req["reference_config"] = req["config"]


def audit_tree(root):
    if root.exists():
        # Never traverse a linked directory, including a dangling link.
        stack = [root]
        while stack:
            location = stack.pop()
            with os.scandir(location) as listing:
                for item in listing:
                    node = Path(item.path)
                    check_node(node)
                    if item.is_dir(follow_symlinks=False):
                        stack.append(node)


def acceptance_result(output, rc):
    if rc == 0:
        match = re.fullmatch(r"pass dates=(\d{4}-\d\d-\d\d\.\.\d{4}-\d\d-\d\d) days=7 evidence=(fixture-simulation|local-ledger-and-reports)",output.strip())
        if not match:
            raise InterfaceError("unrecognized acceptance result")
        return {"verdict":"pass","dates":match[1],"days":7,"evidence":match[2]}
    # Do not return directory names, run identifiers or other text from a ledger.
    known = ("ledger.db missing","runs table is empty","invalid ledger run id","unexpected report symlink",
             "missing report","invalid report schema","report date disagrees with ledger","report disagrees with ledger",
             "needs_human reason outside kyc/payment/appeal or missing","exit 2 without required human intervention",
             "run directory without a ledger row","unfinished or inconsistent ledger timestamps")
    reason = next((item for item in known if output.startswith("fail "+item)),None)
    day = re.fullmatch(r"fail (\d{4}-\d\d-\d\d has \d+ runs; expected exactly 1)",output.strip())
    if day:
        reason = day[1]
    code = re.match(r"fail exit code (-?\d+) for ",output)
    if code:
        reason = "disallowed exit code "+code[1]
    return {"verdict":"fail","reason":reason or "invalid local ledger or report evidence"}


def offline_run(entry, req, cfg, tmp):
    key = entry["id"]
    private_run_paths(key,req,cfg)
    args = arguments(entry["argv_template"],req,tmp)
    rc, stdout = legacy(entry,args,False)
    if key == "selfcheck.acceptance":
        result = acceptance_result(stdout,rc)
        if rc:
            raise InterfaceError("acceptance failed",body=result)
        return result
    if rc:
        raise InterfaceError(OUTCOMES.get(rc,OUTCOMES[1]),rc if rc in OUTCOMES else 1)
    if key == "loop.simulate":
        manifest = read(req["runs_dir"]/".adspilot-simulation.json")
        if manifest.get("kind") != "fixture-simulation" or manifest.get("days") != req["days"]:
            raise InterfaceError("invalid simulation result")
        base = ROOT if within(req["runs_dir"],ROOT) else checked_location(cfg["runs_dir"],None)
        location = req["runs_dir"].relative_to(base).as_posix()
        return {"days":req["days"],"evidence":"fixture-simulation","runs_dir":location}
    output = json.loads(stdout)
    proposal = Path(output["proposal"])
    if proposal.parent != req["runs_dir"] or not re.fullmatch(r"calibration-\d{4}-\d\d-\d\d\.json",proposal.name):
        raise InterfaceError("invalid calibration output path")
    check_node(proposal)
    result = read(proposal)
    if result.get("evidence") != output.get("evidence") or result.get("proposal_only") is not True:
        raise InterfaceError("invalid calibration proposal")
    return dict(result,proposal_file=proposal.name)


def guard_outputs(key, cfg):
    """Legacy scripts derive additional paths internally. Audit just their potential roots."""
    roots = set()
    if key in ("loop.run","launch.run"):
        roots.update((cfg["runs_dir"],cfg["data_dir"],"runs","data"))
    if key == "launch.run":
        roots.add("site")
    if key == "agent.selfcheck":
        for folder in ("data","runs"):
            checked_location(folder,None)
        # This legacy entry reads config/adspilot.json even when a different config is selected.
        default = ROOT / "config/adspilot.json"
        if default.exists():
            local = read(safe_path(str(default),["config"],".json"))
            for name in ("data_dir","runs_dir"):
                checked_location(local.get(name,name.split("_")[0]),None)
    if key.startswith("ledger.") or key == "loop.ack":
        # SQLite touches the db, journal and WAL, not the rest of the data tree.
        for suffix in ("",".db-wal",".db-shm",".db-journal"):
            name = "ledger.db" if not suffix else "ledger" + suffix
            checked_location(cfg["data_dir"],name)
    if key.startswith("deploy.") or key in ("traffic.convert","traffic.convert_api"):
        roots.add("data")
    checked = set()
    for folder in roots:
        root = checked_location(folder,None)
        if root == ROOT or root == Path(root.anchor):
            raise InterfaceError("data/runs directory must be a dedicated directory",4)
        if any(within(root, previous) for previous in checked):
            continue
        audit_tree(root)
        checked.add(root)


@contextmanager
def loop_guard(cfg, run_id, fingerprint):
    """Never rerun external writes on retry. An interrupted attempt needs inspection."""
    run_dir = checked_location(cfg["runs_dir"], run_id)
    run_dir.mkdir(parents=True,exist_ok=True)
    report = run_dir/"report.json"
    marker = run_dir/".interface-request.json"
    check_node(report)
    check_node(marker)
    try:
        with marker.open("x",encoding="utf-8") as f:
            json.dump({"request":fingerprint,"complete":False},f)
    except FileExistsError:
        try:
            previous=read(marker)
        except ValueError:
            raise InterfaceError("another run is starting")
        if previous.get("request") != fingerprint:
            raise InterfaceError("run ID belongs to another request")
        if not previous.get("complete"):
            raise InterfaceError("run is in progress or interrupted; inspect the local run")
        if not report.is_file():
            raise InterfaceError("completed run report missing")
        yield True
        return
    if report.exists() or any(p.name != marker.name for p in run_dir.iterdir()):
        marker.unlink()
        raise InterfaceError("run directory already belongs to another run")
    try:
        yield False
    except BaseException:
        # Preserve the claim after any partial run, especially a live write.
        raise
    else:
        done=run_dir/(".interface-"+uuid.uuid4().hex)
        done.write_text(json.dumps({"request":fingerprint,"complete":True}),encoding="utf-8")
        os.replace(str(done),str(marker))


def run_request(entry, request, tmp):
    if not isinstance(request, dict) or validate(read(ROOT/entry["request_schema"]),request):
        raise InterfaceError("request does not match " + entry["request_schema"])
    secrets = credential_values()
    ident = entry["id"]
    key = short_id(ident)
    allowed = attribution_names(key, request.get("operation"), output=False)
    if sanitize(request,secrets,allowed) != request:
        raise InterfaceError("sensitive fields must stay in the private local input file")
    cp, cfg, apply = config_for(request)
    req = dict(request,config=cp)
    if key in OFFLINE_RUN_TOOLS:
        return sanitize(offline_run(entry,req,cfg,tmp),secrets)
    guard_outputs(key, cfg)
    for name, value in request.items():
        if isinstance(value, str) and value.startswith("--"):
            raise InterfaceError("invalid option value")
    if "input_file" in req:
        suffix = ".jsonl" if key == "ledger.subid" else ".json"
        safe_path(req["input_file"], PRIVATE, suffix)
    if "output_file" in req:
        suffix = ".jsonl" if key == "ledger.subid" else ".csv"
        safe_path(req["output_file"], PRIVATE, suffix, output=True)
    if key == "ledger.subid" and req.get("operation") == "pull" and req.get("url") and req["url"] != cfg["deploy"].get("export_url"):
        raise InterfaceError("pull URL must match configured deploy.export_url",4)
    if not apply and preview_needed(key,req):
        action = req.get("step") or req.get("operation") or ident.split(".")[-1]
        return {"interface":ident,"dry_run":True,"action":action}
    stdin = None
    output_path = None
    if key == "launch.run" and not apply and req["step"] == "offers" and any(not row.get("keywords") for row in req.get("offers", [])):
        return {"interface":ident,"dry_run":True,"action":"offers"}
    if key == "judge.judge" and not apply:
        req["provider"] = "local"
    if key == "selfcheck.validate":
        req["schema"] = safe_path("schemas/"+req["schema"],["schemas"],".json")
        if not req["schema"].name.endswith(".schema.json"):
            raise InterfaceError("expected a schema file")
    if key.startswith("ledger."):
        req["db"] = database(cfg,tmp,apply)
    if key == "ledger.subid":
        op = req["operation"]
        if op in ("record","lookup") and "token" not in req:
            raise InterfaceError("token required")
        if op == "lookup":
            req["argument"] = req["token"]
            del req["token"]
        if op == "import":
            req["argument"] = safe_path(req.get("input_file",""),PRIVATE,".jsonl")
        if op == "export":
            output_path = safe_path(req.get("output_file",""),PRIVATE,".jsonl",output=True)
            req["out"] = tmp/"mappings.jsonl"
        if op == "pull":
            # A caller cannot redirect the export Bearer credential to their own URL.
            req["url"] = cfg["deploy"].get("export_url") or None
    if key in ("traffic.convert","traffic.convert_api"):
        if "input_file" in req:
            req["conversions"] = safe_path(req["input_file"],PRIVATE,".json")
        if key == "traffic.convert":
            req["out"] = tmp/"conversions.csv"
            if apply and req.get("output_file"):
                output_path = safe_path(req["output_file"],PRIVATE,".csv",output=True)
            if output_path and Path(str(output_path)+".adjustments.csv").exists():
                raise InterfaceError("choose a new output file",4)
    if key == "judgment.judge":
        req["judgment_config"] = cfg.get("judgment",{})
        stdin = {k: req[k] for k in ("node","state","choices","caps","evidence") if k in req}
        stdin["type"] = "judgment.request"
    if key == "ipintel.lookup":
        stdin = {"ips":req["ips"]}
    if key == "loop.run":
        if "date" in req:
            req_date = date.fromisoformat(req["date"])
            req.setdefault("run_id", "run-"+req_date.isoformat())
        else:
            req.setdefault("run_id", "run-"+uuid.uuid4().hex[:16])
        if not apply:
            cfg.update(apply=False,judgment=dict(cfg["judgment"],provider="local"))
            cfg["affiliate"]=dict(cfg["affiliate"],commissions_source="json")
            cfg["traffic"]=dict(cfg["traffic"],report_source="csv_export")
            cfg["deploy"]=dict(cfg.get("deploy",{}),export_url="")
            req["config"] = tmp/"config.json"
            req["config"].write_text(json.dumps(cfg),encoding="utf-8")
    args = arguments(entry["argv_template"],req,tmp)
    if apply and key in ("launch.run","loop.run","traffic.deploy","traffic.budget","traffic.convert_api","traffic.report_api","deploy.setup","ipintel.lookup"):
        args.append("--apply")
    if key == "loop.run" and not apply:
        args.append("--dry-run")
    if key == "loop.run":
        signature = {"apply":apply,"request":request,"config":cfg}
        fingerprint=hashlib.sha256(json.dumps(signature,sort_keys=True).encode()).hexdigest()
        with loop_guard(cfg,req["run_id"],fingerprint) as replay:
            if not replay:
                rc, _ = legacy(entry,args,apply,stdin)
                if rc:
                    raise InterfaceError(OUTCOMES.get(rc,OUTCOMES[1]), rc if rc in OUTCOMES else 1)
            result=read(checked_location(cfg["runs_dir"],req["run_id"])/"report.json")
            result=sanitize(result,secrets)
            if validate(read(ROOT/entry["response_schema"]),result):
                raise InterfaceError("invalid run report")
            return result
    rc, output = legacy(entry,args,apply,stdin)
    if rc:
        # Only vetted structured diagnostics cross the interface.
        if key == "lp.check" and rc == 1:
            check = json.loads(output)
            if check.get("verdict") == "fail":
                raise InterfaceError("landing page check failed: "+", ".join(r["check"] for r in check["results"] if r["status"]=="fail"))
        raise InterfaceError(OUTCOMES.get(rc,OUTCOMES[1]),rc if rc in OUTCOMES else 1)
    if key == "selfcheck.validate":
        result = {"valid":True}
    elif key == "loop.ack":
        result = {"acknowledged":int(re.fullmatch(r"acked (\d+) actions for [\w-]+",output.strip()).group(1))}
    elif key == "ledger.subid" and req["operation"] == "mint":
        result = {"tokens":output.splitlines()}
    elif key == "ledger.subid" and req["operation"] in ("import","pull"):
        counts = re.search(r"new=(\d+) dup=(\d+) bad=(\d+)",output)
        result = dict(zip(("new","duplicate","invalid"),map(int,counts.groups())))
    elif key == "ledger.subid" and req["operation"] == "export":
        result = {"rows":int(re.match(r"exported (\d+) rows",output).group(1)),"output_file":req["output_file"]}
    elif key == "traffic.convert":
        counts = re.match(r"conversions=(\d+) adjustments=(\d+)",output)
        result = dict(zip(("rows","adjustments"),map(int,counts.groups())))
        if apply and "output_file" in req:
            result["output_file"]=req["output_file"]
    else:
        result = json.loads(output)
    if output_path is not None:
        files=[(req["out"],output_path)]
        adjustments=Path(str(req["out"])+".adjustments.csv")
        if adjustments.exists():
            files.append((adjustments,Path(str(output_path)+".adjustments.csv")))
        publish_private(files)
    allowed = attribution_names(key,req.get("operation"),output=True)
    return sanitize(result,secrets,allowed)


def dispatch(entry, request):
    with tempfile.TemporaryDirectory(prefix="adspilot-interface-") as directory:
        try:
            result = run_request(entry,request,Path(directory))
        except InterfaceError as error:
            if error.body is not None and validate(read(ROOT / entry["response_schema"]),error.body):
                raise InterfaceError("invalid interface failure response")
            raise
    if validate(read(ROOT / entry["response_schema"]), result):
        raise InterfaceError("script output does not match " + entry["response_schema"])
    return result
