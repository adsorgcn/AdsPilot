#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
I-Lang Grammar & Registry Validator
Implements the mechanical checks of SPEC-v5.0-PATCH-2 (declaration grammar and
registries) plus the v3.0 operation tables:

  PATCH-2 §1.1  block shapes inline / header_body / brace_span, shape selection
                by lookahead, FLUSH-LEFT-BODY rule (incl. same-line trailing body)
  PATCH-2 §1.2  body forms B1-B8 by first-token dispatch; B6 prose only inside
                prose-body types [::LESSON, ::MODULE, ::LIST, ::RULE annotation,
                ::OBJECTIVE narrative fields]
  PATCH-2 §1.5/§1.6  declaration registry: 32 structural + 13 narrative
                (::LATENCY / ::CONFIDENCE tolerated per §1.6 pending registration)
  PATCH-2 §1.7  document header ::ILANG::<ver>, [TAG:value] preamble lines,
                temporal prefix T[n] and T[n]=value, `=>` chain continuation,
                narrative pipe payload
  PATCH-2 §2.2  entity casing @[A-Z][A-Z0-9_]* (E300); custom entities SHOULD
                be introduced via ::STATE (WARN)
  v3.0 §3/§4    operation verbs (88) + Greek aliases (13) -> E304 / E305;
                modifier keys (29 core) -> E302 (ERROR, see NOTE)
  v4.1 §4.4     media profile (20 keys) accepted only where the operation
                target is @IMG, @VID or @AUD; §5.4 registers those three
  v3.0 §2.4     a quoted value is opaque: commas, pipes, equals signs and
                brackets inside "..." (with the §2.4 escapes) are not syntax,
                so they raise no E302 / E304
  v4.2 §4.5/4.6 a ::STATE body line keyed pts / bnd / vtx / msk declares a
                region: line-form checks (E300) and value checks (E303), all
                WARN so no earlier document turns invalid; an entity named on
                a ::LIST line that a MERGE on a media target consumes through
                src= is an image layer, i.e. a media target; the §4.6.3 frame
                rules are reported as WARN where the text alone decides them

Static scope: E200 (unresolvable name) and E201 (environment availability) are
runtime semantics, intentionally out of scope. E202 (rebinding a registered
name) is reported as a WARN candidate when a document ::STATE-introduces a
Tier-1/2 name.

NOTE on E302: the core modifier registry is closed at 29 (no_new_modifiers
reaffirmed 2026-08-11; the v4.0-FINAL §7 examples that used ad-hoc keys were
rewritten to registered ones). SPEC-v4.1-MEDIA-PROFILE (2026-09-12) registers a
separate 20-key media profile as MOD-COUNT, by the procedure that registered
::LIST; it is counted apart from the 29 and gated on a media target. Unknown operation
modifier keys are ERROR.

Input modes (auto-detected per file):
  raw    first nonblank line is ::ILANG::  -> whole file is I-Lang
  mixed  Markdown carrying bare I-Lang blocks (PATCH style) and/or ``` fences.
Fenced blocks are linted when their first nonblank line looks like I-Lang
('::', 'T[', or a bracket group); other fences are counted as skipped and
reported — never silently dropped.

Usage:
  python3 ilang_grammar_validator.py --selftest
  python3 ilang_grammar_validator.py --lint FILE [FILE ...] [--json] [--strict]
  python3 ilang_grammar_validator.py --canon REPO_DIR [--json] [--strict]

Exit code: 1 if any ERROR (with --strict, also if any WARN), else 0.
Single file, stdlib only.
"""

import argparse
import json
import re
import sys

# ------------------------------------------------------------------ registries
REGISTRY_V3 = ("STATE TRUST ALIVE MEMORY GENE GENE_MUTABLE RULE ACTIVATE "
               "FACT LESSON PROGRESS PRIORITY DECAY IMMUNE").split()
REGISTRY_V4 = "UNTRUSTED BUDGET STATUS OBJECTIVE RUBRIC EVIDENCE PRIOR FALLBACK".split()
REGISTRY_V5 = "JUDGE BOUNDARY DIM MODE FUNC SCHEMA CASE CLAUSE MODULE".split()
REGISTRY_AMEND = ["LIST"]
DECL_STRUCTURAL = set(REGISTRY_V3 + REGISTRY_V4 + REGISTRY_V5 + REGISTRY_AMEND)

DECL_NARRATIVE = set("SAY THINK ACT DECIDE DISCOVER CREATE EVENT SILENCE "
                     "META IRONY FORESHADOW CALLBACK EMOTION_FIELD".split())
NARR_DOUBLE = set("SAY THINK ACT DECIDE DISCOVER CREATE".split())
TERMINATORS = {"END_UNTRUSTED"}          # block terminator, not a declaration
META_DECLS = {"GRAMMAR", "BODY", "REGISTRY"}  # spec-authoring set, counted separately
TOLERATED_ANNOT = {"LATENCY", "CONFIDENCE"}  # §1.6: tolerated pending registration
PROSE_BODY = {"LESSON", "MODULE", "LIST", "RULE", "OBJECTIVE"}  # B6 whitelist

VERBS = set(("READ WRIT GET DEL LIST COPY MOVE STRM CACH SYNC SEND RUN "
             "FMT CONV SPLIT MERGE MAP FILT SORT DEDU FLAT NEST CHNK REDU "
             "PIVT TRNS ENCD DECD HASH CMPR EXPN XLAT REWR DIFF "
             "SCAN MTCH CNT STAT EVAL SCOR RANK TRND CORR FRCS ANOM SENT "
             "CLST BNCH AUDT VALD CLSF "
             "CREA DRFT EXPD SHRT PARA STYL TMPL FILL EXTC GEN "
             "PLAN DECI CHEK FIX DPLO SAVE REVW LERN TEST PARS LOOP WAIT "
             "OUT DISP EXPT PRNT LOG LINK SET TAG GRP EMBD "
             "HELP DESC INTR NOOP BATC").split())
ALIASES = set("Σ Δ φ ∇ λ ∂ μ ψ ξ ζ θ Ω Π".split())
GREEKISH = "ΣΔφ∇λ∂μψξζθΩΠ"
MODIFIERS = set(("src dst path fmt lng sty ton len lim off top bot srt grp "
                 "whr mch exc dep rng typ enc cap pri col row frm to scp op").split())
# v4.1 §4.4 (SPEC-v4.1-MEDIA-PROFILE): a separate, target-gated table. Counted apart from the closed core 29
# and in force only where the operation target resolves to a media entity (TIER4).
MEDIA_PROFILE = set(("sbj act plc txt pov fcl mvt lgt pal mdm "
                     "asp rsl qly dur fps sed adh ref dlg sfx").split())
# v4.2 §4.5.3 (SPEC-v4.2-MEDIA-REGIONS-AND-LAYERS): region body keys. Declaration body keys
# under a ::STATE that introduces a region, counted apart from the core 29 and the profile
# 20 and never operation modifiers, so `[FILL:@IMG|bnd=...]` keeps its E302.
REGION_KEYS = set("pts bnd vtx msk".split())
# v4.2 §4.6.3: verbs that fix a frame of their own through asp / rsl
FRAME_SETTING_VERBS = {"CREA", "GEN", "EXPD"}
# meta-variables used by the specs' own teaching examples — informational only
PLACEHOLDER_HEADS = {"VERB", "VERB1", "VERB2", "VERB3", "DECL"}

TIER1 = set("@SRC @DST @PREV @LOCAL @SCREEN @LOG @NULL @STDIN".split())
TIER2 = set("@GH @R2 @COS @DRIVE @WORKER @CF".split())
TIER3 = set("@SYSTEM @RUNTIME @GRADER @USER @SELF @AGENT @TASK @TOOL".split())
# v4.1 §5.4 (SPEC-v4.1-MEDIA-PROFILE): media artifact targets. Their own tier, so Core, External and Role keep
# the counts earlier releases cite, and a ::STATE preset on a media entity is not read as
# rebinding a registered I/O name (E202 covers TIER1|TIER2 only).
TIER4 = set("@IMG @VID @AUD".split())
REGISTERED_ENTITIES = TIER1 | TIER2 | TIER3 | TIER4
# meta-variables the specs use in canonical forms — never real entities
PLACEHOLDER_ENTITIES = set("A B ENTITY FROM TO TARGET NAME SOURCE".split())

# --------------------------------------------------------------------- regexes
RE_DOC_MARKER = re.compile(r"^::ILANG::\S+$")
RE_DECL_HEAD = re.compile(r"^::([A-Z][A-Z0-9_]*)(?:::([A-Z][A-Z0-9_]*))?(.*)$")
RE_BAD_DECL_HEAD = re.compile(r"^::(\S*)")
RE_TEMPORAL_PREFIX = re.compile(r"^(T\[[^\]]+\])\s+(::.*)$")
RE_TEMPORAL_BIND = re.compile(r"^T\[[^\]]+\]=\S+")
RE_TEMPORAL_NOTE = re.compile(r"^(T\[[^\]]+\](→T\[[^\]]+\])?|PARALLEL\{[^}]*\})(\s.*)?$")
RE_TAG_LINE = re.compile(r"^(\[[A-Z][A-Z0-9_\-]*(?::[^\[\]]*)?\])+$")
# B5 form 1: `[TAG] text` — one tag group, optional trailing free text
RE_TAG_TEXT = re.compile(r"^\[[A-Z][A-Z0-9_\-]*(?::[^\[\]]*)?\](\s+\S.*)?$")
RE_KEY = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*):(.*)$")
# entity tokens count only in structural positions ({, :, |, comma, →, =);
# @ tokens embedded in free prose values are exempt (PATCH-2 Appendix B)
RE_ENTITY_TOKEN = re.compile(r"(?<=[{:|,→=])@([A-Za-z][A-Za-z0-9_\-]*)")
RE_ENTITY_OK = re.compile(r"^@[A-Z][A-Z0-9_]*$")
RE_BRACKET_GROUPS = re.compile(r"\[([^\[\]]*)\]")
RE_FENCE = re.compile(r"^\s*```")
RE_STATE_INTRO = re.compile(r"^::STATE\{(@[A-Z][A-Z0-9_]*)[,|}\s]")
# v4.2: a ::LIST{@NAME} header, an entity opening a ::LIST body line, the `key:` fields
# of a header, and the two coordinate units of §4.5.4 (two to four decimals, or px)
RE_LIST_INTRO = re.compile(r"^::LIST\{(@[A-Z][A-Z0-9_]*)[,|}\s]")
RE_LIST_ITEM = re.compile(r"^(@[A-Z][A-Z0-9_]*)(?![A-Za-z0-9_])")
RE_HEADER_KEY = re.compile(r"(?:^|[,|])\s*([A-Za-z_][A-Za-z0-9_]*):")
RE_NORM_ITEM = re.compile(r"^(?:0\.[0-9]{2,4}|1\.0{2,4})$")
RE_PX_ITEM = re.compile(r"^[0-9]+px$")


