#!/usr/bin/env python3
"""
alienisierung.py — Visuelle Zeichensubstitution als poetisches Verfahren

Zweischichtiges Substitutionsverfahren:
  1. Visuelle Schicht: Bitmap-Rendering + Pixel-Ähnlichkeit
  2. Phonetische Schicht: Lautwert-Mapping über Unicode-Namen

Steuerparameter:
  - replacement_rate: Anteil der lateinischen Zeichen, die ersetzt werden (0.0–1.0)
  - visual_max_dist: Max. visuelle Distanz für Schicht 1
  - phonetic_max_dist: Max. visuelle Distanz für Schicht 2 (phonetisch motiviert)
  - prefer_scripts: Bevorzugte Quell-Schriftsysteme
"""

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import unicodedata
import json
import re
from collections import defaultdict

# ============================================================
#  KONFIGURATION
# ============================================================

CELL_SIZE = 48
FONT_SIZE = 36
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

LATIN_CHARS = (
    "abcdefghijklmnopqrstuvwxyz"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "0123456789"
)

SCRIPT_RANGES = {
    "Cyrillic":       [(0x0400, 0x04FF), (0x0500, 0x052F)],
    "Greek":          [(0x0370, 0x03FF), (0x1F00, 0x1FFF)],
    "Armenian":       [(0x0530, 0x058F)],
    "Georgian":       [(0x10D0, 0x10FF), (0x2D00, 0x2D2F)],
    "Coptic":         [(0x2C80, 0x2CFF)],
    "Runic":          [(0x16A0, 0x16FF)],
    "Glagolitic":     [(0x2C00, 0x2C5F)],
    "Old_Italic":     [(0x10300, 0x1032F)],
    "Gothic":         [(0x10330, 0x1034F)],
    "Deseret":        [(0x10400, 0x1044F)],
    "Osmanya":        [(0x10480, 0x104AF)],
    "Tifinagh":       [(0x2D30, 0x2D7F)],
    "Ethiopic":       [(0x1200, 0x137F)],
    "NKo":            [(0x07C0, 0x07FF)],
    "Vai":            [(0xA500, 0xA63F)],
    "Bamum":          [(0xA6A0, 0xA6FF)],
    "Cherokee":       [(0x13A0, 0x13FF), (0xAB70, 0xABBF)],
    "Lisu":           [(0xA4D0, 0xA4FF)],
    "Katakana":       [(0x30A0, 0x30FF)],
    "Hiragana":       [(0x3040, 0x309F)],
    "Thai":           [(0x0E00, 0x0E7F)],
    "Lao":            [(0x0E80, 0x0EFF)],
    "Myanmar":        [(0x1000, 0x109F)],
    "Khmer":          [(0x1780, 0x17FF)],
    "Javanese":       [(0xA980, 0xA9DF)],
    "Devanagari":     [(0x0900, 0x097F)],
    "Bengali":        [(0x0980, 0x09FF)],
    "Tamil":          [(0x0B80, 0x0BFF)],
    "Telugu":         [(0x0C00, 0x0C7F)],
    "Kannada":        [(0x0C80, 0x0CFF)],
    "Malayalam":      [(0x0D00, 0x0D7F)],
    "Sinhala":        [(0x0D80, 0x0DFF)],
    "Tibetan":        [(0x0F00, 0x0FFF)],
    "Arabic":         [(0x0600, 0x06FF)],
    "Hebrew":         [(0x0590, 0x05FF)],
    "Syriac":         [(0x0700, 0x074F)],
    "Thaana":         [(0x0780, 0x07BF)],
    "IPA":            [(0x0250, 0x02AF)],
    "Latin_Extended":  [(0x0100, 0x024F), (0x1E00, 0x1EFF),
                        (0x2C60, 0x2C7F), (0xA720, 0xA7FF)],
    "Fullwidth":      [(0xFF00, 0xFFEF)],
    "Math_Alpha":     [(0x1D400, 0x1D7FF)],
}

