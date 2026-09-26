#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AdsPilot schema 自检（主干，schema 与自检部件）

一个只用标准库的 JSON Schema 2020-12 子集校验器，加几条 AdsPilot 自己的一致性规则。
不认识的关键字直接报错，不会悄悄跳过。

用法：
  python3 core/selfcheck/validate.py --manifests                 # 校验所有插件 manifest
  python3 core/selfcheck/validate.py --config                    # 校验 config/adspilot.json
  python3 core/selfcheck/validate.py --file <schema.json> <doc.json>
  python3 core/selfcheck/validate.py --report <doc.json>         # 本轮报告
  python3 core/selfcheck/validate.py --judgment <doc.json>       # 判断请求或响应
  python3 core/selfcheck/validate.py --spec <doc.json>           # 投放规格
  python3 core/selfcheck/validate.py --traffic-report <doc.json>
  python3 core/selfcheck/validate.py --commissions <doc.json>
  python3 core/selfcheck/validate.py --all                       # manifests + config(若有) + tests/fixtures 全部样例

退出码：0 全过；1 有不合格。
也可 import：from validate import validate, load_schema
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SCHEMAS = os.path.join(ROOT, "schemas")

ANNOTATIONS = {"$schema", "$id", "$comment", "title", "description", "examples", "default", "$defs", "deprecated"}
SUPPORTED = ANNOTATIONS | {
    "type", "enum", "const", "required", "properties", "additionalProperties", "pattern",
    "minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum",
    "items", "minItems", "maxItems", "uniqueItems", "allOf", "anyOf", "oneOf", "not", "$ref",
    "minProperties", "maxProperties", "propertyNames"}

REQUIRED_ACTIONS = {
    "traffic": {"spec", "deploy", "report", "convert"},
    "affiliate": {"offers", "link", "commissions", "chargebacks"},
    "judgment": {"judge"},
    "deploy": {"setup", "publish", "status"},
    "keywords": {"suggest", "volume"},
    "ipintel": {"lookup"},
}


class Unsupported(Exception):
    pass


def _ecma(p):
    out, i, in_class = [], 0, False
    while i < len(p):
        c = p[i]
        if c == "\\" and i + 1 < len(p):
            out.append(p[i:i + 2]); i += 2; continue
        if in_class:
            if c == "]":
                in_class = False
        elif c == "[":
            in_class = True
        elif c == "$":
            out.append("\\Z"); i += 1; continue
        out.append(c); i += 1
    return "".join(out)


def _type_ok(t, v):
    if t == "object": return isinstance(v, dict)
    if t == "array": return isinstance(v, list)
    if t == "string": return isinstance(v, str)
    if t == "integer": return isinstance(v, int) and not isinstance(v, bool) or (isinstance(v, float) and v.is_integer())
    if t == "number": return isinstance(v, (int, float)) and not isinstance(v, bool)
    if t == "boolean": return isinstance(v, bool)
    if t == "null": return v is None
    raise Unsupported("type %r" % t)


def _resolve(ref, root):
    if not ref.startswith("#/"):
        raise Unsupported("$ref %r" % ref)
    node = root
    for part in ref[2:].split("/"):
        node = node[part.replace("~1", "/").replace("~0", "~")]
    return node