def mask_quoted(s):
    """Blank the inside of quoted values (v3.0 §2.4) so a comma, pipe, equals sign or
    bracket in a value is not read as structure. A quote opens a value only right after
    `=`, `:` or `,`; escapes \\" \\\\ \\n stay inside. Positions are kept. A line with
    an unterminated quoted value is returned unmasked, so it is checked as before."""
    out, quoted, escaped = [], False, False
    for k, ch in enumerate(s):
        if quoted:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                quoted = False
                out.append(ch)
                continue
            out.append("_")
            continue
        if ch == '"' and k > 0 and s[k - 1] in "=:,":
            quoted = True
        out.append(ch)
    return s if quoted else "".join(out)

ERROR, WARN, INFO = "ERROR", "WARN", "INFO"


class Linter:
    def __init__(self, path, text):
        self.path = path
        self.findings = []           # (level, lineno, code, message)
        self.lines = text.splitlines()
        self.skipped_fences = 0
        self.linted_fences = 0
        self.annotations = 0
        self.custom_entities = {}    # name -> first lineno (used w/o ::STATE intro)
        self.introduced = set()      # entities introduced via ::STATE
        self.mixed_last_op = False
        self.body_last_op = False
        # v4.2 document-scoped facts (§4.5 regions, §4.6 image layers and frames)
        self.lists = {}              # ::LIST entity -> [(lineno, [entities on its body lines])]
        self.merges = []             # (lineno, @TARGET, {key: value}) of every MERGE / Σ group
        self.layer_ops = {}          # @TARGET -> [(lineno, verb, {key: value})] of other groups
        self.image_layers = set()    # entities a MERGE on a media target composes (§4.6.1)
        self.regions = {}            # region entity -> line of the ::STATE declaring it
        self.state_keys = {}         # ::STATE entity -> header and body keys written for it
        self.state_ctx = None        # the ::STATE{@ENT} whose body lines are being classified
        raw = next((l for l in self.lines if l.strip()), "")
        self.raw_mode = raw.strip().startswith("::ILANG::")

    def add(self, level, lineno, code, msg):
        self.findings.append((level, lineno, code, msg))

    # ------------------------------------------------------------ entry points
    def run(self):
        self.prescan()
        if self.raw_mode:
            self.lint_region(0, len(self.lines), raw=True)
        else:
            self.scan_mixed()
        self.report_frames()
        # SHOULD-level summary: custom entities used without ::STATE introduction
        pending = sorted(n for n in self.custom_entities
                         if n not in self.introduced and n not in PLACEHOLDER_ENTITIES)
        if pending:
            first = min(self.custom_entities[n] for n in pending)
            self.add(INFO, first, "SHOULD",
                     "custom entities used without ::STATE introduction (PATCH-2 §2.2 SHOULD): "
                     + ", ".join(pending))
        return self.findings

    # ------------------------------------------------------------ v4.2 pre-scan
    def prescan(self):
        """Collect the document-scoped facts of v4.2 §4.6 before the walk: ::LIST bodies,
        MERGE groups, and the other operation groups by target. Custom entities are
        document scoped, so the ::LIST and the MERGE that make an entity an image layer
        may stand after the operation on it; the walk needs them first. Lines inside an
        ::UNTRUSTED block stay opaque here as they do in the walk."""
        skip_until = None
        for i, line in enumerate(self.lines):
            s = line.strip()
            if skip_until is not None:
                if s == skip_until:
                    skip_until = None
                continue
            if s.startswith("::UNTRUSTED{"):
                dm = re.search(r"delimiter:([^|}\s]+)", s)
                if dm:
                    skip_until = dm.group(1)
                continue
            lm = RE_LIST_INTRO.match(s)
            if lm:
                self.lists.setdefault(lm.group(1), []).append((i + 1, self.list_items(i)))
                continue
            if s.startswith("=>"):
                s = s[2:].strip()
            if not s.startswith("["):
                continue
            for gm in RE_BRACKET_GROUPS.finditer(mask_quoted(s)):
                grp, ogrp = gm.group(1), s[gm.start(1):gm.end(1)]
                head = re.split(r"[:|]", grp, maxsplit=1)[0].strip()
                rest = grp[len(head):]
                if not rest.startswith(":"):
                    continue
                cut = len(head) + 1 + len(rest[1:].split("|", 1)[0])
                target = ogrp[len(head) + 1:cut].strip()
                if not RE_ENTITY_OK.match(target):
                    continue
                mods = dict(self.mod_pairs(grp, ogrp))
                if head in ("MERGE", "Σ"):
                    self.merges.append((i + 1, target, mods))
                else:
                    self.layer_ops.setdefault(target, []).append((i + 1, head, mods))
        # §4.6.1: a MERGE on @IMG / @VID / @AUD, or on an image layer (itself a media
        # target), makes every entity on the ::LIST its src= names an image layer.
        media = set(TIER4)
        changed = True
        while changed:
            changed = False
            for _, target, mods in self.merges:
                if target not in media:
                    continue
                for _, items in self.lists.get(mods.get("src", ""), ()):
                    for item in items:
                        if item not in media and item not in REGISTERED_ENTITIES:
                            media.add(item)
                            changed = True
        self.image_layers = media - TIER4

    def list_items(self, i):
        """Entities opening the body lines of the ::LIST header at line i, in line order
        (§4.6.2 reads that order as stacking order). The body is taken as consume_body
        binds an indented body: lines indented past the header, a blank line included
        while the next nonblank line is still indented."""
        lines, n = self.lines, len(self.lines)
        header_indent = len(lines[i]) - len(lines[i].lstrip())
        items, bound, j = [], False, i + 1
        while j < n:
            s = lines[j].strip()
            if not s:
                k = j + 1
                while k < n and not lines[k].strip():
                    k += 1
                if bound and k < n and len(lines[k]) - len(lines[k].lstrip()) > header_indent:
                    j = k
                    continue
                break
            if len(lines[j]) - len(lines[j].lstrip()) <= header_indent:
                break
            bound = True
            im = RE_LIST_ITEM.match(s)
            if im:
                items.append(im.group(1))
            j += 1
        return items

    @staticmethod
    def mod_pairs(grp, ogrp):
        """(key, value) pairs after the first `|` of one bracket group. Pieces are cut on
        the masked text, so a `|` or `,` inside a quoted value (v3.0 §2.4) never splits
        it; values are read back from the original text, without enclosing quotes."""
        bar = grp.find("|")
        if bar < 0:
            return []
        out, start = [], bar + 1
        for k in range(bar + 1, len(grp) + 1):
            if k < len(grp) and grp[k] not in "|,":
                continue
            piece = grp[start:k]
            eq = piece.find("=")
            if eq >= 0:               # a piece without `=` continues the previous value
                out.append((piece[:eq].strip(), ogrp[start + eq + 1:k].strip().strip('"')))
            start = k + 1
        return out

    def scan_mixed(self):
        i, n = 0, len(self.lines)
        while i < n:
            line = self.lines[i]
            if RE_FENCE.match(line):
                start = i + 1
                i += 1
                while i < n and not RE_FENCE.match(self.lines[i]):
                    i += 1
                end = i          # fence body is [start, end)
                i += 1           # skip closing fence
                first = next((self.lines[j].strip() for j in range(start, end)
                              if self.lines[j].strip()), "")
                if self.is_ilang_start(first):
                    self.linted_fences += 1
                    self.lint_region(start, end, raw=True)
                else:
                    self.skipped_fences += 1
                continue
            s = line.strip()
            if s.startswith("::") or RE_TEMPORAL_PREFIX.match(s):
                self.mixed_last_op = False
                i = self.parse_construct(i, mixed=True)
                continue
            # bare operation chains / tag-or-op lines; markdown links and
            # reference-style links never fully match these shapes. A `=>` line
            # in mixed mode is linted only as a continuation of a preceding bare
            # operation line — otherwise it is markdown background.
            if not s:
                self.mixed_last_op = False
            elif s.startswith("=>"):
                if self.mixed_last_op:
                    self.check_operation(i, s[2:].strip(), chain=True)
            elif s.startswith("[") and "](" not in s and not s.startswith("[!"):
                ms = mask_quoted(s)
                if "]=>" in ms or RE_TAG_LINE.match(ms):
                    self.check_bracket_line(i, s)
                    self.mixed_last_op = ("]=>" in ms
                                          or self.head_of(s) in VERBS | ALIASES)
            else:
                self.mixed_last_op = False
            i += 1

    @staticmethod
    def is_ilang_start(s):
        if s.startswith("::") or s.startswith("T["):
            return True
        if s.startswith("[") and "](" not in s and not s.startswith("[!"):
            return bool(re.match(r"\[[A-Z" + GREEKISH + r"]", s))
        return False

    # -------------------------------------------------------------- region walk
    STRUCTURAL_CHARS = ("::", "[", "{", "}", "|", "⇒", "=>")

    def lint_region(self, start, end, raw):
        i = start
        last_op = False          # tracks whether `=>` may continue a chain
        seen_construct = False   # colophon tolerance: prose ok in tag-only regions
        in_preamble = False      # §1.7: tag lines right after a ::ILANG header
        nonblank = [j for j in range(start, end) if self.lines[j].strip()]
        first_nb = nonblank[0] if nonblank else -1
        last_nb = nonblank[-1] if nonblank else -1
        while i < end:
            s = self.lines[i].strip()
            if not s or s == "---":
                last_op = False
                i += 1
                continue
            if RE_DOC_MARKER.match(s):
                if i == first_nb:
                    in_preamble = True
                elif i != last_nb:
                    self.add(ERROR, i + 1, "E300",
                             "::ILANG document marker may only open or close a document (§1.7)")
                last_op = False
                i += 1
                continue
            if RE_TEMPORAL_BIND.match(s):
                last_op = False
                i += 1
                continue
            in_preamble_here, in_preamble = in_preamble, False
            if s.startswith("::") or RE_TEMPORAL_PREFIX.match(s):
                seen_construct, last_op = True, False
                i = self.parse_construct(i, mixed=False, limit=end)
                continue
            if s.startswith("=>"):
                if last_op:
                    self.check_operation(i, s[2:].strip(), chain=True)
                else:
                    self.add(ERROR, i + 1, "E300",
                             "orphan `=>` continuation: no preceding operation line")
                i += 1
                continue
            if s.startswith("["):
                # preamble position (§1.7): tag lines right after a ::ILANG
                # header are document metadata even when TAG collides with a
                # verb name — never parsed as operations, no E304
                ms = mask_quoted(s)
                if in_preamble_here and RE_TAG_LINE.match(ms) and "]=>" not in ms:
                    in_preamble = True
                    last_op = False
                    i += 1
                    continue
                self.check_bracket_line(i, s)
                last_op = "]=>" in ms or self.head_of(s) in VERBS | ALIASES
                if last_op:
                    seen_construct = True   # tag metadata lines are not constructs
                i += 1
                continue
            last_op = False
            if RE_TEMPORAL_NOTE.match(s):
                i += 1
                continue
            if s.startswith("→") or s.startswith("<<<"):
                self.annotations += 1
                i += 1
                continue
            if not seen_construct and not any(c in s for c in self.STRUCTURAL_CHARS):
                self.annotations += 1      # colophon prose in a tag-only region
                i += 1
                continue
            self.add(ERROR, i + 1, "E300",
                     "line matches no I-Lang production: " + s[:60])
            i += 1

    # --------------------------------------------------------- construct parser
    def parse_construct(self, i, mixed, limit=None):
        """Parse one ::DECL construct starting at line i; return next index."""
        end = limit if limit is not None else len(self.lines)
        line = self.lines[i]
        stripped = line.strip()
        prefix_m = RE_TEMPORAL_PREFIX.match(stripped)
        decl_text = prefix_m.group(2) if prefix_m else stripped
        header_indent = len(line) - len(line.lstrip())

        m = RE_DECL_HEAD.match(decl_text)
        if not m:
            bad = RE_BAD_DECL_HEAD.match(decl_text)
            self.add(ERROR, i + 1, "E300",
                     "malformed declaration header: " + (bad.group(0) if bad else decl_text)[:60])
            return i + 1
        name, subname, rest = m.group(1), m.group(2), m.group(3)

        if name == "ILANG":
            if not RE_DOC_MARKER.match(decl_text):
                self.add(ERROR, i + 1, "E300",
                         "malformed ::ILANG document marker: " + decl_text[:60])
            return i + 1
        if subname and name != "MODULE":
            self.add(ERROR, i + 1, "E300",
                     "::%s::%s — only ::MODULE takes a two-segment name (§1.7)" % (name, subname))
        registered = (name in DECL_STRUCTURAL or name in DECL_NARRATIVE
                      or name in TERMINATORS or name in META_DECLS)
        if not registered:
            if name in TOLERATED_ANNOT:
                self.annotations += 1
                return i + 1
            self.add(ERROR, i + 1, "E300",
                     "::%s is not in the declaration registry (32 structural + 13 narrative, PATCH-2 §1.5/§1.6)" % name)

        self.scan_entities(i, decl_text)

        rest = rest.strip() if rest else ""
        if not rest.startswith("{"):
            self.add(ERROR, i + 1, "E300", "::%s header lacks `{`" % name)
            return i + 1

        # §1.3: full-width ：/｜ as structural separators ⇒ E300. Full-width
        # punctuation is legal inside values, so ： is flagged only when a
        # pipe-delimited field carries no ASCII colon at all.
        if "｜" in rest:
            self.add(ERROR, i + 1, "E300",
                     "full-width ｜ as structural separator (§1.3) — use ASCII `|`")
        elif "：" in rest:
            for seg in rest.strip("{}").split("|"):
                if "：" in seg and ":" not in seg:
                    self.add(ERROR, i + 1, "E300",
                             "full-width ： as structural separator (§1.3) — use ASCII `:`")
                    break

        # narrative double-brace requirement; content brace may span lines
        if name in NARR_DOUBLE:
            if re.match(r"^\{[^{}]*\}\{.*\}\s*$", rest):
                return self.consume_body(i, name, header_indent, end)
            if re.match(r"^\{[^{}]*\}\{[^}]*$", rest):
                return self.consume_brace_span(i, name, rest, end)
            self.add(ERROR, i + 1, "E300",
                     "::%s requires double-brace form ::VERB{addressing}{content} (v3.0 §7)" % name)
            return i + 1

        # brace balance on the header line decides the shape
        balance = rest.count("{") - rest.count("}")
        if balance > 0:
            return self.consume_brace_span(i, name, rest, end)

        # inline / header_body; same-line trailing body token permitted
        close = self.find_close(rest)
        trailing = rest[close + 1:].strip() if close >= 0 else ""

        im = RE_STATE_INTRO.match(decl_text)
        if im:
            ent = im.group(1)
            self.introduced.add(ent.lstrip("@"))
            if ent in TIER1 | TIER2:
                self.add(WARN, i + 1, "E202",
                         "::STATE re-introduces registered name %s — possible rebinding (§2.2)" % ent)
            # v4.2: the body lines that follow (trailing token included) may declare a region
            self.begin_state(i, ent, rest[1:close] if close > 0 else rest[1:])
        if trailing:
            self.classify_body_line(i, name, trailing, nested=False)

        if name == "UNTRUSTED":
            dm = re.search(r"delimiter:([^|}\s]+)", rest)
            if dm:
                return self.consume_opaque(i + 1, dm.group(1), end)

        j = self.consume_body(i, name, header_indent, end)
        if im:
            self.end_state()
        return j

    @staticmethod
    def find_close(rest):
        depth = 0
        for k, ch in enumerate(rest):
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    return k
        return -1

    def consume_brace_span(self, i, name, rest, end):
        # §1.1: a set-span (header ends with `{`) terminates at the bare `}` line;
        # a wrapped field header (content after the opening brace, v3.0 §10.3
        # style) terminates at the first line ending with `}`. Braces embedded
        # mid-content are content, not structure.
        wrapped = not rest.rstrip().endswith("{")
        j = i + 1
        while j < end:
            t = self.lines[j].strip()
            if t == "}" or (wrapped and t.endswith("}")):
                return j + 1
            j += 1
        self.add(ERROR, i + 1, "E300", "::%s brace span never closes" % name)
        return end

    def consume_opaque(self, j, delimiter, end):
        while j < end:
            if self.lines[j].strip() == delimiter:
                return j + 1
            j += 1
        return j

    def consume_body(self, i, name, header_indent, end):
        """Collect header_body lines: indented, or flush-left per FLUSH-LEFT-BODY."""
        j = i + 1
        regime = None            # 'indent' | 'flush' once the first body line binds
        self.body_last_op = False
        while j < end:
            line = self.lines[j]
            s = line.strip()
            if not s:
                if regime != "indent":
                    return j     # flush-left bodies terminate at the first blank
                # blank permitted inside indented body if next nonblank still indented
                k = j + 1
                while k < end and not self.lines[k].strip():
                    k += 1
                if k < end:
                    nxt = self.lines[k]
                    if len(nxt) - len(nxt.lstrip()) > header_indent:
                        j = k
                        continue
                return j
            indent = len(line) - len(line.lstrip())
            if indent > header_indent:
                if regime == "flush":
                    return j
                regime = "indent"
                j = self.body_line(j, name, s, indent, end)
                continue
            if regime == "indent":
                return j         # dedent terminates the indented body (§1.1)
            if indent != header_indent:
                return j         # FLUSH-LEFT binds at the same indent only
            # flush-left: body-form line binds; next `::`/`T[` header terminates
            if s.startswith("::") or RE_TEMPORAL_PREFIX.match(s) or RE_DOC_MARKER.match(s):
                return j
            if self.is_body_form(s):
                regime = "flush"
                self.classify_body_line(j, name, s, nested=False)
                j += 1
                continue
            return j
        return j

    def body_line(self, j, name, s, indent, end):
        """Handle one indented body line; B7 nesting may consume extra lines."""
        if s.startswith("::"):
            nm = RE_DECL_HEAD.match(s)
            nested_name = nm.group(1) if nm else "?"
            if nm and (nested_name in TOLERATED_ANNOT):
                self.annotations += 1
                return j + 1
            if not nm or (nested_name not in DECL_STRUCTURAL
                          and nested_name not in DECL_NARRATIVE):
                self.add(ERROR, j + 1, "E300",
                         "nested ::%s is not a registered declaration" % nested_name)
                return j + 1
            if nested_name in NARR_DOUBLE:
                nrest = s[2 + len(nested_name):].strip()
                if not re.match(r"^\{[^{}]*\}\{.*\}\s*$", nrest):
                    self.add(ERROR, j + 1, "E300",
                             "::%s requires double-brace form ::VERB{addressing}{content} (v3.0 §7)" % nested_name)
            self.scan_entities(j, s)
            im = RE_STATE_INTRO.match(s)
            if im:                   # v4.2: a nested ::STATE body may declare a region
                nrest = s[2 + len(nested_name):].strip()
                nclose = self.find_close(nrest)
                self.begin_state(j, im.group(1), nrest[1:nclose] if nclose > 0 else nrest[1:])
            # nested declaration may carry its own deeper body (B1-B6); a
            # declaration nested deeper still exceeds one level -> E300
            k = j + 1
            while k < end:
                ln = self.lines[k]
                t = ln.strip()
                if not t:
                    break
                ind2 = len(ln) - len(ln.lstrip())
                if ind2 <= indent:
                    break
                if t.startswith("::"):
                    self.add(ERROR, k + 1, "E300",
                             "declaration nesting exceeds one level (§1.2 B7)")
                else:
                    self.classify_body_line(k, nested_name, t, nested=True)
                k += 1
            if im:
                self.end_state()
            return k
        self.classify_body_line(j, name, s, nested=False)
        return j + 1

    def is_body_form(self, s):
        """B1-B5 / reserved-key shapes eligible for flush-left binding.
        B8 (`[VERB...]` operations, `=>` continuations) is deliberately excluded:
        FLUSH-LEFT-BODY binds body forms B1-B5 only."""
        if s.startswith(("T:", "A:")):
            return True
        if s.startswith("["):
            ms = mask_quoted(s)
            return bool((RE_TAG_LINE.match(ms) or RE_TAG_TEXT.match(ms))
                        and self.head_of(s) not in VERBS | ALIASES)
        return bool(RE_KEY.match(s)) or bool(RE_TEMPORAL_BIND.match(s))

    def classify_body_line(self, j, parent, s, nested):
        lineno = j + 1
        if RE_TEMPORAL_BIND.match(s) or RE_TEMPORAL_NOTE.match(s):
            return
        if s.startswith("→"):
            self.annotations += 1
            return
        if s.startswith(("T:", "A:")):                       # B1
            self.scan_entities(j, s)
            return
        if s.startswith("=>"):                               # B8 continuation
            if self.body_last_op:
                self.check_operation(j, s[2:].strip(), chain=True)
            elif parent not in PROSE_BODY:
                self.add(ERROR, lineno, "E300",
                         "orphan `=>` continuation in ::%s body: no preceding operation line (§1.7)" % parent)
            return
        if s.startswith("["):                                # B5 or B8
            ms = mask_quoted(s)
            if "]=>" in ms or self.head_of(s) in VERBS | ALIASES:
                self.check_operation(j, s, chain=True)
                self.body_last_op = True
            elif RE_TAG_LINE.match(ms) or RE_TAG_TEXT.match(ms):
                pass                                         # B5 tag line
            elif parent in PROSE_BODY:
                pass                                         # bracket-initial prose
            else:
                self.add(ERROR, lineno, "E300",
                         "bracket body line is neither B5 tag nor B8 operation: " + s[:60])
            return
        km = RE_KEY.match(s)
        if km:                                               # B2 / B3 / B4
            self.scan_entities(j, s)
            if parent == "STATE" and self.state_ctx is not None:
                self.note_state_key(lineno, km.group(1), km.group(2))
            return
        # else -> B6 prose
        if parent not in PROSE_BODY:
            self.add(ERROR, lineno, "E300",
                     "B6 prose body line inside non-prose ::%s (§1.2 B6): %s"
                     % (parent, s[:50]))

    # ---------------------------------------------------------- bracket lines
    @staticmethod
    def head_of(s):
        m = RE_BRACKET_GROUPS.search(mask_quoted(s))
        if not m:
            return ""
        return re.split(r"[:|]", m.group(1), maxsplit=1)[0].strip()

    def check_bracket_line(self, i, s):
        ms = mask_quoted(s)
        if "]=>" in ms:
            self.check_operation(i, s, chain=True)
            return
        head = self.head_of(s)
        if head in VERBS | ALIASES:
            self.check_operation(i, s, chain=False)
        elif RE_TAG_LINE.match(ms):
            pass                                             # metadata tag line
        else:
            self.add(ERROR, i + 1, "E300",
                     "bracket line is neither tag nor operation: " + s[:60])

    def check_operation(self, i, s, chain):
        lineno = i + 1
        # groups and modifiers are read on the masked line, which keeps the offsets of s:
        # separators inside a quoted value (v3.0 §2.4) never split it and brackets inside
        # it never open a group. The target is read back from s, so messages quote it as written.
        for gm in RE_BRACKET_GROUPS.finditer(mask_quoted(s)):
            grp, ogrp = gm.group(1), s[gm.start(1):gm.end(1)]
            head = re.split(r"[:|]", grp, maxsplit=1)[0].strip()
            if head in PLACEHOLDER_HEADS:
                continue
            if head not in VERBS and head not in ALIASES:
                if chain:
                    code = "E305" if (len(head) == 1 and not head.isascii()) else "E304"
                    what = "alias" if code == "E305" else "verb"
                    self.add(ERROR, lineno, code,
                             "unknown %s `%s` in operation chain" % (what, head))
                continue
            rest = grp[len(head):]
            target = ""
            if rest.startswith(":"):
                cut = len(head) + 1 + len(rest[1:].split("|", 1)[0])
                target = ogrp[len(head) + 1:cut].strip()
            if target:
                if target.startswith("@"):
                    if not RE_ENTITY_OK.match(target):
                        self.add(ERROR, lineno, "E300",
                                 "entity `%s` violates @[A-Z][A-Z0-9_]* (§2.2)" % target)
                    else:
                        self.note_entity(i, target)
                elif head in ("BATC", "Π"):
                    if target not in VERBS and target not in ALIASES:
                        self.add(ERROR, lineno, "E304",
                                 "BATC verb reference `%s` is not a registered verb or alias" % target)
                else:
                    self.add(ERROR, lineno, "E300",
                             "operation target `%s` is not an @ENTITY (v3.0 §2.2; BATC/Π excepted)" % target)
            if "|" in rest:
                # v4.1 §4.4.1: the media profile is in force only when the target is a
                # media entity. Core keys keep their meaning inside media operations.
                # v4.2 §4.6.1: an image layer is a media target, in force as @IMG.
                media = target in TIER4 or target in self.image_layers
                allowed = MODIFIERS | MEDIA_PROFILE if media else MODIFIERS
                where = ("the 29-key core registry or the 20-key media profile"
                         if media else "the 29-key registry")
                mods = rest.split("|", 1)[1]
                for seg in re.split(r"[|]", mods):
                    for piece in seg.split(","):
                        if "=" not in piece:
                            continue          # continuation of previous value
                        key = piece.split("=", 1)[0].strip()
                        if key and key not in allowed:
                            hint = ""
                            if not media and key in MEDIA_PROFILE:
                                hint = (" (media profile key used on a non-media target;"
                                        " §4.4.1 gates it to @IMG, @VID and @AUD, v4.2 §4.6.1"
                                        " to an image layer)")
                            elif key in REGION_KEYS:
                                hint = (" (region body key; v4.2 §4.5.3 writes it on a ::STATE"
                                        " body line, never as a modifier)")
                            self.add(ERROR, lineno, "E302",
                                     "modifier `%s` not in %s%s" % (key, where, hint))

    # -------------------------------------------------------------- entities
    def scan_entities(self, i, s):
        for tok in RE_ENTITY_TOKEN.finditer(s):
            name = "@" + tok.group(1)
            if tok.group(1)[0].islower():
                self.add(ERROR, i + 1, "E300",
                         "entity `%s` violates @[A-Z][A-Z0-9_]* (§2.2)" % name)
            elif name not in REGISTERED_ENTITIES and RE_ENTITY_OK.match(name):
                self.custom_entities.setdefault(tok.group(1), i + 1)

    def note_entity(self, i, name):
        if name not in REGISTERED_ENTITIES:
            self.custom_entities.setdefault(name[1:], i + 1)

    # --------------------------------------------- v4.2 regions and image layers
    def begin_state(self, i, ent, header):
        """Open the context of ::STATE{@ENT ...} at line i for the body lines that
        follow. Header keys are recorded for §4.6.3; a region body key among them is
        misplaced, since §4.5.2 writes geometry on a body line and never in the header."""
        keys = RE_HEADER_KEY.findall(mask_quoted(header))
        self.state_keys.setdefault(ent, set()).update(keys)
        ctx = {"ent": ent, "lineno": i + 1, "region": False, "found": [],
               "outer": self.state_ctx}
        misplaced = [k for k in keys if k in REGION_KEYS]
        if misplaced:
            ctx["region"] = True
            self.add(WARN, i + 1, "E300",
                     "region geometry `%s:` is written in the ::STATE header; a region body"
                     " key is a body line (v4.2 §4.5.2)" % misplaced[0])
        self.state_ctx = ctx

    def note_state_key(self, lineno, key, value):
        """One `KEY:` body line (B2 / B3 / B4) under the open ::STATE."""
        ctx = self.state_ctx
        self.state_keys.setdefault(ctx["ent"], set()).add(key)
        if key in REGION_KEYS:
            ctx["found"].append((lineno, key, value.strip()))

    def end_state(self):
        """Close the open ::STATE context: one region body key per region (§4.5.2), the
        value checks of §4.5.3 / §4.5.4, and one entity is never both a region and an
        image layer (§4.6.1). All WARN (§4.12.5 point 2): a document that was valid
        before v4.2 stays valid."""
        ctx, self.state_ctx = self.state_ctx, self.state_ctx["outer"]
        ent, found = ctx["ent"], ctx["found"]
        if found:
            ctx["region"] = True
            if len(found) > 1:
                self.add(WARN, found[1][0], "E300",
                         "a region body carries exactly one region body key; `%s:` follows"
                         " `%s:` (v4.2 §4.5.2)" % (found[1][1], found[0][1]))
            for lineno, key, val in found:
                self.check_region_value(lineno, key, val)
        if ctx["region"]:
            self.regions.setdefault(ent, ctx["lineno"])
            if ent in self.image_layers:
                self.add(WARN, ctx["lineno"], "E300",
                         "%s is declared as a region and named as an image layer; one entity"
                         " is never both (v4.2 §4.6.1)" % ent)

    def check_region_value(self, lineno, key, val):
        """§4.5.3 line form and item count, §4.5.4 units and corner order, on one region
        body line. WARN only: a malformed geometry line is warned about, not rejected."""
        if key == "msk":
            if val.startswith("["):
                self.add(WARN, lineno, "E300",
                         "msk is a B2 field line `msk:value` naming a path, URI or entity,"
                         " not a vector (v4.2 §4.5.3)")
            elif not val:
                self.add(WARN, lineno, "E303",
                         "msk names a path, URI or entity holding a mask; the value is empty"
                         " (v4.2 §4.5.3)")
            return
        if not (val.startswith("[") and val.endswith("]")):
            self.add(WARN, lineno, "E300",
                     "%s is a B4 vector line `%s:[x,y,...]` (v4.2 §4.5.3; SPEC-v5.0"
                     " Part III §1.2)" % (key, key))
            return
        items = [x.strip() for x in val[1:-1].split(",")]
        norm = [x for x in items if RE_NORM_ITEM.match(x)]
        px = [x for x in items if RE_PX_ITEM.match(x)]
        units_ok = True
        if len(norm) + len(px) < len(items):
            units_ok = False
            bad = next(x for x in items if not RE_NORM_ITEM.match(x) and not RE_PX_ITEM.match(x))
            what = ("a bare integer; write `%spx` or a normalised decimal" % bad if bad.isdigit()
                    else "neither a normalised decimal 0.00-1.00 with two to four places"
                         " nor a non-negative integer with px")
            self.add(WARN, lineno, "E303",
                     "%s item `%s` is %s (v4.2 §4.5.4)" % (key, bad, what))
        elif norm and px:
            units_ok = False
            self.add(WARN, lineno, "E303",
                     "%s mixes normalised and px items; one geometry line uses one unit"
                     " (v4.2 §4.5.4)" % key)
        least, exact, wants = {"pts": (2, None, "an even count of at least 2"),
                               "bnd": (4, 4, "exactly 4"),
                               "vtx": (6, None, "an even count of at least 6")}[key]
        cnt = len(items)
        if cnt % 2 or cnt < least or (exact is not None and cnt != exact):
            self.add(WARN, lineno, "E303",
                     "%s has %d items; it takes %s (v4.2 §4.5.3)" % (key, cnt, wants))
        elif key == "bnd" and units_ok:
            x1, y1, x2, y2 = [float(x[:-2] if px else x) for x in items]
            if not (x1 < x2 and y1 < y2):
                self.add(WARN, lineno, "E303",
                         "bnd corners are out of order; it takes x1 < x2 and y1 < y2"
                         " (v4.2 §4.5.3)")

    @staticmethod
    def frame_value(v):
        """asp / rsl as written, compared without spaces and case."""
        return v.replace(" ", "").lower()

    def report_frames(self):
        """§4.6.3 frame rules, WARN only (§4.14 item 4). Only stated values are compared:
        a MERGE's own asp / rsl against those an operation on an image layer of its list
        writes, and against another MERGE whose list names the same image layer. Nothing
        is derived from a source file or from an implementation's pixel grid."""
        fixed = {}                   # image layer -> (merge lineno, asp, rsl) first seen
        seen = set()
        for lineno, target, mods in self.merges:
            if target not in TIER4 and target not in self.image_layers:
                continue
            defs = self.lists.get(mods.get("src", ""), [])
            if not defs:
                continue
            asp, rsl = mods.get("asp"), mods.get("rsl")
            if asp is None and rsl is None:
                self.report_unfixed_frame(lineno, defs)
                continue
            conflicts = []
            for item in dict.fromkeys(it for _, items in defs for it in items):
                for op_ln, verb, omods in self.layer_ops.get(item, ()):
                    for key, val in (("asp", asp), ("rsl", rsl)):
                        own = omods.get(key)
                        if (val is None or own is None or (op_ln, key) in seen
                                or self.frame_value(own) == self.frame_value(val)):
                            continue
                        seen.add((op_ln, key))
                        self.add(WARN, op_ln, "E303",
                                 "%s=%s on image layer %s differs from %s=%s of the MERGE at"
                                 " line %d that composes it (v4.2 §4.6.3: reported, not rescaled)"
                                 % (key, own, item, key, val, lineno))
                prev = fixed.setdefault(item, (lineno, asp, rsl))
                for key, a, b in (("asp", prev[1], asp), ("rsl", prev[2], rsl)):
                    if a is not None and b is not None and self.frame_value(a) != self.frame_value(b):
                        conflicts.append("%s: %s=%s here, %s=%s at line %d"
                                         % (item, key, b, key, a, prev[0]))
                        break
            if conflicts:
                self.add(WARN, lineno, "E303",
                         "one image layer has one frame; this MERGE fixes a different frame from"
                         " an earlier composite naming it (v4.2 §4.6.3): " + "; ".join(conflicts))

    def report_unfixed_frame(self, lineno, defs):
        """§4.6.3: a MERGE stating neither asp nor rsl takes the frame of the operation
        making its bottom image layer. Reported only where the text decides it: every
        operation on the bottom image layer is a frame-setting verb (CREA, GEN, EXPD)
        stating neither key nor a preset (ref=), and no ::STATE on it writes one either.
        A frame-keeping verb (FILL, EXTC, SPLIT, SET) inherits an input frame the text
        cannot know, so nothing is reported for it."""
        bottoms = {items[0] for _, items in defs if items}
        if len(bottoms) != 1:
            return
        bottom = bottoms.pop()
        ops = self.layer_ops.get(bottom, ())
        if not ops or any(verb not in FRAME_SETTING_VERBS for _, verb, _ in ops):
            return
        hints = {"asp", "rsl", "ref"}
        if any(hints & set(m) for _, _, m in ops) or hints & self.state_keys.get(bottom, set()):
            return
        self.add(WARN, lineno, "E303",
                 "composite frame cannot be fixed: this MERGE states neither asp nor rsl and"
                 " the operation making its bottom image layer %s states neither (v4.2 §4.6.3:"
                 " incomplete composite)" % bottom)


