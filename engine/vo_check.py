"""Transcribe each narration clip with Whisper and flag lines that don't match the script.

    uv run engine/vo_check.py projects/kp-001-birthday
"""

import difflib
import json
import re
import sys
from pathlib import Path

from mlx_audio.stt import load

ROOT = Path(__file__).resolve().parent.parent

def norm(s: str) -> str:
    return re.sub(r"[^一-鿿0-9a-zA-Z]", "", s)


proj = Path(sys.argv[1]).resolve()
vo = json.loads(re.search(r"export const VO = (\[.*?\]);", (proj / "vo.js").read_text(), re.S).group(1))
cache = ROOT / "out" / proj.name / "vo"
stt = load("mlx-community/whisper-large-v3-turbo-asr-fp16")
bad = 0
for line in vo:
    heard = stt.generate(str(cache / line["clip"]), language="zh").text.strip()
    score = difflib.SequenceMatcher(None, norm(line["say"]), norm(heard)).ratio()
    flag = "  " if score >= 0.8 else "!!"
    bad += score < 0.8
    print(f"{flag} {line['id']:<11} {score * 100:5.1f}%  {line['end'] - line['start']:4.2f}s  {heard}")
print(f"{bad} line(s) below 80%")
