"""Interface catalog. Plugin discovery comes exclusively from manifests."""
import argparse
import json
from pathlib import Path

from core.selfcheck.validate import validate

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / 'schemas/interfaces.json'
FIXTURES = ROOT / 'tests/fixtures/interfaces'
CODES = {"0": "success", "2": "needs_human", "3": "retry", "4": "configuration", "1": "error"}
CORE = {
    "agent.selfcheck": ("core/agent/selfcheck.py", "--quick --json", "自检 JSON"),
    "launch.run": ("core/launch/launch.py", "{step} --brief={brief:json} --content={content:json} --offers-json={offers:json} --host={host} --slug={slug} --user={user} --pick={pick} --country={country} --language={language} --top={top} --enable={enable:flag} --all={all:flag} --config={config}", "开局步骤结果"),
    "lp.check": ("core/lp/lp_check.py", "{html:text} --min-words={min_words} --json", "检查项及 verdict"),
    "judge.judge": ("core/judge/judge.py", "--node={node} --state={state:json} --choices={choices:json} --evidence={evidence:csv} --provider={provider} --config={config}", "judgment.response"),
    "ledger.reconcile": ("core/ledger/reconcile.py", "--commissions={commissions:json} --db={db} --conversion-name={conversion_name} --window-days={window_days}", "转化、撤销、摘要"),
    "ledger.subid": ("core/ledger/subid.py", "{operation} {argument} --db={db} --n={n} --since={since} --out={out} --url={url} --token={token} --campaign={campaign}", "mint/lookup/stats/record/import/pull/export 的结果"),
    "loop.run": ("core/loop/daily.py", "--config={config} --run-id={run_id}", "日志；结果取 runs/<id>/report.json"),
    "loop.ack": ("core/loop/daily.py", "--ack={run_id} --config={config}", "确认的动作数"),
    "selfcheck.validate": ("core/selfcheck/validate.py", "--file {schema} {document:json}", "文本判定转 JSON"),
}
# Bindings describe the actual script argv. Unset optional fields are omitted.
# :json and :text materialize request data in a private temporary directory.
PLUGIN = {
    "affiliate.offers": ("--json={offers:json} --advertiser-ids={advertiser_ids:csv} --campaign-ids={campaign_ids:csv} --with-links={with_links:flag} --with-terms={with_terms:flag}", "offers 数组"),
    "affiliate.link": ("--base={base} --token={token}", "含 sub-id 的链接"),
    "affiliate.commissions": ("--csv={csv:text} --days={days}", "commissions"),
    "affiliate.chargebacks": ("--commissions={commissions:json} --days={days}", "撤销与未关联项"),
    "deploy.setup": ("--host={host} --teardown={teardown:flag}", "部署步骤、资源状态"),
    "deploy.publish": ("--page={page:text} --slug={slug} --site={site:flag} --site-name={site_name} --contact={contact} --offers={offers:json}", "host、已推页面或 offer 数"),
    "deploy.status": ("", "host 与 health"),
    "judgment.judge": ("--config={judgment_config:literal}", "stdin judgment.request → 提供者选择或感知向量"),
    "keywords.suggest": ("suggest --seed={seed:csv} --url={url} --country={country} --language={language} --limit={limit} --batch={batch:json}", "候选词 rows 或分组 results"),
    "keywords.volume": ("volume --keywords={keywords:csv} --country={country} --language={language}", "已有词的历史指标 rows"),
    "traffic.spec": ("--brief={brief:json} --config={config}", "traffic-spec"),
    "traffic.deploy": ("--spec={spec:json} --actions={actions:json} --remove-campaign={remove_campaign} --enable-campaign={enable_campaign} --pause-campaign={pause_campaign} --enable={enable:flag} --config={config}", "投放变更计划或执行结果"),
    "traffic.report": ("--csv={csv:text} --currency={currency}", "traffic-report"),
    "traffic.report_api": ("--days={days} --currency={currency}", "traffic-report 或离线计划"),
    "traffic.budget": ("--new={brief:json} --campaigns={campaigns:flag} --new-customer={new_customer:flag}", "预算建议或计划"),
    "traffic.convert": ("--conversions={conversions:json} --out={out} --timezone={timezone}", "本地 CSV/调整 CSV；仅返回行数与文件引用"),
    "traffic.convert_api": ("--conversions={conversions:json} --remove-action={remove_action} --timezone={timezone} --conversion-name={conversion_name} --transport={transport}", "转化上传/撤销结果"),
    "ipintel.lookup": ("", "stdin IP 列表 → rows 情报记录"),
}
EXISTING = {
    "judge.judge": "judgment", "loop.run": "report", "traffic.spec": "traffic-spec",
    "traffic.report": "traffic-report",
}


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def short_id(identifier):
    parts = identifier.split(".")
    return parts[0] + "." + parts[-1]