# ------------------------------------------------------------------- commands
CANON_FILES = ["SPEC.md", "SPEC-v4.0-FINAL.md", "SPEC-v4.1-MEDIA-PROFILE.md",
               "SPEC-v4.2-MEDIA-REGIONS-AND-LAYERS.md", "SPEC-v5.0.md",
               "AUTHORS.md", "README.md"]


def lint_paths(paths, as_json, strict):
    total_err = total_warn = 0
    report = []
    for path in paths:
        try:
            # utf-8-sig strips a UTF-8 BOM so raw-mode detection still works
            text = open(path, encoding="utf-8-sig").read()
        except UnicodeDecodeError:
            total_err += 1
            report.append({"file": path, "mode": "unreadable", "errors": 1,
                           "warnings": 0, "findings": [{
                               "level": ERROR, "line": 1, "code": "E300",
                               "message": "file is not valid UTF-8 (§1.3 file_encoding=UTF-8)"}]})
            if not as_json:
                print("%s:1 [ERROR E300] file is not valid UTF-8 (§1.3 file_encoding=UTF-8)" % path)
            continue
        except OSError as e:
            print("cannot read %s: %s" % (path, e), file=sys.stderr)
            return 2
        lt = Linter(path, text)
        findings = lt.run()
        errs = [f for f in findings if f[0] == ERROR]
        warns = [f for f in findings if f[0] == WARN]
        total_err += len(errs)
        total_warn += len(warns)
        report.append({
            "file": path,
            "mode": "raw" if lt.raw_mode else "mixed",
            "errors": len(errs), "warnings": len(warns),
            "fences_linted": lt.linted_fences, "fences_skipped": lt.skipped_fences,
            "tolerated_annotations": lt.annotations,
            "findings": [{"level": lv, "line": ln, "code": c, "message": m}
                         for lv, ln, c, m in findings],
        })
        if not as_json:
            for lv, ln, c, m in findings:
                print("%s:%d [%s %s] %s" % (path, ln, lv, c, m))
            print("%s: %d error(s), %d warning(s) | mode=%s fences linted=%d skipped=%d annotations=%d"
                  % (path, len(errs), len(warns),
                     "raw" if lt.raw_mode else "mixed",
                     lt.linted_fences, lt.skipped_fences, lt.annotations))
    if as_json:
        print(json.dumps({"files": report, "errors": total_err,
                          "warnings": total_warn}, ensure_ascii=False, indent=2))
    else:
        print("\nTOTAL: %d error(s), %d warning(s) in %d file(s)"
              % (total_err, total_warn, len(paths)))
    if total_err or (strict and total_warn):
        return 1
    return 0