def validate(schema, doc, root=None, path="$"):
    """返回错误列表；空列表即合格。"""
    root = schema if root is None else root
    if schema is True:
        return []
    if schema is False:
        return ["%s: schema false" % path]
    errs = []
    for k in schema:
        if k not in SUPPORTED:
            raise Unsupported("keyword %r at %s" % (k, path))
    if "$ref" in schema:
        errs += validate(_resolve(schema["$ref"], root), doc, root, path)
    if "type" in schema:
        ts = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        if not any(_type_ok(t, doc) for t in ts):
            errs.append("%s: type %s expected, got %s" % (path, "/".join(ts), type(doc).__name__))
            return errs
    if "enum" in schema and doc not in schema["enum"]:
        errs.append("%s: %r not in enum %s" % (path, doc, schema["enum"]))
    if "const" in schema and doc != schema["const"]:
        errs.append("%s: %r != const %r" % (path, doc, schema["const"]))
    if isinstance(doc, str):
        if "minLength" in schema and len(doc) < schema["minLength"]:
            errs.append("%s: shorter than %d" % (path, schema["minLength"]))
        if "maxLength" in schema and len(doc) > schema["maxLength"]:
            errs.append("%s: longer than %d" % (path, schema["maxLength"]))
        if "pattern" in schema and not re.search(_ecma(schema["pattern"]), doc):
            errs.append("%s: %r does not match %s" % (path, doc, schema["pattern"]))
    if isinstance(doc, (int, float)) and not isinstance(doc, bool):
        if "minimum" in schema and doc < schema["minimum"]:
            errs.append("%s: %s < minimum %s" % (path, doc, schema["minimum"]))
        if "maximum" in schema and doc > schema["maximum"]:
            errs.append("%s: %s > maximum %s" % (path, doc, schema["maximum"]))
        if "exclusiveMinimum" in schema and doc <= schema["exclusiveMinimum"]:
            errs.append("%s: %s <= exclusiveMinimum %s" % (path, doc, schema["exclusiveMinimum"]))
        if "exclusiveMaximum" in schema and doc >= schema["exclusiveMaximum"]:
            errs.append("%s: %s >= exclusiveMaximum %s" % (path, doc, schema["exclusiveMaximum"]))
    if isinstance(doc, dict):
        for r in schema.get("required", []):
            if r not in doc:
                errs.append("%s: missing required %r" % (path, r))
        props = schema.get("properties", {})
        for k, v in doc.items():
            if k in props:
                errs += validate(props[k], v, root, "%s.%s" % (path, k))
            elif "additionalProperties" in schema:
                ap = schema["additionalProperties"]
                if ap is False:
                    errs.append("%s: additional property %r not allowed" % (path, k))
                elif ap is not True:
                    errs += validate(ap, v, root, "%s.%s" % (path, k))
            if "propertyNames" in schema:
                errs += validate(schema["propertyNames"], k, root, "%s.<name %s>" % (path, k))
        if "minProperties" in schema and len(doc) < schema["minProperties"]:
            errs.append("%s: fewer than %d properties" % (path, schema["minProperties"]))
        if "maxProperties" in schema and len(doc) > schema["maxProperties"]:
            errs.append("%s: more than %d properties" % (path, schema["maxProperties"]))
    if isinstance(doc, list):
        if "minItems" in schema and len(doc) < schema["minItems"]:
            errs.append("%s: fewer than %d items" % (path, schema["minItems"]))
        if "maxItems" in schema and len(doc) > schema["maxItems"]:
            errs.append("%s: more than %d items" % (path, schema["maxItems"]))
        if schema.get("uniqueItems") and len({json.dumps(x, sort_keys=True) for x in doc}) != len(doc):
            errs.append("%s: items not unique" % path)
        if "items" in schema:
            for i, item in enumerate(doc):
                errs += validate(schema["items"], item, root, "%s[%d]" % (path, i))
    if "allOf" in schema:
        for s in schema["allOf"]:
            errs += validate(s, doc, root, path)
    if "anyOf" in schema:
        if not any(not validate(s, doc, root, path) for s in schema["anyOf"]):
            errs.append("%s: matches none of anyOf" % path)
    if "oneOf" in schema:
        n = sum(1 for s in schema["oneOf"] if not validate(s, doc, root, path))
        if n != 1:
            errs.append("%s: matches %d of oneOf (need exactly 1)" % (path, n))
    if "not" in schema and not validate(schema["not"], doc, root, path):
        errs.append("%s: matches forbidden schema" % path)
    return errs


def load_schema(name):
    p = name if os.path.isabs(name) or os.path.exists(name) else os.path.join(SCHEMAS, name)
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def load_json(p):
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def check_manifests():
    schema = load_schema("manifest.schema.json")
    paths = sorted(glob.glob(os.path.join(ROOT, "plugins", "*", "*", "manifest.json")))
    bad = 0
    for p in paths:
        rel = os.path.relpath(p, ROOT)
        if "/_template/" in rel.replace("\\", "/"):
            continue
        try:
            m = load_json(p)
        except Exception as e:  # noqa: BLE001
            print("FAIL %s: %s" % (rel, e)); bad += 1; continue
        errs = validate(schema, m)
        d = os.path.dirname(p)
        expect_id = "%s/%s" % (os.path.basename(os.path.dirname(d)), os.path.basename(d))
        if m.get("id") != expect_id:
            errs.append("id %r must equal directory %r" % (m.get("id"), expect_id))
        if m.get("kind") and m.get("id", "").split("/")[0] != m.get("kind"):
            errs.append("kind %r must match id prefix" % m.get("kind"))
        need = REQUIRED_ACTIONS.get(m.get("kind"), set())
        missing = need - set((m.get("actions") or {}).keys())
        if missing:
            errs.append("missing actions %s" % sorted(missing))
        if not m.get("external_apis"):
            errs.append("external_apis empty: 不是插件，应并入主干")
        for a, target in (m.get("actions") or {}).items():
            if target != "manual" and not os.path.exists(os.path.join(d, target)):
                errs.append("action %s -> %s not found" % (a, target))
        usage = os.path.join(d, m.get("usage", "使用方法.md"))
        if not os.path.exists(usage):
            errs.append("usage file missing: %s" % os.path.basename(usage))
        if errs:
            bad += 1
            print("FAIL %s" % rel)
            for e in errs:
                print("     " + e)
        else:
            print("ok   %s  (%s %s %s)" % (rel, m["id"], m["version"], m["status"]))
    print("manifests: %d checked, %d failed" % (len(paths), bad))
    return 1 if bad else 0


