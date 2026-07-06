#!/usr/bin/env python3
"""Prepare or push historical paike activation data to the cloud API."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path("work/historical-data-activation")


def read_json(path: Path, fallback):
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")


def api_base(value: str) -> str:
    base = (value or "").strip().rstrip("/")
    if not base:
        return ""
    if not base.endswith("/api"):
        base = f"{base}/api"
    return base


def request_json(method: str, url: str, token: str, payload: dict, timeout: int = 120) -> dict:
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json; charset=utf-8",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
            return json.loads(body or "{}")
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code}: {body}") from error


def build_package(root: Path) -> dict:
    entries = read_json(root / "schedule_entries.json", [])
    finance_rows = read_json(root / "finance_rows.json", [])
    finance_summary_rows = read_json(root / "finance_summary_rows.json", [])
    finance_detail_rows = read_json(root / "finance_detail_rows.json", [])
    reconciliation = read_json(root / "reconciliation_report.json", {})
    risks = read_json(root / "risk_list.json", [])
    summary = read_json(root / "summary.json", {})
    report_text = (root / "activation_report.md").read_text(encoding="utf-8") if (root / "activation_report.md").exists() else ""
    generated_at = dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).isoformat()

    formal_entries = [row for row in entries if row.get("activationTrack") == "formal_lesson"]
    support_tasks = [row for row in entries if row.get("activationTrack") != "formal_lesson"]
    periods = sorted({row.get("period") for row in formal_entries if row.get("period")})
    teachers = sorted({row.get("teacherName") or row.get("teacher") for row in formal_entries if row.get("teacherName") or row.get("teacher")})
    file_label = f"历史排课盘活-{periods[0] if periods else 'unknown'}至{periods[-1] if periods else 'unknown'}"

    formal_payload = {
        "fileName": file_label,
        "fileLabel": file_label,
        "entries": formal_entries,
        "replaceTeacherKeys": teachers,
        "operatorName": "程志豪",
        "operatorUsername": "chengzhihao",
    }
    activation_state = {
        "schemaVersion": "historical-paike-activation-v1",
        "generatedAt": generated_at,
        "summary": summary,
        "formalImport": {
            "fileName": file_label,
            "teacherCount": len(teachers),
            "teachers": teachers,
            "periods": periods,
            "formalLessonCount": len(formal_entries),
        },
        "supportTasks": support_tasks,
        "financeRows": finance_rows,
        "financeSummaryRows": finance_summary_rows,
        "financeDetailRows": finance_detail_rows,
        "reconciliation": reconciliation,
        "risks": risks,
        "reportMarkdown": report_text,
    }
    return {
        "formalPayload": formal_payload,
        "activationState": activation_state,
        "formalCount": len(formal_entries),
        "supportTaskCount": len(support_tasks),
        "financeRowCount": len(finance_rows),
        "financeSummaryRowCount": len(finance_summary_rows),
        "financeDetailRowCount": len(finance_detail_rows),
        "reconciliationStudentMatchCount": len(reconciliation.get("studentMatches", [])) if isinstance(reconciliation, dict) else 0,
        "riskCount": len(risks),
        "teachers": teachers,
        "periods": periods,
    }


def write_plan(root: Path, package: dict) -> Path:
    plan_path = root / "cloud_import_plan.md"
    lines = [
        "# 历史数据云端导入计划",
        "",
        "## 本次准备写入",
        f"- 正式排课：{package['formalCount']} 节，写入排课系统正式课表。",
        f"- 辅助任务：{package['supportTaskCount']} 条，写入历史数据盘活报告，不进入正式课时核算。",
        f"- 财务识别：{package['financeRowCount']} 行，作为历史财务候选记录保存。",
        f"- 工资明细：{package['financeDetailRowCount']} 行，作为历史结算主要依据。",
        f"- 自动对账：{package['reconciliationStudentMatchCount']} 条学生/月度对应关系。",
        f"- 风险异常：{package['riskCount']} 条，进入AI复核池，不要求老师逐条核对。",
        f"- 老师：{'、'.join(package['teachers'])}",
        f"- 月份：{'、'.join(package['periods'])}",
        "",
        "## 写入策略",
        "- 按老师/月度替换旧 Excel 导入课程，保留人工修改课程。",
        "- 正式课程先进入排课系统；低风险教室缺失不阻塞。",
        "- 磨课、出门测、答疑、直播、托管、试听/免费课不计入正式课时。",
        "- 工资结算优先采用工资明细；排课展示优先采用老师课表。",
        "- 差异由系统自动解释、自动降置信度、自动进入AI复核池。",
        "",
        "## 推送命令",
        "```bash",
        "cd /Users/chengzhihao/Documents/Codex/2026-06-20-jrcedu-master",
        "JRC_BASE_URL='https://你的系统域名' JRC_API_TOKEN='你的登录Token' /Users/chengzhihao/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/push_historical_paike_activation.py --push",
        "```",
    ]
    plan_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return plan_path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=str(ROOT))
    parser.add_argument("--push", action="store_true", help="Actually push to cloud API. Default only prepares payload files.")
    parser.add_argument("--base-url", default=os.environ.get("JRC_BASE_URL", ""))
    parser.add_argument("--token", default=os.environ.get("JRC_API_TOKEN", ""))
    args = parser.parse_args()

    root = Path(args.root)
    package = build_package(root)
    formal_path = root / "cloud_formal_import_payload.json"
    activation_path = root / "cloud_activation_state.json"
    write_json(formal_path, package["formalPayload"])
    write_json(activation_path, package["activationState"])
    plan_path = write_plan(root, package)

    result = {
        "ok": True,
        "mode": "prepared",
        "formalPayload": str(formal_path),
        "activationState": str(activation_path),
        "plan": str(plan_path),
        "formalCount": package["formalCount"],
        "supportTaskCount": package["supportTaskCount"],
        "financeRowCount": package["financeRowCount"],
        "financeDetailRowCount": package["financeDetailRowCount"],
        "reconciliationStudentMatchCount": package["reconciliationStudentMatchCount"],
        "riskCount": package["riskCount"],
    }

    if not args.push:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    base = api_base(args.base_url)
    token = args.token.strip()
    if not base or not token:
        print(json.dumps({
            **result,
            "ok": False,
            "mode": "push-blocked",
            "error": "missing JRC_BASE_URL or JRC_API_TOKEN",
        }, ensure_ascii=False, indent=2))
        return 2

    formal_response = request_json("POST", f"{base}/paike/formal-import", token, package["formalPayload"])
    activation_response = request_json("PUT", f"{base}/module-data", token, {
        "storeKey": "paike-historical-activation-v1",
        "moduleKey": "paike",
        "payload": package["activationState"],
        "replaceMode": "replace",
        "operatorName": "程志豪",
        "operatorUsername": "chengzhihao",
    })
    print(json.dumps({
        **result,
        "mode": "pushed",
        "formalResponse": formal_response,
        "activationResponse": activation_response,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