# -------------------------------------------------------------------- selftest
GOOD_DOC = """\
::ILANG::v5.0
[TYPE:selftest][SCOPE:test][LANG:en]
[LIST:known_repos][DESC:tag_names_may_collide_with_verbs_in_preamble]

::FACT{key:x|value:hello|conf:confirmed}
::GENE{verify_first|conf:confirmed|scope:global}
  T:check_before_execute
  A:blind_execution⇒fatal
  ::PRIOR{completion:assume_incomplete}
    reason_note:one_level_body_ok

::CLAUSE{DEMO|conf:confirmed|scope:test}
T:flush_left_body_binds
A:ignoring_flush_left⇒false_reject
[NOTE] a B5 tag line with trailing text binds too

::MODE{M1|name:EXEC_AUTO}     T:same_line_trailing_body

::JUDGE{v5.0}
V:[int=0.80,cap=0.60,csq=0.70,rel=0.55,cer=0.90,aut=0.75,rev=0.85,evd=0.80,sov=0.95,ine=0.60,ext=0.90]
M:M2|conf:0.87
R:demo

::LIST{@REPOS}
  some/repo → prose line is fine inside LIST

::LESSON{id:l1|type:build|scope:project|conf:confirmed}
  Express middleware order matters.
  [sic] bracket-initial prose is fine inside a prose body

::RULE{proxy_signals⇒insufficient}
  tests pass ≠ complete, annotation prose allowed under RULE

T[0]  ::EVENT{1999|started|major:demo}
      ::FACT{key:y|value:z|conf:confirmed}
T[1]=2001

::PRIORITY{
  a > b > c
}

::MODULE::DEMO{
  [WHAT] a module of tags and prose.
  Free prose is legal here.
}

::UNTRUSTED{id:u1|source:user|role:objective|effects:none|delimiter:EOF_u1}
<<<EOF_u1
::GENE{this_is_opaque_and_must_not_parse}
EOF_u1
::END_UNTRUSTED{id:u1}

::STATE{@SPEC, kind:document}
[READ:@SPEC|src=github.com/x]
  =>[PARS|typ=v5.0]
  =>[Ω]
[BATC:Σ]

::SAY{@USER→@SELF}{hello there}
::EVENT{simple}

::STATE{@IMG, mdm:photo, lgt:golden_hour}
[GEN:@IMG|sbj=a fox,pov=close_up,asp=16:9,exc=text]=>[Ω]
[GEN:@VID|sbj=@PREV,mvt=pan_left,dur=8,fps=24]=>[Ω]

::STATE{@SKY, scope:session}
  bnd:[0.00,0.00,1.00,0.45]
::STATE{@SEED}
  pts:[120px,80px]
::STATE{@BIN}
  vtx:[0.62,0.55,0.71,0.53,0.73,0.80,0.61,0.82]
::STATE{@DOG}
  msk:masks/dog.png
::LIST{@POSTER}
  @BASE
  @TITLE
[CREA:@BASE|asp=4:5,rsl=1080x1350,fmt=png]
[GEN:@TITLE|txt="SALE, today only",whr=@SKY,plc=transparent,fmt=png]
[MERGE:@IMG|src=@POSTER,asp=4:5,rsl=1080x1350,fmt=png]=>[WRIT:@LOCAL|path=out/poster.png]
[FILL:@IMG|src=@PREV,whr=@SKY,txt="[draft]",sbj="a,b=c"]

::ILANG::v5.0::END
"""