# ============================================================
#  SCHICHT 1: VISUELLE ÄHNLICHKEIT
# ============================================================

def render_char(char, font, size=CELL_SIZE):
    img = Image.new('L', (size, size), 255)
    draw = ImageDraw.Draw(img)
    try:
        bbox = font.getbbox(char)
        if bbox is None: return None
        w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        if w <= 1 or h <= 1: return None
        draw.text(((size-w)/2 - bbox[0], (size-h)/2 - bbox[1]), char, font=font, fill=0)
    except: return None
    return np.array(img, dtype=np.float32) / 255.0

def pixel_dist(a, b):
    if a is None or b is None: return 1.0
    return float(np.mean(np.abs(a - b)))

def get_script(cp):
    for s, ranges in SCRIPT_RANGES.items():
        for start, end in ranges:
            if start <= cp <= end: return s
    return "Unknown"

def build_visual_table(font, max_dist=0.30, verbose=True):
    if verbose: print("Schicht 1: Visuelle Ähnlichkeiten...")
    latin_bmps = {}
    for ch in LATIN_CHARS:
        bmp = render_char(ch, font)
        if bmp is not None: latin_bmps[ch] = bmp
    if verbose: print(f"  {len(latin_bmps)} Referenzzeichen")

    candidates = []
    for script, ranges in SCRIPT_RANGES.items():
        for start, end in ranges:
            for cp in range(start, end+1):
                ch = chr(cp)
                cat = unicodedata.category(ch)
                if cat.startswith('C') or cat == 'Zs': continue
                candidates.append((cp, ch, script))
    if verbose: print(f"  {len(candidates)} Kandidaten aus {len(SCRIPT_RANGES)} Schriften")

    notdef_bmp = render_char('\uffff', font)
    table = {}
    for lat_ch, lat_bmp in latin_bmps.items():
        matches = []
        for cp, cand_ch, script in candidates:
            cand_bmp = render_char(cand_ch, font)
            if cand_bmp is None: continue
            if notdef_bmp is not None and pixel_dist(cand_bmp, notdef_bmp) < 0.02: continue
            d = pixel_dist(lat_bmp, cand_bmp)
            if d < max_dist:
                matches.append((d, cand_ch, cp, script))
        matches.sort()
        table[lat_ch] = matches
    if verbose:
        total = sum(len(v) for v in table.values())
        print(f"  → {total} visuelle Matches")
    return table

# ============================================================
#  SCHICHT 2: PHONETISCHE ÄHNLICHKEIT
# ============================================================

LATIN_TO_PHONEME = {
    'a': ['a','æ','ɑ'], 'b': ['b'], 'c': ['k','tʃ','s'],
    'd': ['d'], 'e': ['e','ɛ'], 'f': ['f'], 'g': ['g','ɡ'],
    'h': ['h'], 'i': ['i','ɪ'], 'j': ['j','dʒ'], 'k': ['k'],
    'l': ['l'], 'm': ['m'], 'n': ['n'], 'o': ['o','ɔ'],
    'p': ['p'], 'q': ['k'], 'r': ['r','ɾ','ʁ'],
    's': ['s','ʃ'], 't': ['t'], 'u': ['u','ʊ'],
    'v': ['v'], 'w': ['w'], 'x': ['ks','x'],
    'y': ['j','i'], 'z': ['z','ts'],
}
for ch in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
    LATIN_TO_PHONEME[ch] = LATIN_TO_PHONEME[ch.lower()]

def extract_phoneme_from_name(uname):
    uname = uname.upper()
    for pat in [r'LETTER\s+([A-Z]+)$', r'LETTER\s+([A-Z]+)\s',
                r'SYLLABLE\s+([A-Z]+)$', r'SYLLABLE\s+([A-Z]+)\s',
                r'VOWEL\s+SIGN\s+([A-Z]+)', r'VOWEL\s+([A-Z]+)',
                r'CHARACTER\s+([A-Z]+)\s', r'CHARACTER\s+([A-Z]+)$']:
        m = re.search(pat, uname)
        if m: return m.group(1).lower()
    return None

