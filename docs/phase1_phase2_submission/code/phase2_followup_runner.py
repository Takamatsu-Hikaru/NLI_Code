#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path


HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import phase23_runner as base


if __name__ == "__main__":
    argv = ["phase23_runner.py", "run-phase2-followup", *sys.argv[1:]]
    sys.argv = argv
    raise SystemExit(base.main())