BAD_CASES = [
    ("::WIDGET{x:1}", "E300", "unregistered declaration"),
    ("::GENE{x|conf:confirmed}\n  free prose under gene", "E300", "B6 in non-prose"),
    ("::FACT{key:a|value:@bad_case}", "E300", "entity casing"),
    ("[REED:@GH]=>[Ω]", "E304", "unknown verb in chain"),
    ("[Φ:@GH]=>[Ω]", "E305", "unknown alias in chain"),
    ("::SAY{@A}", "E300", "narrative missing double brace"),
    ("[READ:bareword]", "E300", "bareword target"),
    ("::ILANG::v5.0\n=>[Ω]", "E300", "orphan continuation"),
    ("::GENE{a|conf:c}\n  ::PRIOR{b:c}\n    ::PRIOR{d:e}", "E300", "nesting depth"),
    ("::FOO::BAR{x}", "E300", "two-segment non-MODULE"),
    ("::FACT{key：a|value:b|conf:c}", "E300", "full-width colon separator"),
    ("::FACT{key:a｜value:b}", "E300", "full-width pipe separator"),
    ("::GENE{g|conf:c}\n  =>[Ω]", "E300", "orphan => inside body"),
    ("::ILANG::v5.0 trailing junk\n::FACT{key:a|value:b|conf:c}", "E300",
     "malformed document marker"),
    ("::ILANG::v5.0\n::FACT{key:a|value:b|conf:c}\n::ILANG::MID::MARKER\n"
     "::FACT{key:d|value:e|conf:c}", "E300", "mid-document marker"),
    ("::ILANG::v5.0\n::LESSON{id:x|type:t|scope:s|conf:c}\n  ::SAY{@A}", "E300",
     "nested narrative missing double brace"),
]

