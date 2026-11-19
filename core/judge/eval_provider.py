#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
判断插件离线/在线对比评测（感知层 L2 门槛检查）

用法：
  python3 core/judge/eval_provider.py [--provider local] [--soul soul/default.soul.md]
                                      [--benchmark tests/fixtures/judge-benchmark.json]
                                      [--config config/adspilot.json] [--apply] [--out FILE]
  python3 core/judge/eval_provider.py --selftest

说明：
  - 默认 provider 为 `local`，纯离线计算与校验。
  - 指定非 `local` provider 时需显式传 `--apply`（防无授权外发真实账户数据；发前主干仍强制脱敏）。
  - 指标按正典 reference/ilang/ilang_judge_validator.py 计算：
    schema_rate >= 0.99、mode_acc >= 0.90、MAE <= 0.12、boundary_acc >= 0.80、JCS >= 0.90。
"""
import argparse
import http.server
import json
import os
from pathlib import Path
import sys
import threading

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "core" / "judge"))
sys.path.insert(0, str(ROOT / "reference" / "ilang"))

import judge as J  # noqa: E402
import ilang_judge_validator as JV  # noqa: E402

DIMS = JV.DIMS


def load_config(config_path):
    if config_path:
        return json.loads(Path(config_path).read_text(encoding="utf-8"))
    default_cfg = ROOT / "config" / "adspilot.json"
    if default_cfg.is_file():
        return json.loads(default_cfg.read_text(encoding="utf-8"))
    return json.loads((ROOT / "config" / "adspilot.example.json").read_text(encoding="utf-8"))


def evaluate(provider, soul_path, benchmark_path, cfg, allow_external=False):
    if provider != "local" and not allow_external:
        raise PermissionError("evaluating external provider %r requires --apply" % (provider,))
    soul = J.load_soul(str(soul_path), cfg)
    raw = json.loads(Path(benchmark_path).read_text(encoding="utf-8"))
    cases = raw.get("cases") if isinstance(raw, dict) else raw
    if not isinstance(cases, list) or not cases:
        raise ValueError("benchmark must contain a non-empty 'cases' array")

    case_results = []
    schema_ok = 0
    mode_hits = 0
    choice_hits = 0
    boundary_total = 0
    boundary_hits = 0
    fallback_count = 0
    disagree_count = 0
    maes = []

    for idx, case in enumerate(cases):
        cid = str(case.get("id") or ("case-%d" % idx))
        node = case["node"]
        state = case.get("state") or {}
        choices = case["choices"]
        caps = case.get("caps") if "caps" in case else cfg.get("caps")
        evidence = case.get("evidence") or []
        gold_v = case["gold_v"]
        gold_mode = case.get("gold_mode") or JV.f_v5(gold_v)
        gold_choice = case.get("gold_choice")
        is_boundary = bool(case.get("boundary"))

        resp = J.judge(
            node,
            state,
            choices,
            cfg=cfg,
            soul=soul,
            caps=caps,
            evidence=evidence,
            provider=provider,
            req_id="eval-%s" % cid,
        )
        pred_v = resp["judge"]["v"]
        pred_mode = resp["mode_local"]
        pred_choice = resp["choice"]
        is_fallback = bool(resp.get("fallback")) or (resp.get("provider") != provider)
        if is_fallback:
            fallback_count += 1

        try:
            JV.parse_judge_block(J.to_judge_text(resp).splitlines())
            schema_valid = True
        except ValueError:
            schema_valid = False

        if JV.f_v5(pred_v) != pred_mode and not resp.get("boundary_hit"):
            disagree_count += 1

        if schema_valid:
            schema_ok += 1

        m_hit = pred_mode == gold_mode
        if m_hit:
            mode_hits += 1

        if isinstance(gold_choice, list):
            c_hit = pred_choice in gold_choice
        elif gold_choice is None:
            c_hit = True
        else:
            c_hit = pred_choice == gold_choice
        if c_hit:
            choice_hits += 1

        if is_boundary:
            boundary_total += 1
            if m_hit:
                boundary_hits += 1

        case_mae = sum(abs(float(pred_v[d]) - float(gold_v[d])) for d in DIMS) / len(DIMS)
        maes.append(case_mae)

        case_results.append({
            "id": cid,
            "node": node,
            "pred_choice": pred_choice,
            "gold_choice": gold_choice if not isinstance(gold_choice, list) else gold_choice[0],
            "pred_mode": pred_mode,
            "gold_mode": gold_mode,
            "mae": round(case_mae, 4),
            "schema_valid": schema_valid,
            "boundary": is_boundary,
            "fallback": is_fallback,
        })

    n = len(cases)
    schema_rate = round(schema_ok / n, 4)
    mode_acc = round(mode_hits / n, 4)
    choice_acc = round(choice_hits / n, 4)
    mae = round(sum(maes) / n, 4)
    vector_score = round(max(0.0, 1.0 - (sum(maes) / n) / 0.25), 4)
    boundary_acc = round((boundary_hits / boundary_total) if boundary_total else 1.0, 4)
    jcs = round(0.20 * schema_rate + 0.40 * (mode_hits / n) + 0.20 * max(0.0, 1.0 - (sum(maes) / n) / 0.25) + 0.20 * ((boundary_hits / boundary_total) if boundary_total else 1.0), 4)
    l2_pass = bool(
        (schema_ok / n) >= 0.99
        and (mode_hits / n) >= 0.90
        and (sum(maes) / n) <= 0.12
        and ((boundary_hits / boundary_total) if boundary_total else 1.0) >= 0.80
        and jcs >= 0.90
        and (provider == "local" or fallback_count == 0)
    )

    try:
        bm_ref = Path(benchmark_path).resolve().relative_to(ROOT).as_posix()
    except ValueError:
        bm_ref = Path(benchmark_path).name

    return {
        "type": "adspilot.judge.eval",
        "provider": provider,
        "soul": soul["id"],
        "benchmark": bm_ref,
        "n": n,
        "schema_rate": schema_rate,
        "mode_acc": mode_acc,
        "choice_acc": choice_acc,
        "mae": mae,
        "vector_score": vector_score,
        "boundary_acc": boundary_acc,
        "jcs": jcs,
        "l2_pass": l2_pass,
        "fallback_count": fallback_count,
        "disagree_count": disagree_count,
        "cases": case_results,
    }


def selftest():
    J.console_safe()
    cfg = json.loads((ROOT / "config" / "adspilot.example.json").read_text(encoding="utf-8"))
    bm = ROOT / "tests" / "fixtures" / "judge-benchmark.json"
    soul_path = ROOT / "soul" / "default.soul.md"

    # 1. Local evaluation passes L2 cleanly
    res_local = evaluate("local", soul_path, bm, cfg, allow_external=False)
    assert res_local["l2_pass"] is True and res_local["jcs"] >= 0.90, res_local

    # 2. External provider requires apply=True
    gated = False
    try:
        evaluate("llm", soul_path, bm, cfg, allow_external=False)
    except PermissionError:
        gated = True
    assert gated

    # 3. External mock provider failing returns fallback_count > 0 -> l2_pass False (never silently pass local)
    env_keys = ("LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL", "NO_PROXY", "no_proxy")
    old = {k: os.environ.get(k) for k in env_keys}
    os.environ["LLM_BASE_URL"] = ""
    os.environ["LLM_API_KEY"] = ""
    os.environ["LLM_MODEL"] = ""
    try:
        res_unconf = evaluate("llm", soul_path, bm, cfg, allow_external=True)
    finally:
        for k, v in old.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
    assert res_unconf["fallback_count"] == res_unconf["n"] and res_unconf["l2_pass"] is False

    # 4. External HTTP mock answering valid vectors for all cases -> l2_pass True, fallback_count 0
    cases = json.loads(bm.read_text(encoding="utf-8"))["cases"]
    by_node = {}
    for c in cases:
        by_node.setdefault(c["node"], []).append(c)

    class H(http.server.BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))).decode("utf-8"))
            prompt = ((body.get("messages") or [{}])[0]).get("content", "")
            picked = cases[0]
            for c in cases:
                choices_line = "Choices (pick exactly one id): " + ", ".join(ch["id"] for ch in c["choices"])
                if (
                    ("Decision node: %s\n" % c["node"]) in prompt
                    and json.dumps(c.get("state") or {}, ensure_ascii=False)[:120] in prompt
                    and choices_line in prompt
                ):
                    picked = c
                    break
            v = picked["gold_v"]
            vec = "V:[" + ",".join("%s=%.2f" % (d, float(v[d])) for d in DIMS) + "]"
            mode = JV.f_v5(v)
            ch = picked["gold_choice"][0] if isinstance(picked["gold_choice"], list) else (picked["gold_choice"] or picked["choices"][0]["id"])
            txt = "::JUDGE{v5.0}\n%s\nM:%s|conf:0.85\nR:eval_mock_ok\nCHOICE:%s\n" % (vec, mode, ch)
            raw = json.dumps({"choices": [{"message": {"content": txt}}]}).encode("utf-8")
            self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(raw)))
            self.end_headers(); self.wfile.write(raw)

    import urllib.request
    orig_urlopen = urllib.request.urlopen
    srv = None
    try:
        try:
            srv = http.server.HTTPServer(("127.0.0.1", 0), H)
            threading.Thread(target=srv.serve_forever, daemon=True).start()
            url = "http://127.0.0.1:%d/v1" % srv.server_address[1]
        except PermissionError:
            url = "http://127.0.0.1:0/v1"
            def _fake_urlopen(req, timeout=8):
                body = json.loads((req.data or b"{}").decode("utf-8"))
                prompt = ((body.get("messages") or [{}])[0]).get("content", "")
                picked = cases[0]
                for c in cases:
                    choices_line = "Choices (pick exactly one id): " + ", ".join(ch["id"] for ch in c["choices"])
                    if (
                        ("Decision node: %s\n" % c["node"]) in prompt
                        and json.dumps(c.get("state") or {}, ensure_ascii=False)[:120] in prompt
                        and choices_line in prompt
                    ):
                        picked = c
                        break
                v = picked["gold_v"]
                vec = "V:[" + ",".join("%s=%.2f" % (d, float(v[d])) for d in DIMS) + "]"
                mode = JV.f_v5(v)
                ch = picked["gold_choice"][0] if isinstance(picked["gold_choice"], list) else (picked["gold_choice"] or picked["choices"][0]["id"])
                txt = "::JUDGE{v5.0}\n%s\nM:%s|conf:0.85\nR:eval_mock_ok\nCHOICE:%s\n" % (vec, mode, ch)
                raw = json.dumps({"choices": [{"message": {"content": txt}}]}).encode("utf-8")
                class _Resp:
                    def __enter__(self): return self
                    def __exit__(self, *a): pass
                    def read(self): return raw
                return _Resp()
            urllib.request.urlopen = _fake_urlopen
        os.environ.update({"LLM_BASE_URL": url, "LLM_API_KEY": "selftest-dummy", "LLM_MODEL": "mock", "NO_PROXY": "127.0.0.1,localhost", "no_proxy": "127.0.0.1,localhost"})
        res_mock = evaluate("llm", soul_path, bm, cfg, allow_external=True)
    finally:
        urllib.request.urlopen = orig_urlopen
        if srv is not None:
            srv.shutdown(); srv.server_close()
        for k, v in old.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
    assert res_mock["fallback_count"] == 0 and res_mock["l2_pass"] is True and res_mock["jcs"] >= 0.90, res_mock

    print("eval_provider selftest: local jcs=%.4f l2=%s | mock_llm jcs=%.4f l2=%s | unconf_fallback=%d -> OK" % (
        res_local["jcs"], res_local["l2_pass"], res_mock["jcs"], res_mock["l2_pass"], res_unconf["fallback_count"]))
    return 0


def main(argv=None):
    J.console_safe()
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--provider", default="local")
    p.add_argument("--soul", default="soul/default.soul.md")
    p.add_argument("--benchmark", default="tests/fixtures/judge-benchmark.json")
    p.add_argument("--config")
    p.add_argument("--out")
    p.add_argument("--apply", action="store_true")
    p.add_argument("--selftest", action="store_true")
    args = p.parse_args(argv)
    if args.selftest:
        return selftest()
    try:
        cfg = load_config(args.config)
        res = evaluate(args.provider, args.soul, args.benchmark, cfg, allow_external=args.apply)
    except PermissionError as e:
        print(str(e), file=sys.stderr)
        return 4
    except (OSError, ValueError, KeyError, TypeError) as e:
        print("eval failed: %s" % e, file=sys.stderr)
        return 1
    if args.out:
        Path(args.out).write_text(json.dumps(res, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(res, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
