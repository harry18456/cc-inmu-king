"""Checks, on the Claude Code you have, the one thing inmu-king's store relies
on: two sessions writing different keys of one plugin store at the same time
lose none of them (each write changes its own key and keeps the rest).

It loads a helper plugin, tools/store-check, into headless sessions: one
clears the helper's store, two write N keys each at the same time, one counts
them and clears the store again. A plugin's slash command answers without the
model, so the check costs nothing. Standard library only:

    uv run tools/store_check.py [N]
"""

import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

PLUGIN = Path(__file__).resolve().parent / "store-check"


def start(commands: list[str], out: Path) -> subprocess.Popen:
    """A headless session that runs `commands`, its events written to `out`."""
    claude = shutil.which("claude")
    if claude is None:
        sys.exit("claude is not on PATH")
    proc = subprocess.Popen(
        [claude, "-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--plugin-dir", str(PLUGIN)],
        stdin=subprocess.PIPE,
        stdout=out.open("w", encoding="utf-8"),
        stderr=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
    )
    for command in commands:
        proc.stdin.write(json.dumps({"type": "user", "message": {"role": "user", "content": command}}) + "\n")
    proc.stdin.close()
    return proc


def results(proc: subprocess.Popen, out: Path) -> list[str]:
    """What the session's commands answered, in order."""
    code = proc.wait(timeout=600)
    if code != 0:
        sys.exit(f"claude exited with {code}; its events are in {out}")
    found = []
    for line in out.read_text(encoding="utf-8").splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("type") == "result" and isinstance(event.get("result"), str):
            found.append(event["result"])
    return found


def run(commands: list[str], folder: Path, name: str) -> list[str]:
    out = folder / f"{name}.jsonl"
    return results(start(commands, out), out)


def main() -> None:
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 400
    folder = Path(tempfile.mkdtemp(prefix="inmu-store-check-"))
    print("clear:", run(["/storecheck clear"], folder, "clear"))

    a_out, b_out = folder / "a.jsonl", folder / "b.jsonl"
    a, b = start([f"/storecheck put A {n}"], a_out), start([f"/storecheck put B {n}"], b_out)
    taken, windows = {}, []
    for prefix, proc, out in (("A", a, a_out), ("B", b, b_out)):
        said = results(proc, out)
        print("put:", said)
        match = next((m for m in (re.search(rf"put {prefix} (\d+) (\d+) (\d+)", s) for s in said) if m), None)
        if match is None:
            sys.exit(f"no put result; the events are in {out}")
        taken[prefix] = int(match.group(1))
        windows.append((int(match.group(2)), int(match.group(3))))

    counted = run(["/storecheck count A", "/storecheck count B", "/storecheck clear"], folder, "count")
    print("count:", counted)
    overlap = min(end for _, end in windows) - max(begin for begin, _ in windows)
    lost = {p: k for p, k in taken.items() if not any(f"count {p} {k}" in said for said in counted)}
    if lost:
        print(f"FAIL: a key the store took is gone; it took {taken}, the count says {counted}")
        sys.exit(1)
    if overlap <= 0:
        print("INCONCLUSIVE: no key was lost, but the two sessions did not write at the same time; run it again")
        sys.exit(2)
    refused = 2 * n - sum(taken.values())
    print(f"PASS: two sessions wrote at once for {overlap} ms; the store took {sum(taken.values())} writes, refused {refused}, lost none")


if __name__ == "__main__":
    main()