def entry(identifier, script, template, apis, status):
    key = short_id(identifier)
    prefix = "schemas/interfaces/" + key
    existing = EXISTING.get(key)
    response = "schemas/" + existing + ".schema.json" if existing else prefix + ".response.schema.json"
    return {"id": identifier, "script": script, "argv_template": template.split(),
            "request_schema": prefix + ".request.schema.json", "response_schema": response,
            "exit_codes": CODES, "dry_run_default": True, "external_apis": apis, "status": status,
            "selftest": ["adspilot.py", identifier, "--selftest"],
            "fixture": "tests/fixtures/interfaces/" + identifier + ".request.json"}


def discover():
    entries = [entry(i, script, template, [], "alpha") for i, (script, template, _) in CORE.items()]
    for path in sorted((ROOT / "plugins").glob("*/*/manifest.json")):
        manifest = read(path)
        for action, target in manifest["actions"].items():
            key = manifest["kind"] + "." + action
            identifier = manifest["id"].replace("/", ".") + "." + action
            template, _ = PLUGIN[key]
            entries.append(entry(identifier, (path.parent / target).relative_to(ROOT).as_posix(),
                                 template, manifest["external_apis"], manifest["status"]))
    return sorted(entries, key=lambda r: r["id"])


def check_interfaces():
    entries = discover()
    errors = []
    if read(CATALOG) != entries:
        errors.append("interfaces.json differs from manifest discovery")
    for row in entries:
        for field in ("script", "request_schema", "response_schema", "fixture"):
            if not (ROOT / row[field]).is_file():
                errors.append(row["id"] + ": missing " + field)
        if row["selftest"] != ["adspilot.py", row["id"], "--selftest"] or not (ROOT / "adspilot.py").is_file():
            errors.append(row["id"] + ": missing selftest")
    for error in errors:
        print(error)
    print("interfaces: %d checked, %d failed" % (len(entries), len(errors)))
    return int(bool(errors))


def check_fixtures():
    rows = read(CATALOG)
    # K1 includes the IP contract and its examples before K2 installs a provider.
    if not any(row["id"] == "ipintel.ipapi-is.lookup" for row in rows):
        rows.append(entry("ipintel.ipapi-is.lookup", "", "", [], "alpha"))
    errors = []
    for row in rows:
        for direction in ("request", "response"):
            path = FIXTURES / (row["id"] + "." + direction + ".json")
            if not path.is_file() or validate(read(ROOT / row[direction + "_schema"]), read(path)):
                errors.append(path.name)
    for error in errors:
        print("FAIL fixture " + error)
    print("interface fixtures: %d checked, %d failed" % (len(rows) * 2, len(errors)))
    return int(bool(errors))