BAD_CASES.append(("::ILANG::v5.0\n::FACT{key:a|value:b|conf:c}\n[READ:@GH|frobnicate=1]",
                  "E302", "unknown modifier"))
BAD_CASES.append(("::ILANG::v5.0\n::FACT{key:a|value:b|conf:c}\n[READ:@GH|sbj=a fox]",
                  "E302", "media profile key on a non-media target"))
BAD_CASES.append(("::ILANG::v5.0\n::FACT{key:a|value:b|conf:c}\n[GEN:@IMG|frobnicate=1]",
                  "E302", "unknown key on a media target"))

BAD_CASES.append(("::ILANG::v5.0\n[GEN:@IMG|sbj=\"a,b=c\",frobnicate=1]=>[Ω]",
                  "E302", "unknown key after a quoted value"))
BAD_CASES.append(("::ILANG::v5.0\n[REED:@IMG|rng=\"[0.1,0.2]\"]=>[Ω]",
                  "E304", "unknown verb whose quoted value holds brackets"))
BAD_CASES.append(("::ILANG::v5.0\n::FACT{key:a|value:b|conf:c}\n[FILL:@IMG|rng=\"[0.1,0.2]\",frobnicate=1]",
                  "E302", "unknown key in a single operation whose quoted value holds brackets"))

