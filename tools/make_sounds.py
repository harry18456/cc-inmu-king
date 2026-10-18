#!/usr/bin/env python3
"""Generates the mod's built-in sound effects: short original 8-bit jingles.

Standard library only. Run from anywhere:

    python -I tools/make_sounds.py

Writes sounds/hit.wav, sounds/burst.wav, sounds/crown.wav and sounds/sin.wav
next to this folder: 22,050 Hz, 16-bit mono PCM, which Windows' SoundPlayer
and macOS' afplay both play. Every melody here is original (plain major and
diminished arpeggios); none is taken from a song.
"""

import math
import pathlib
import struct
import wave

RATE = 22050
OUT = pathlib.Path(__file__).resolve().parent.parent / "sounds"
SEMITONE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def freq(name: str) -> float:
    """'C5' or 'F#4' to hertz; 'R' is a rest (0)."""
    if name == "R":
        return 0.0
    letter, octave = name[:-1], int(name[-1])
    midi = 12 * (octave + 1) + SEMITONE[letter]
    return 440.0 * 2 ** ((midi - 69) / 12)


def tone(f: float, dur: float, duty=0.5, vol=0.25, attack=0.004, release=0.03, bend=0.0, vibrato=0.0) -> list:
    """One pulse-wave note: `bend` semitones across the note, `vibrato` semitones at 6 Hz."""
    n = int(RATE * dur)
    out = []
    phase = 0.0
    for i in range(n):
        t = i / RATE
        if f <= 0:
            out.append(0.0)
            continue
        cur = f * 2 ** (bend * (t / dur) / 12)
        if vibrato:
            cur *= 2 ** (vibrato * math.sin(2 * math.pi * 6 * t) / 12)
        phase = (phase + cur / RATE) % 1.0
        s = 1.0 if phase < duty else -1.0
        env = min(1.0, t / attack) if attack > 0 else 1.0
        left = dur - t
        if left < release:
            env *= max(0.0, left / release)
        out.append(s * vol * env)
    return out


def seq(notes, **kw) -> list:
    out = []
    for name, dur, *extra in notes:
        opts = dict(kw)
        if extra:
            opts.update(extra[0])
        out.extend(tone(freq(name), dur, **opts))
    return out


def mix(*tracks) -> list:
    length = max(len(t) for t in tracks)
    out = [0.0] * length
    for t in tracks:
        for i, s in enumerate(t):
            out[i] += s
    return out


def soften(samples: list, a=0.45) -> list:
    """A one-pole low-pass: takes the edge off the square waves."""
    out = []
    y = 0.0
    for x in samples:
        y += a * (x - y)
        out.append(y)
    return out


def write(name: str, samples: list) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    tail = [0.0] * int(RATE * 0.02)
    data = [max(-1.0, min(1.0, s)) for s in soften(samples) + tail]
    with wave.open(str(OUT / name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(struct.pack("<%dh" % len(data), *(int(s * 32767) for s in data)))
    print(f"{name}: {len(data) / RATE:.2f} s")


def hit() -> list:
    # A two-note blip up.
    return seq([("E6", 0.045), ("B6", 0.075)], duty=0.25, vol=0.22)


def burst() -> list:
    # A fast rising C major run, a bass under it, a sparkle on top.
    run = seq([("C5", 0.06), ("E5", 0.06), ("G5", 0.06), ("C6", 0.06), ("E6", 0.06), ("G6", 0.06), ("C7", 0.22)], duty=0.5, vol=0.2, release=0.06)
    bass = seq([("C3", 0.36), ("G3", 0.22)], duty=0.5, vol=0.11, release=0.06)
    sparkle = seq([("R", 0.40), ("G6", 0.035), ("C7", 0.035), ("E7", 0.035), ("G7", 0.12)], duty=0.125, vol=0.1)
    return mix(run, bass, sparkle)


def crown() -> list:
    # A short fanfare on C major: melody, a third below, a bass, a sparkle at the end.
    melody = seq([("G4", 0.12), ("C5", 0.12), ("E5", 0.12), ("G5", 0.30), ("E5", 0.12), ("G5", 0.12), ("C6", 0.60)], duty=0.5, vol=0.2, release=0.12)
    third = seq([("E4", 0.12), ("G4", 0.12), ("C5", 0.12), ("E5", 0.30), ("C5", 0.12), ("E5", 0.12), ("E5", 0.60)], duty=0.25, vol=0.1, release=0.12)
    bass = seq([("C3", 0.36), ("G3", 0.30), ("C3", 0.24), ("C3", 0.60)], duty=0.5, vol=0.11, release=0.12)
    sparkle = seq([("R", 1.05), ("C7", 0.04), ("E7", 0.04), ("G7", 0.04), ("C8", 0.14)], duty=0.125, vol=0.08)
    return mix(melody, third, bass, sparkle)


def sin() -> list:
    # A falling diminished arpeggio that sags at the end.
    return seq(
        [("G4", 0.15), ("E4", 0.15), ("C#4", 0.15), ("A#3", 0.5, {"bend": -1.5, "vibrato": 0.35, "release": 0.15})],
        duty=0.5,
        vol=0.18,
    )


if __name__ == "__main__":
    write("hit.wav", hit())
    write("burst.wav", burst())
    write("crown.wav", crown())
    write("sin.wav", sin())
