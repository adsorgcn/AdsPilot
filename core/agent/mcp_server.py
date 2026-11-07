#!/usr/bin/env python3
"""Local, newline-delimited MCP stdio server. The CLI owns every tool operation."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from core.agent.selfcheck import SECRET_MARKERS
VERSIONS = ("2025-11-25", "2025-06-18", "2025-03-26")
SECRET_FIELD = re.compile(r"gclid|(?:^|_)(?:password|passwd|secret|token|api_key|private_key|authorization|cookie|credential)(?:s?$|_value$)", re.I)
SENSITIVE_TEXT = re.compile(r"\bgclid\b\s*[=:]|\bBearer\s+\S+|\bsk-[A-Za-z0-9_-]{20,}|\bya29\.\S+", re.I)
MAX_MESSAGE = 4 * 1024 * 1024


def json_file(path):
    return json.loads(path.read_text(encoding="utf-8"))


class ProtocolError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def private_values(obj, public_subid=False):
    """Collect values supplied under sensitive fields; never echo them in errors."""
    values = set()
    if isinstance(obj, dict):
        for key, item in obj.items():
            if public_subid and key == "token" and isinstance(item, str) and re.fullmatch(r"[A-Za-z0-9]{8,32}", item):
                continue
            if SECRET_FIELD.search(key) and isinstance(item, str) and item:
                values.add(item)
            values.update(private_values(item))
    elif isinstance(obj, list):
        for item in obj:
            values.update(private_values(item))
    return values


def protected_output(result, arguments, tool=None):
    # A recognizable secret without a sensitive JSON field is still private.
    encoded = json.dumps(result, ensure_ascii=False, allow_nan=False)
    public_subid = tool in ("affiliate.cj.link", "affiliate.impact.link", "ledger.subid")
    secrets = private_values(arguments, public_subid)
    secrets.update(value for key, value in os.environ.items() if value and
                   re.search(r"(?:KEY|PASSWORD|TOKEN|SECRET|AUTHORIZATION)(?:$|_VALUE$)", key, re.I))
    if (private_values(result, public_subid) or SENSITIVE_TEXT.search(encoded)
            or any(marker in encoded for marker in SECRET_MARKERS)
            or any(secret in encoded for secret in secrets)):
        raise ValueError("sensitive result")
    return encoded


def tool_result(text, error=False):
    return {"content": [{"type": "text", "text": text}], "isError": error}


class Server:
    def __init__(self, config):
        self.config = config
        self.entries = {entry["id"]: entry for entry in json_file(ROOT / "schemas/interfaces.json")}
        self.ready = False
        self.version = None

    def initialize(self, params):
        if not isinstance(params.get("protocolVersion"), str):
            raise ProtocolError(-32602, "protocolVersion is required")
        offered = params["protocolVersion"]
        self.version = offered if offered in VERSIONS else VERSIONS[0]
        self.ready = False
        return {"protocolVersion": self.version, "capabilities": {"tools": {}},
                "serverInfo": {"name": "adspilot", "version": (ROOT / "VERSION").read_text().strip()}}

    def call(self, params):
        name = params.get("name")
        if not isinstance(name, str) or name not in self.entries:
            raise ProtocolError(-32602, "Unknown tool")
        arguments = params.get("arguments", {})
        if not isinstance(arguments, dict):
            raise ProtocolError(-32602, "arguments must be an object")
        if "config" in arguments:
            # The client may name the already-selected file, never another authority.
            host_file = self.config or (ROOT / "config/adspilot.json")
            if self.config is None and not host_file.is_file():
                host_file = ROOT / "config/adspilot.example.json"
            supplied = arguments["config"]
            if not isinstance(supplied, str) or (ROOT / supplied).resolve() != host_file.resolve():
                return tool_result("The host sets --config when it starts this server.", True)
        command = [sys.executable, str(ROOT / "adspilot.py"), name]
        if self.config is not None:
            command.extend(["--config", str(self.config)])
        try:
            result = subprocess.run(command, cwd=ROOT, input=json.dumps(arguments, allow_nan=False),
                                    capture_output=True, encoding="utf-8", timeout=300,
                                    env=dict(os.environ, PYTHONUTF8="1"))
            if result.returncode == 1 and name == "selfcheck.acceptance":
                failure = json.loads(result.stdout)
                if (isinstance(failure,dict) and set(failure)=={"verdict","reason"} and
                        failure["verdict"]=="fail" and isinstance(failure["reason"],str)):
                    return tool_result(protected_output(failure,arguments,name),True)
            if result.returncode:
                return tool_result(json.dumps({"error": "tool failed", "exit_code": result.returncode}), True)
            return tool_result(protected_output(json.loads(result.stdout), arguments, name))
        except (OSError, subprocess.TimeoutExpired, ValueError, RecursionError):
            return tool_result("Tool timed out or returned an unreadable or private result.", True)

    def respond(self, req):
        if not isinstance(req, dict) or req.get("jsonrpc") != "2.0" or not isinstance(req.get("method"), str):
            raise ProtocolError(-32600, "Invalid Request")
        if "id" in req and (type(req["id"]) not in (str, int)):
            raise ProtocolError(-32600, "Invalid request id")
        params = req.get("params", {})
        if not isinstance(params, dict):
            raise ProtocolError(-32602, "params must be an object")
        method = req["method"]
        if "id" not in req:
            if method == "notifications/initialized" and self.version is not None:
                self.ready = True
            return None
        if method == "initialize":
            return self.initialize(params)
        if method == "ping":
            return {}
        if method not in ("tools/list", "tools/call"):
            raise ProtocolError(-32601, "Method not found")
        if not self.ready:
            raise ProtocolError(-32002, "Initialize the server first")
        if method == "tools/list":
            if params.get("cursor") is not None:
                raise ProtocolError(-32602, "Invalid cursor")
            return {"tools": [{"name": name, "description": name + " (AdsPilot)",
                               "inputSchema": json_file(ROOT / entry["request_schema"])}
                              for name, entry in self.entries.items()]}
        return self.call(params)


def reject_constant(_value):
    raise ValueError("Non-finite number")


def serve(config):
    server = Server(config)
    stream = sys.stdin.buffer
    while True:
        line = stream.readline(MAX_MESSAGE + 1)
        if not line:
            break
        req = None
        response = {"jsonrpc": "2.0", "id": None}
        try:
            if len(line) > MAX_MESSAGE:
                while line and not line.endswith(b"\n"):
                    line = stream.readline(MAX_MESSAGE + 1)
                raise ProtocolError(-32600, "Request exceeds size limit")
            req = json.loads(line.decode("utf-8"), parse_constant=reject_constant)
            if isinstance(req, dict) and type(req.get("id")) in (int, str):
                response["id"] = req["id"]
            result = server.respond(req)
            if result is None:
                continue
            response["result"] = result
        except (UnicodeError, ValueError, RecursionError):
            response["error"] = {"code": -32700, "message": "Parse error"}
        except ProtocolError as err:
            if isinstance(req, dict) and "id" not in req and req.get("jsonrpc") == "2.0" and isinstance(req.get("method"), str):
                continue
            response["error"] = {"code": err.code, "message": str(err)}
        sys.stdout.buffer.write(json.dumps(response, ensure_ascii=True, allow_nan=False).encode("ascii") + b"\n")
        sys.stdout.buffer.flush()


def selftest():
    req = json_file(ROOT / "tests/fixtures/interfaces/judge.judge.request.json")
    initialize = {"protocolVersion": VERSIONS[0], "clientInfo": {"name": "selftest", "version": "1"}, "capabilities": {}}
    calls = [(1, "server/discover", {}), (2, "initialize", initialize), (None, "notifications/initialized", {}),
             (3, "tools/list", {}), (4, "tools/call", {"name": "judge.judge", "arguments": req}),
             (5, "tools/call", {"name": "judge.judge", "arguments": {"config": "other.json", "apply": True}})]
    for index, provider in enumerate(("cj", "impact"), 6):
        name = "affiliate." + provider + ".link"
        sample = json_file(ROOT / ("tests/fixtures/interfaces/" + name + ".request.json"))
        calls.append((index, "tools/call", {"name": name, "arguments": sample}))
    name = "runs/missing-mcp-fixture-"+uuid.uuid4().hex
    calls.append((8,"tools/call",{"name":"selfcheck.acceptance","arguments":{"runs_dir":name,
                  "ledger":"data/missing-"+uuid.uuid4().hex+".db"}}))
    messages = []
    for identifier, method, params in calls:
        message = {"jsonrpc": "2.0", "method": method, "params": params}
        if identifier is not None:
            message["id"] = identifier
        messages.append(json.dumps(message))
    child = subprocess.run([sys.executable, __file__, "--config",str(ROOT/"config/adspilot.example.json")], input="\n".join(messages) + "\n", capture_output=True,
                           encoding="utf-8", timeout=60, cwd=ROOT)
    if child.returncode:
        raise ValueError("stdio server failed")
    replies = {r["id"]: r for r in map(json.loads, child.stdout.splitlines())}
    assert replies[1]["error"]["code"] == -32601 and replies[2]["result"]["protocolVersion"] == VERSIONS[0]
    names = {t["name"] for t in replies[3]["result"]["tools"]}
    assert names == {entry["id"] for entry in json_file(ROOT / "schemas/interfaces.json")}
    result = replies[4]["result"]
    assert not result["isError"] and json.loads(result["content"][0]["text"])["type"] == "judgment.response"
    assert replies[5]["result"]["isError"]
    for index, param in ((6, "sid"), (7, "subId1")):
        link = replies[index]["result"]
        assert not link["isError"]
        payload = json.loads(link["content"][0]["text"])
        assert param + "=" + payload["token"] in payload["url"]

    failed = replies[8]["result"]
    assert failed["isError"] and json.loads(failed["content"][0]["text"]) == {"verdict":"fail","reason":"ledger.db missing"}

    for result in ({"secret": "synthetic"}, {"message": "gclid=example"}, {"extra": "synthetic"}):
        try:
            protected_output(result, {"gclid": "synthetic"})
        except ValueError:
            continue
        raise ValueError("Privacy check failed")
    print("MCP stdio: initialize ok; tools/list %d; judge.judge ok; affiliate links ok; acceptance fail reason retained; config override rejected; privacy checks ok" % len(names))
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, help="Host-selected AdsPilot config")
    parser.add_argument("--selftest", action="store_true")
    options = parser.parse_args()
    if options.selftest:
        sys.exit(selftest())
    serve(options.config.resolve() if options.config else None)