# v3.0 §2.4: separators and brackets inside a quoted value are not syntax
GOOD_CASES = [
    ("::ILANG::v5.0\n[FILL:@IMG|rng=\"0.1,0.2\",sbj=\"a,b=c\"]=>[Ω]",
     "comma and equals sign inside a quoted value (no E302)"),
    ("::ILANG::v5.0\n[FILL:@IMG|rng=\"[0.1,0.2,0.5,0.6]\",src=@PREV]=>[Ω]",
     "brackets inside a quoted value (no E304)"),
    ("::ILANG::v5.0\n::FACT{key:a|value:b|conf:c}\n[FILL:@IMG|rng=\"[0.1,0.2]\"]",
     "single operation whose quoted value holds brackets"),
    ("::ILANG::v5.0\n[GEN:@IMG|txt=\"say \\\"hi, x=1\\\" [ok]\",asp=1:1]=>[Ω]",
     "escaped quote inside a quoted value"),
]

WARN_CASES = [
    ("::STATE{@SRC, meaning:redefined}", "E202", "tier-1 rebinding candidate"),
]

# v4.2 §4.6.1: an entity is a media target only through a MERGE on a media target;
# §4.5.3: a region body key is never a modifier
BAD_CASES.append(("::ILANG::v5.0\n::STATE{@X, mdm:photo}\n[GEN:@X|sbj=a fox]",
                  "E302", "profile key on a custom entity that is not an image layer"))
BAD_CASES.append(("::ILANG::v5.0\n::LIST{@L}\n  @X\n[MERGE:@LOCAL|src=@L]\n[GEN:@X|sbj=a fox]",
                  "E302", "profile key on a list item whose MERGE target is not media"))
BAD_CASES.append(("::ILANG::v5.0\n::FACT{key:a|value:b|conf:c}\n[FILL:@IMG|bnd=0.10]",
                  "E302", "region body key used as an operation modifier"))

# v4.2 §4.6.1: profile keys on an image layer, in whichever order the document states things
GOOD_CASES += [
    ("::ILANG::v5.0\n::LIST{@L}\n  @X\n[GEN:@X|sbj=a fox,asp=1:1]=>[Ω]\n[MERGE:@IMG|src=@L,asp=1:1,fmt=png]",
     "profile keys on an image layer (v4.2 §4.6.1)"),
    ("::ILANG::v5.0\n::FACT{key:a|value:b|conf:c}\n[GEN:@X|sbj=a fox]\n::LIST{@L}\n  @X\n[Σ:@IMG|src=@L]",
     "profile keys on an image layer whose list and MERGE alias follow the operation"),
    ("::ILANG::v5.0\n::LIST{@L}\n  @X\n::LIST{@L2}\n  @Y\n[MERGE:@Y|src=@L]\n[MERGE:@IMG|src=@L2]\n[GEN:@X|sbj=a fox]",
     "profile keys on an image layer of an inner composite merged onto an image layer"),
]