CONFIG_SCHEMA = {
    "type": "object",
    "required": ["config_version", "apply", "data_dir", "runs_dir", "line", "currency", "soul", "judgment", "traffic", "affiliate", "caps"],
    "properties": {
        "config_version": {"const": 1},
        "apply": {"type": "boolean"},
        "timezone": {"type": "string"},
        "data_dir": {"type": "string", "minLength": 1},
        "runs_dir": {"type": "string", "minLength": 1},
        "line": {"enum": ["L1", "L2", "L3", "L4", "NA"]},
        "member": {"type": "string"},
        "currency": {"type": "string", "pattern": "^[A-Z]{3}$"},
        "soul": {"type": "string", "minLength": 1},
        "judgment": {"type": "object", "required": ["provider"],
                     "properties": {"provider": {"enum": ["local", "llm", "jev", "soul-api"]},
                                    "timeout_s": {"type": "number", "exclusiveMinimum": 0, "maximum": 60}}},
        "traffic": {"type": "object", "required": ["plugin"], "properties": {"plugin": {"type": "string"},
                    "report_source": {"enum": ["csv_export", "api"]}, "deploy_mode": {"enum": ["api", "manual"]}, "conversion_window_days": {"type": "integer", "minimum": 1, "maximum": 90}}},
        "affiliate": {"type": "object", "required": ["plugin"], "properties": {"plugin": {"type": "string"},
                      "commissions_source": {"enum": ["api", "csv_export", "json"]}}},
        "deploy": {"type": "object"},
        "caps": {"type": "object",
                 "properties": {"max_cpc": {"type": ["number", "null"], "exclusiveMinimum": 0},
                                "daily_budget": {"type": ["number", "null"], "exclusiveMinimum": 0},
                                "first_day_budget": {"type": ["number", "null"], "exclusiveMinimum": 0},
                                "stop_loss_spend": {"type": ["number", "null"], "exclusiveMinimum": 0},
                                "budget_step_pct": {"type": "number", "minimum": 0, "maximum": 100},
                                "autonomy": {"enum": ["within_caps", "propose_only"]}}},
    },
}


def check_config(path=None):
    p = path or os.path.join(ROOT, "config", "adspilot.json")
    if not os.path.exists(p):
        print("config not found: %s (用 example 复制一份)" % os.path.relpath(p, ROOT))
        return 1
    cfg = load_json(p)
    errs = validate(CONFIG_SCHEMA, cfg)
    for k in ("traffic", "affiliate", "judgment", "deploy"):
        sub = cfg.get(k) or {}
        for kk, vv in sub.items():
            if kk.endswith("_env") and isinstance(vv, str) and not re.match(r"^[A-Z][A-Z0-9_]*$", vv):
                errs.append("%s.%s 必须是环境变量名，不是值" % (k, kk))
    plug = cfg.get("traffic", {}).get("plugin")
    if plug and not os.path.exists(os.path.join(ROOT, "plugins", "traffic", plug, "manifest.json")):
        errs.append("traffic.plugin %r 没有对应目录" % plug)
    plug = cfg.get("affiliate", {}).get("plugin")
    if plug and not os.path.exists(os.path.join(ROOT, "plugins", "affiliate", plug, "manifest.json")):
        errs.append("affiliate.plugin %r 没有对应目录" % plug)
    if errs:
        print("FAIL config")
        for e in errs:
            print("     " + e)
        return 1
    print("ok   config (%s)" % os.path.relpath(p, ROOT))
    return 0


def check_file(schema_name, doc_path):
    schema = load_schema(schema_name)
    doc = load_json(doc_path)
    errs = validate(schema, doc)
    if errs:
        print("FAIL %s against %s" % (doc_path, os.path.basename(schema_name)))
        for e in errs:
            print("     " + e)
        return 1
    print("ok   %s against %s" % (doc_path, os.path.basename(schema_name)))
    return 0


FIXTURE_MAP = {
    "report": "report.schema.json",
    "judgment": "judgment.schema.json",
    "spec": "traffic-spec.schema.json",
    "traffic-report": "traffic-report.schema.json",
    "commissions": "commissions.schema.json",
    "manifest": "manifest.schema.json",
}


def check_all():
    rc = check_manifests()
    if os.path.exists(os.path.join(ROOT, "config", "adspilot.json")):
        rc |= check_config()
    rc |= check_config(os.path.join(ROOT, "config", "adspilot.example.json"))
    for p in sorted(glob.glob(os.path.join(ROOT, "tests", "fixtures", "*.json"))):
        base = os.path.basename(p)
        for prefix, schema in FIXTURE_MAP.items():
            if base.startswith(prefix + "."):
                rc |= check_file(schema, p)
    return rc


def main(argv):
    if not argv:
        print(__doc__); return 1
    cmd = argv[0]
    if cmd == "--manifests":
        return check_manifests()
    if cmd == "--config":
        return check_config(argv[1] if len(argv) > 1 else None)
    if cmd == "--file":
        return check_file(argv[1], argv[2])
    if cmd == "--all":
        return check_all()
    key = cmd.lstrip("-")
    if key in FIXTURE_MAP and len(argv) > 1:
        return check_file(FIXTURE_MAP[key], argv[1])
    print(__doc__); return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