PHONEME_NORMALIZE = {
    'a':'a','aa':'a','e':'e','ee':'e','ae':'æ','i':'i','ii':'i',
    'o':'o','oo':'o','au':'ɔ','u':'u','uu':'u',
    'ka':'k','kha':'k','ga':'g','gha':'g','ca':'tʃ','cha':'tʃ',
    'ja':'dʒ','jha':'dʒ','ta':'t','tha':'t','da':'d','dha':'d',
    'na':'n','nga':'n','nya':'n','ma':'m','pa':'p','pha':'p',
    'ba':'b','bha':'b','ra':'r','la':'l','va':'v','wa':'w',
    'sa':'s','sha':'ʃ','ha':'h','ya':'j','fa':'f','za':'z',
    'ko':'k','kho':'k','go':'g','to':'t','tho':'t','do':'d',
    'no':'n','mo':'m','po':'p','bo':'b','ro':'r','lo':'l',
    'so':'s','ho':'h','yo':'j','wo':'w','fo':'f',
    'k':'k','g':'g','t':'t','d':'d','n':'n','p':'p','b':'b',
    'm':'m','r':'r','l':'l','s':'s','h':'h','f':'f','v':'v',
    'w':'w','y':'j','z':'z','j':'dʒ',
    'he':'h','le':'l','me':'m','se':'s','re':'r','qe':'k',
    'be':'b','te':'t','ne':'n','ke':'k','we':'w','ze':'z',
    'ye':'j','de':'d','ge':'g','pe':'p','fe':'f',
}

def phoneme_to_ipa(p):
    if p is None: return None
    p = p.lower().strip()
    if p in PHONEME_NORMALIZE: return PHONEME_NORMALIZE[p]
    if len(p) >= 1 and p[0] in 'bcdfghjklmnpqrstvwxyz': return p[0]
    if len(p) >= 1 and p[0] in 'aeiou': return p[0]
    return None

def build_phonetic_table(font, verbose=True):
    if verbose: print("Schicht 2: Phonetische Äquivalente...")
    latin_bmps = {}
    for ch in LATIN_CHARS:
        bmp = render_char(ch, font)
        if bmp is not None: latin_bmps[ch] = bmp
    notdef_bmp = render_char('\uffff', font)

    phon_cands = []
    for script, ranges in SCRIPT_RANGES.items():
        for start, end in ranges:
            for cp in range(start, end+1):
                ch = chr(cp)
                cat = unicodedata.category(ch)
                if cat.startswith('C') or cat == 'Zs': continue
                name = unicodedata.name(ch, '')
                if not name: continue
                ipa = phoneme_to_ipa(extract_phoneme_from_name(name))
                if ipa: phon_cands.append((cp, ch, script, ipa))
    if verbose: print(f"  {len(phon_cands)} Zeichen mit extrahiertem Lautwert")

    table = {}
    for lat_ch in LATIN_CHARS:
        if lat_ch not in LATIN_TO_PHONEME or lat_ch not in latin_bmps: continue
        targets = set(LATIN_TO_PHONEME[lat_ch])
        matches = []
        for cp, cand_ch, script, ipa in phon_cands:
            if ipa not in targets and not any(ipa.startswith(t) for t in targets):
                continue
            cand_bmp = render_char(cand_ch, font)
            if cand_bmp is None: continue
            if notdef_bmp is not None and pixel_dist(cand_bmp, notdef_bmp) < 0.02: continue
            d = pixel_dist(latin_bmps[lat_ch], cand_bmp)
            matches.append((d, cand_ch, cp, script))
        matches.sort()
        table[lat_ch] = matches
    if verbose:
        total = sum(len(v) for v in table.values())
        distant = sum(1 for v in table.values() for m in v if m[0] > 0.25)
        print(f"  → {total} phonetische Matches, {distant} nur über Laut erreichbar")
    return table