# v4.2 §4.5 / §4.6: well-formed regions and composites raise neither ERROR nor WARN
CLEAN_CASES = [
    ("::STATE{@SKY, scope:session}\n  bnd:[0.00,0.00,1.00,0.45]", "a normalised rectangle region"),
    ("::STATE{@EDGE}\n  bnd:[1728px,0px,2048px,1152px]", "a px rectangle region"),
    ("::STATE{@BIN}\n  vtx:[0.62,0.55,0.71,0.53,0.73,0.80,0.61,0.82]", "a four-vertex polygon region"),
    ("::STATE{@SEED}\n  pts:[0.41,0.58]", "a one-point region"),
    ("::STATE{@DOG}\n  msk:masks/dog.png", "a mask region"),
    ("::STATE{@SKY}  bnd:[0.000,0.0000,1.000,1.0000]",
     "a region on a same-line trailing body with three and four decimals"),
    ("::GENE{g|conf:c}\n  ::STATE{@SKY}\n    bnd:[0.00,0.00,1.00,0.45]", "a region declared by a nested ::STATE"),
    ("::ILANG::v5.0\n::LIST{@L}\n  @BASE\n  @TOP\n[CREA:@BASE|asp=4:5,rsl=1080x1350,fmt=png]\n"
     "[GEN:@TOP|sbj=a fox,asp=4:5]\n[MERGE:@IMG|src=@L,asp=4:5,rsl=1080x1350,fmt=png]",
     "image layers whose asp / rsl agree with the composite frame"),
    ("::ILANG::v5.0\n::LIST{@L}\n  @BASE\n[FILL:@IMG|src=a.jpg,sbj=sky]=>[SET:@BASE|src=@PREV]\n"
     "[MERGE:@IMG|src=@L,fmt=png]",
     "a composite without asp / rsl whose bottom image layer keeps an input frame"),
    ("::ILANG::v5.0\n::STATE{@BASE, asp:4:5, rsl:1080x1350}\n::LIST{@L}\n  @BASE\n"
     "[CREA:@BASE|pal=\"#FFF\",fmt=png]\n[MERGE:@IMG|src=@L,fmt=png]",
     "a composite without asp / rsl whose bottom image layer has ::STATE frame defaults"),
]

# v4.2 §4.14 items 2 and 4: every region and frame report is a WARN, never an ERROR
V42_WARN_CASES = [
    ("::STATE{@SKY}\n  bnd:[0.00,0.00,1.00,1.00]\n  msk:masks/sky.png", "E300", "two region body keys in one region"),
    ("::STATE{@SKY}\n  bnd:0.00,0.00,1.00,0.45", "E300", "geometry that is not a B4 vector line"),
    ("::STATE{@SKY}\n  msk:[0.00,0.00,1.00,1.00]", "E300", "a mask written as a vector"),
    ("::STATE{@SKY, bnd:[0.00,0.00,1.00,0.45]}", "E300", "region geometry in the ::STATE header"),
    ("::STATE{@SKY}\n  pts:[0.40,120px]", "E303", "mixed coordinate units"),
    ("::STATE{@SKY}\n  bnd:[0,0,1,1]", "E303", "bare integers"),
    ("::STATE{@SKY}\n  bnd:[0.5,0.5,1.00,1.00]", "E303", "a decimal with one place"),
    ("::STATE{@SKY}\n  bnd:[0.00,0.00,1.20,1.00]", "E303", "a normalised item above 1.00"),
    ("::STATE{@SKY}\n  bnd:[0.00,0.20,1.00]", "E303", "a rectangle with three items"),
    ("::STATE{@SKY}\n  pts:[0.40,0.20,0.10]", "E303", "an odd point count"),
    ("::STATE{@SKY}\n  vtx:[0.00,0.00,1.00,1.00]", "E303", "a polygon with two vertices"),
    ("::STATE{@SKY}\n  bnd:[0.50,0.00,0.20,1.00]", "E303", "rectangle corners out of order"),
    ("::ILANG::v5.0\n::STATE{@SKY}\n  bnd:[0.00,0.00,1.00,0.45]\n::LIST{@L}\n  @SKY\n[MERGE:@IMG|src=@L,asp=1:1]",
     "E300", "one entity as both region and image layer"),
    ("::ILANG::v5.0\n::LIST{@L}\n  @BASE\n[CREA:@BASE|asp=1:1,rsl=1000x1000,fmt=png]\n"
     "[MERGE:@IMG|src=@L,asp=4:5,rsl=1080x1350,fmt=png]",
     "E303", "image layer asp / rsl differing from the composite frame"),
    ("::ILANG::v5.0\n::LIST{@L1}\n  @BASE\n::LIST{@L2}\n  @BASE\n[MERGE:@IMG|src=@L1,asp=4:5]\n"
     "[MERGE:@IMG|src=@L2,asp=1:1]",
     "E303", "one image layer on two lists whose composites fix different frames"),
    ("::ILANG::v5.0\n::LIST{@L}\n  @BASE\n[CREA:@BASE|pal=\"#FFF\",fmt=png]\n[MERGE:@IMG|src=@L,fmt=png]",
     "E303", "a composite whose frame cannot be fixed"),
]
WARN_CASES += V42_WARN_CASES


def cmd_selftest():
    t = []
    lt = Linter("<good>", GOOD_DOC)
    findings = lt.run()
    errs = [f for f in findings if f[0] == ERROR]
    t.append(("good document has zero errors", not errs, errs))
    warns = [f for f in findings if f[0] == WARN]
    t.append(("good document custom-entity SHOULD warn only",
              all(f[2] == "SHOULD" for f in warns), warns))
    for src, code, label in BAD_CASES:
        f = Linter("<bad>", src).run()
        hit = any(lv == ERROR and c == code for lv, _, c, _ in f)
        t.append(("rejects %s (%s)" % (label, code), hit, f))
    for src, label in GOOD_CASES:
        f = Linter("<good-case>", src).run()
        errs = [x for x in f if x[0] == ERROR]
        t.append(("accepts %s" % label, not errs, errs))
    f = Linter("<quoted-target>", '::ILANG::v5.0\n::FACT{key:a|value:b|conf:c}\n[READ:"npm run, build"]').run()
    t.append(("E300 message quotes a quoted target as written",
              any(c == "E300" and '`"npm run, build"`' in m for _, _, c, m in f), f))
    for src, code, label in WARN_CASES:
        f = Linter("<warn>", src).run()
        hit = any(lv == WARN and c == code for lv, _, c, _ in f)
        t.append(("warns %s (%s)" % (label, code), hit, f))
    for src, label in CLEAN_CASES:
        f = Linter("<clean>", src).run()
        bad = [x for x in f if x[0] in (ERROR, WARN)]
        t.append(("accepts %s without a warning" % label, not bad, bad))
    v42_errs = [(label, [x for x in Linter("<warn>", src).run() if x[0] == ERROR])
                for src, _, label in V42_WARN_CASES]
    v42_errs = [(label, errs) for label, errs in v42_errs if errs]
    t.append(("v4.2 region and frame reports stay at WARN level, never ERROR",
              not v42_errs, v42_errs))
    md = "# doc\n\nprose [link](x.md)\n\n```\nDATA I/O: READ WRIT\n```\n\n```\n::FACT{key:a|value:b|conf:confirmed}\n```\n"
    lt2 = Linter("<md>", md)
    f2 = lt2.run()
    t.append(("mixed mode: skips non-ilang fence, lints ilang fence",
              lt2.skipped_fences == 1 and lt2.linted_fences == 1
              and not [x for x in f2 if x[0] == ERROR], f2))
    failed = [(name, det) for name, ok, det in t if not ok]
    for name, ok, _ in t:
        print(("PASS " if ok else "FAIL ") + name)
    if failed:
        for name, det in failed:
            print("\n--- %s ---" % name)
            for item in det:
                print("   ", item)
    print("\n%d/%d passed" % (len(t) - len(failed), len(t)))
    return 1 if failed else 0


def main():
    # findings echo source text (⇒, Greek, CJK); never die on a cp1252 console
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    p = argparse.ArgumentParser(description="I-Lang grammar & registry validator")
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--selftest", action="store_true")
    g.add_argument("--lint", nargs="+", metavar="FILE")
    g.add_argument("--canon", metavar="REPO_DIR")
    p.add_argument("--json", action="store_true")
    p.add_argument("--strict", action="store_true")
    a = p.parse_args()
    if a.selftest:
        sys.exit(cmd_selftest())
    if a.lint:
        sys.exit(lint_paths(a.lint, a.json, a.strict))
    if a.canon:
        import os
        paths = [os.path.join(a.canon, f) for f in CANON_FILES]
        sys.exit(lint_paths(paths, a.json, a.strict))


if __name__ == "__main__":
    main()
