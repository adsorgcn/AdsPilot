#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Centralized fail-closed write gate shared by raw daily.py and structured interfaces.

Only explicit literal boolean request apply=True (without dry_run=True) paired with
literal boolean config["apply"] is True unlocks external writes or executable handoffs.
Strings, numbers, missing keys/files, and conflicting flags never coerce and fail closed.
"""


class WriteGateError(ValueError):
    def __init__(self, message, code=4):
        super().__init__(message)
        self.code = code


def resolve_write_mode(cfg, request_apply=False, request_dry_run=False, require_config_apply=False):
    """Resolve whether external writes/handoffs are permitted.

    Returns:
      False -> preview mode (dry-run; no external mutations or executable handoffs)
      True  -> write-permitted mode (dual opt-in verified)
    Raises:
      WriteGateError on missing/invalid config, non-boolean apply fields, conflicting flags,
      or requested apply without literal boolean config["apply"] is True.
    """
    if cfg is None or not isinstance(cfg, dict):
        raise WriteGateError("config missing or not a JSON object", code=4)

    if type(request_apply) is not bool:
        raise WriteGateError("request apply field must be a literal boolean", code=1)
    if type(request_dry_run) is not bool:
        raise WriteGateError("request dry_run field must be a literal boolean", code=1)

    has_cfg_apply = "apply" in cfg
    if has_cfg_apply and type(cfg["apply"]) is not bool:
        raise WriteGateError("config.apply must be a literal boolean", code=4)
    if require_config_apply and not has_cfg_apply:
        raise WriteGateError("config.apply is required and must be a literal boolean", code=4)

    if request_apply and request_dry_run:
        raise WriteGateError("conflicting flags: apply and dry_run cannot both be true", code=1)

    if not request_apply:
        return False

    if cfg.get("apply") is not True:
        raise WriteGateError("apply requested, but config.apply must be literal boolean true", code=4)

    return True