# ============================================================
#  ENGINE: ZWEISCHICHTIG
# ============================================================

def alienisiere(text, visual_table, phonetic_table,
                replacement_rate=0.8,
                visual_max_dist=0.15,
                phonetic_max_dist=0.50,
                prefer_scripts=None,
                seed=None):
    """
    Alienisiert einen Text in zwei Durchläufen.

    replacement_rate: Anteil der lat. Zeichen, die ersetzt werden (0.0–1.0)
    """
    rng = np.random.RandomState(seed)

    latin_positions = [i for i, ch in enumerate(text) if ch in LATIN_CHARS]
    n_latin = len(latin_positions)
    n_target = int(round(n_latin * replacement_rate))

    shuffled = latin_positions.copy()
    rng.shuffle(shuffled)
    target_positions = set(shuffled[:n_target])

    result = list(text)
    stats = defaultdict(int)
    stats['total_chars'] = len(text)
    stats['latin_chars'] = n_latin
    stats['target'] = n_target

    def pick(candidates, rng, weighted=True):
        if not candidates: return None
        if weighted and len(candidates) > 1:
            dists = np.array([c[0] for c in candidates])
            w = 1.0 / (dists + 0.001)
            w /= w.sum()
            return candidates[rng.choice(len(candidates), p=w)]
        return candidates[rng.choice(len(candidates))]

    def filter_cands(cands, max_dist, prefer):
        out = [(d,c,cp,s) for d,c,cp,s in cands if d <= max_dist]
        if prefer and out:
            pref = [x for x in out if x[3] in prefer]
            if pref: return pref
        return out

    # --- Durchlauf 1: Visuell ---
    replaced = set()
    for i in target_positions:
        ch = text[i]
        if ch not in visual_table: continue
        cands = filter_cands(visual_table[ch], visual_max_dist, prefer_scripts)
        chosen = pick(cands, rng, weighted=True)
        if chosen:
            result[i] = chosen[1]
            replaced.add(i)
            stats['visual'] += 1
            stats['scripts_used'] = stats.get('scripts_used', set())
            if isinstance(stats['scripts_used'], set):
                stats['scripts_used'].add(chosen[3])

    # --- Durchlauf 2: Phonetisch (Auffangnetz) ---
    remaining = target_positions - replaced
    for i in remaining:
        ch = text[i]
        if ch not in phonetic_table: continue
        # Aus Latin_Extended, Math_Alpha, IPA ausschließen – visuell langweilig
        cands = [(d,c,cp,s) for d,c,cp,s in phonetic_table[ch]
                 if d <= phonetic_max_dist
                 and s not in ('Latin_Extended','Math_Alpha','IPA')]
        if prefer_scripts and cands:
            pref = [x for x in cands if x[3] in prefer_scripts]
            if pref: cands = pref
        chosen = pick(cands, rng, weighted=False)
        if chosen:
            result[i] = chosen[1]
            replaced.add(i)
            stats['phonetic'] += 1
            if isinstance(stats.get('scripts_used'), set):
                stats['scripts_used'].add(chosen[3])

    stats['replaced'] = len(replaced)
    stats['actual_rate'] = len(replaced) / n_latin if n_latin > 0 else 0
    if isinstance(stats.get('scripts_used'), set):
        stats['scripts_used'] = sorted(stats['scripts_used'])
    return ''.join(result), dict(stats)

# ============================================================
#  HILFSFUNKTIONEN
# ============================================================

def save_table(table, path, top_n=50):
    ser = {}
    for ch, matches in table.items():
        ser[ch] = [
            {"dist": round(d,5), "char": c, "cp": f"U+{cp:04X}",
             "script": s, "name": unicodedata.name(c, "?")}
            for d, c, cp, s in matches[:top_n]
        ]
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(ser, f, ensure_ascii=False, indent=2)