# What was actually documented by 2.0.21. Kept separate from the new JSON contract.
BASELINE = {
    "agent.selfcheck": ("[--quick] [--json]", "本机环境、配置", "无"),
    "launch.run": ("deploy/offers/page/campaign/verify/go/teardown/status [步骤选项] [--apply] [--config]", "brief/content/offers 文件、开局状态", "无"),
    "lp.check": ("HTML [--min-words N] [--json]", "一个 HTML 文件", "无"),
    "judge.judge": ("--node --state FILE --choices FILE [--evidence] [--provider] [--soul] [--config]", "节点名、状态及候选 JSON", "judgment"),
    "ledger.reconcile": ("--commissions FILE [--db] [--batch] [--out] [--conversion-name] [--window-days]", "commissions 与本地 SQLite", "输入 commissions；输出无"),
    "ledger.subid": ("mint/record/import/pull/lookup/stats/export [--db] [动作选项]", "映射 JSONL、本地 SQLite 或 token", "无"),
    "loop.run": ("[--dry-run/--apply] [--config] [--run-id]", "配置、本地报表、账本", "输出 report"),
    "loop.ack": ("--ack RUN_ID [--config]", "run ID、账本", "无"),
    "selfcheck.validate": ("--all/--manifests/--config/--file/--report/--judgment/--spec/--traffic-report/--commissions", "schema 与待验 JSON", "各被校验对象已有 schema"),
    "affiliate.offers": ("[--json FILE] [--out] [供应商筛选项]", "本地 offers 数组或服务商账户", "无"),
    "affiliate.link": ("--base URL --token SUB_ID", "联盟链接与归因标记", "无"),
    "affiliate.commissions": ("[--csv FILE/--days N] [--out]", "CSV 或服务商账户", "输出 commissions"),
    "affiliate.chargebacks": ("[--commissions FILE/--days N] [--out]", "commissions 或服务商账户", "输入 commissions；输出多 unlinked"),
    "deploy.setup": ("[--host] [--teardown] [--apply]", "主机名、本地部署记录和账户", "无"),
    "deploy.publish": ("[--page FILE --slug] [--site --site-name --contact] [--offers FILE]", "HTML、站点元资料或 offers JSON", "无"),
    "deploy.status": ("[--roundtrip --offer --slug]", "本地部署记录、健康端点", "无"),
    "judgment.judge": ("[--config JSON]；stdin JSON", "judgment.request", "输入 judgment；感知响应无"),
    "keywords.suggest": ("suggest [--seed CSV --url/--batch FILE] [--country --language --limit --out]", "种子词、URL 或批量 JSON", "无"),
    "keywords.volume": ("volume --keywords CSV [--country --language --out]", "词列表与账户区域", "无"),
    "traffic.spec": ("--brief FILE [--config --soul --out]", "brief JSON 与 SOUL", "输出 traffic-spec"),
    "traffic.deploy": ("--spec/--actions/--remove-campaign/--enable-campaign/--pause-campaign [--enable --validate-only --apply --config]", "规格、待办或系列 ID", "spec 输入已有；操作响应无"),
    "traffic.report": ("--csv FILE [--currency --account --out]", "平台导出 CSV", "输出 traffic-report"),
    "traffic.report_api": ("[--days --currency --out] [--apply]", "账户、回溯天数", "输出 traffic-report"),
    "traffic.budget": ("--new FILE/--campaigns [--new-customer --out --apply]", "budget brief 或账户系列", "无"),
    "traffic.convert": ("--conversions FILE --out CSV [--timezone]", "转化 JSON、账本", "无"),
    "traffic.convert_api": ("--conversions FILE/--remove-action [--transport --conversion-name --timezone --validate-only --apply]", "转化 JSON、本地账本或操作名", "无"),
    "ipintel.lookup": ("--input/标准输入 [--apply]", "IP 列表", "仅契约"),
}


def inventory(entries):
    lines = ["# 接口盘点", "", "注册表由插件 manifest 与主干入口生成。命令中的文件参数由统一入口根据 JSON 请求写入临时目录。所有行均有请求、响应 schema 与独立样例自测。", "",
             "| 接口 | 原脚本 | 原参数 | 原输入 → 输出 | 基线 schema | 原脚本自测 |",
             "|---|---|---|---|---|---|"]
    for row in entries:
        i = row["id"]
        shape = CORE[i][2] if i in CORE else PLUGIN[short_id(i)][1]
        has = "--selftest" in (ROOT / row["script"]).read_text(encoding="utf-8")
        args, inputs, original = BASELINE.get(short_id(i), (" ".join(row["argv_template"]), "JSON", "无"))
        lines.append("| `%s` | `%s` | `%s` | %s → %s | %s | %s |" % (i, row["script"], args, inputs, shape, original, "有" if has else "无；统一入口样例"))
    lines += ["", "## 使用方法", "", "列出接口用 `python3 adspilot.py --list`。例如 `python3 adspilot.py judge.judge --input tests/fixtures/interfaces/judge.judge.request.json`。每个接口可用同名请求样例或运行 `python3 adspilot.py <id> --selftest`。stdout 为 JSON，退出码 0/2/3/4/1 分别表示成功、需本人、外部失败、配置错误、其他错误。",
              "", "默认离线。脚本原本必须联系外部服务的动作返回含 dry_run、interface、action 的计划；它只说明待执行的动作。可在本地重放的数据直接调用原脚本。请求和本地配置必须同时允许 apply 才会联网或提交写动作。日循环按指定配置留下本地报告。服务商凭据仅由环境传入；私有账本/转化文件通过 data/ 或 runs/ 下文件引用，不把点击标识放进请求。", "",
              "仅合规过滤。Cloudflare 的 roundtrip 和开局 verify 原脚本会走测试点击；接口不开放该探测。开局的 campaign/deploy/offers/page/go/teardown/status 使用 step，账本的 mint/stats/lookup/record/import/pull/export 使用 operation；含点击标识的数据仅用本机私有文件导入。", "",
              "生成注册表和本盘点：`python3 -m core.agent.interfaces --generate`；随后跑 `python3 core/selfcheck/validate.py --interfaces` 与 `python3 adspilot.py --selftest`。"]
    if not any(r["id"].startswith("ipintel.") for r in entries):
        lines += ["", "ipintel.lookup 在本版只有契约、schema 与样例；装入提供者 manifest 后登记可调用接口。"]
    return "\n".join(lines) + "\n"


def generate():
    entries = discover()
    CATALOG.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "docs/接口盘点.md").write_text(inventory(entries), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--generate", action="store_true", required=True)
    parser.parse_args()
    generate()