def print_examples(vtab, ptab, chars="aeosmkwAMW"):
    for ch in chars:
        print(f"\n{'='*60}")
        print(f"  '{ch}' (U+{ord(ch):04X})")
        print(f"{'='*60}")
        if ch in vtab and vtab[ch]:
            print("  Visuell (Top 5):")
            for d,c,cp,s in vtab[ch][:5]:
                print(f"    {c}  U+{cp:04X}  d={d:.4f}  [{s}]  {unicodedata.name(c,'?')}")
        if ch in ptab and ptab[ch]:
            far = [(d,c,cp,s) for d,c,cp,s in ptab[ch]
                   if d > 0.15 and s not in ('Latin_Extended','Math_Alpha','IPA')]
            if far:
                print("  Phonetisch → visuell fremd (Top 5):")
                for d,c,cp,s in far[:5]:
                    print(f"    {c}  U+{cp:04X}  d={d:.4f}  [{s}]  {unicodedata.name(c,'?')}")

# ============================================================
#  HAUPTPROGRAMM
# ============================================================

if __name__ == '__main__':
    print("="*60)
    print("  ALIENISIERUNG v2")
    print("  Visuelle + Phonetische Zeichensubstitution")
    print("="*60)

    font = ImageFont.truetype(FONT_PATH, FONT_SIZE)
    vtab = build_visual_table(font, max_dist=0.30, verbose=True)
    ptab = build_phonetic_table(font, verbose=True)

    save_table(vtab, "visual_table.json")
    save_table(ptab, "phonetic_table.json")
    print("\nTabellen gespeichert.")

    print_examples(vtab, ptab, chars="aeosmkwAMW")

    testtext = (
        "Die Oberfläche täuscht Identität vor, wo der Code Differenz "
        "eingeschrieben hat. Der Text sieht aus wie zuvor, aber er ist "
        "es nicht mehr: Er hat seine kulturelle Heimat verloren, ohne "
        "eine neue gefunden zu haben."
    )

    print("\n\n" + "="*60)
    print("  ALIENISIERUNGS-SPEKTRUM")
    print("="*60)
    print(f"\nOriginal:\n{testtext}\n")

    configs = [
        ("20% ersetzt – leise Kontamination",
         dict(replacement_rate=0.2, visual_max_dist=0.08, phonetic_max_dist=0.0)),
        ("50% ersetzt – visuell + phonetisch",
         dict(replacement_rate=0.5, visual_max_dist=0.12, phonetic_max_dist=0.40)),
        ("80% ersetzt – Schwellenzone",
         dict(replacement_rate=0.8, visual_max_dist=0.15, phonetic_max_dist=0.45)),
        ("100% ersetzt – totale Alienisierung",
         dict(replacement_rate=1.0, visual_max_dist=0.20, phonetic_max_dist=0.50)),
        ("100% – nur asiatische Schriften",
         dict(replacement_rate=1.0, visual_max_dist=0.25, phonetic_max_dist=0.50,
              prefer_scripts=['Thai','Lao','Myanmar','Khmer','Devanagari',
                              'Bengali','Tamil','Katakana','Hiragana',
                              'Tibetan','Javanese','Sinhala','Ethiopic'])),
    ]

    for label, kwargs in configs:
        alien, stats = alienisiere(testtext, vtab, ptab, seed=42, **kwargs)
        v = stats.get('visual', 0)
        p = stats.get('phonetic', 0)
        rate = stats.get('actual_rate', 0)
        scripts = stats.get('scripts_used', [])
        print(f"--- {label} ---")
        print(alien)
        print(f"  → {v} visuell + {p} phonetisch = {v+p} ersetzt "
              f"({rate:.0%} von {stats['latin_chars']})")
        print(f"  → Schriften: {', '.join(scripts) if scripts else '–'}")
        print()

    print("Fertig.")
