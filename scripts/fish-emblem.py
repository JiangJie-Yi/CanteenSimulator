"""Writes the loading screens' emblem (a salt-grilled ayu on a bamboo skewer over flames, in a gold-ringed medallion) into both places it
shows: src/ui/fishEmblem.ts (the app's loading veil, cooked by --done) and index.html's first splash (raw). Run: python scripts/fish-emblem.py"""
import math
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# colours raw -> cooked, mixed in CSS by --done (0..1)
def mixc(raw, done):
    return f"color-mix(in oklab, {raw}, {done} calc(var(--done, 0) * 100%))"


BACK = mixc('#3f5f7c', '#8a4a1c')
SIDE = mixc('#9fb3c4', '#d79a4c')
BELLY = mixc('#e8eef2', '#f2d49a')

waves = []
for row in range(5):
    y = 150 + row * 11
    for i in range(-1, 12):
        x = i * 22 + (11 if row % 2 else 0)
        for k, r in enumerate((10, 7, 4)):
            waves.append(f'<path d="M{x - r} {y} A{r} {r} 0 0 1 {x + r} {y}"/>')
seigaiha = ''.join(waves)

scales = ''.join(f'<path d="M{x} {y} q3 -4 6 0"/>' for y in range(82, 100, 5) for x in range(96 + (y % 10), 196, 7))
sparks = ''.join(f'<circle cx="{120 + i * 9}" cy="150" r="{1.1 + (i % 3) * 0.5}" style="animation-delay:{i * 0.31:.2f}s;--dx:{(i % 5 - 2) * 6}px"/>' for i in range(8))
bars = ''.join(f'<path d="M{x} 60 L{x - 22} 130"/>' for x in (112, 136, 160, 184))

BODY = 'M64 98 C78 76 118 68 160 72 C192 75 212 86 226 96 C212 106 192 115 160 118 C118 122 80 118 64 98 Z'
svg = f'''<svg class="fish-emblem" viewBox="0 0 300 220" aria-hidden="true">
<defs>
<radialGradient id="fe-disc" cx="0.5" cy="0.42" r="0.6"><stop offset="0" stop-color="#3a2416"/><stop offset="1" stop-color="#160d07"/></radialGradient>
<linearGradient id="fe-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:{BACK}"/><stop offset="0.45" style="stop-color:{SIDE}"/><stop offset="1" style="stop-color:{BELLY}"/></linearGradient>
<linearGradient id="fe-flame" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff5a1f"/><stop offset="0.6" stop-color="#ffa63a"/><stop offset="1" stop-color="#ffe08a"/></linearGradient>
<linearGradient id="fe-flame2" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffb347"/><stop offset="1" stop-color="#fff2c4"/></linearGradient>
<linearGradient id="fe-stick" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b98a4e"/><stop offset="1" stop-color="#e2c08a"/></linearGradient>
<clipPath id="fe-in"><circle cx="150" cy="110" r="96"/></clipPath>
<clipPath id="fe-fish"><path d="{BODY}"/></clipPath>
</defs>
<circle cx="150" cy="110" r="104" fill="none" stroke="#c9a24a" stroke-width="1.2" opacity="0.55"/>
<circle cx="150" cy="110" r="98" fill="url(#fe-disc)" stroke="#c9a24a" stroke-width="2.4"/>
<g clip-path="url(#fe-in)">
<g fill="none" stroke="#c9a24a" stroke-width="1" opacity="0.16">{seigaiha}</g>
<g class="fe-flames">
<path class="fe-f1" d="M96 206 C88 176 104 160 112 146 C114 166 126 170 126 186 C126 196 118 206 96 206 Z" fill="url(#fe-flame)"/>
<path class="fe-f2" d="M130 206 C118 168 142 150 150 128 C156 152 176 164 172 190 C170 200 160 206 130 206 Z" fill="url(#fe-flame)"/>
<path class="fe-f3" d="M172 206 C166 182 182 168 190 152 C194 172 206 178 204 192 C202 200 194 206 172 206 Z" fill="url(#fe-flame)"/>
<path class="fe-f2" d="M138 206 C134 186 146 174 150 160 C154 174 166 184 162 198 C160 204 152 206 138 206 Z" fill="url(#fe-flame2)" opacity="0.85"/>
</g>
<g class="fe-sparks" fill="#ffd27a">{sparks}</g>
</g>
<g transform="rotate(-16 150 100)">
<line x1="28" y1="100" x2="270" y2="100" stroke="url(#fe-stick)" stroke-width="4" stroke-linecap="round"/>
<path d="M44 98 v4 M250 98 v4" stroke="#8a6234" stroke-width="1.5"/>
<g class="fe-fish">
<path d="M222 96 C232 86 244 78 256 72 C250 88 250 104 256 120 C244 114 232 106 222 96 Z" style="fill:{BACK}"/>
<path d="M240 82 C246 78 251 75 256 72 C252 82 251 90 251 96" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" class="fe-salt"/>
<path d="M240 110 C246 114 251 117 256 120 C252 110 251 102 251 96" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" class="fe-salt"/>
<path d="M126 74 C134 58 150 54 166 66 C158 70 146 72 126 74 Z" style="fill:{BACK}"/>
<path d="M134 68 C142 60 152 58 162 64" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" class="fe-salt"/>
<path d="M150 116 C156 128 168 132 178 126 C168 122 160 120 150 116 Z" style="fill:{SIDE}"/>
<path d="{BODY}" fill="url(#fe-body)"/>
<g clip-path="url(#fe-fish)">
<g fill="none" stroke="#fff" stroke-width="0.9" opacity="0.18">{scales}</g>
<path d="M84 98 C120 92 170 92 220 96" fill="none" stroke="#1a120c" stroke-width="0.9" opacity="0.35"/>
<g class="fe-bars" fill="none" stroke="#3a1c08" stroke-width="7" stroke-linecap="round">{bars}</g>
<g class="fe-crust" fill="#fff">{''.join(f'<circle cx="{86 + (i * 37) % 134}" cy="{80 + (i * 17) % 34}" r="{1.0 if i % 3 else 1.6}"/>' for i in range(30))}</g>
</g>
<path d="{BODY}" fill="none" stroke="#1a120c" stroke-width="2.2"/>
<path d="M92 82 C99 92 99 104 91 114" fill="none" stroke="#1a120c" stroke-width="1.8" stroke-linecap="round"/>
<circle cx="80" cy="94" r="5.2" fill="#f6efe2" stroke="#1a120c" stroke-width="1.6"/>
<circle cx="80.6" cy="94.3" r="2.6" fill="#1a120c"/>
<circle cx="81.6" cy="93.2" r="0.9" fill="#fff"/>
</g>
</g>
<g class="fe-steam" fill="none" stroke="#efe2c8" stroke-width="2.4" stroke-linecap="round" opacity="0.8">
<path d="M118 40 c-6 -8 6 -14 0 -22" style="animation-delay:0s"/><path d="M150 34 c-6 -8 6 -14 0 -22" style="animation-delay:.7s"/><path d="M182 40 c-6 -8 6 -14 0 -22" style="animation-delay:1.4s"/>
</g>
</svg>'''
svg = re.sub(r'\n', '', svg)

CSS = """.fish-emblem { width: min(300px, 64vw); height: auto; margin-bottom: -10px; overflow: visible; filter: drop-shadow(0 12px 22px rgb(0 0 0 / 0.5)); }
.fish-emblem .fe-flames path { transform-box: fill-box; transform-origin: 50% 100%; animation: fe-flick 1.1s ease-in-out infinite alternate; }
.fish-emblem .fe-f2 { animation-duration: 0.8s !important; animation-delay: -0.3s !important; }
.fish-emblem .fe-f3 { animation-duration: 1.3s !important; animation-delay: -0.6s !important; }
.fish-emblem .fe-sparks circle { opacity: 0; animation: fe-spark 2.4s ease-out infinite; }
.fish-emblem .fe-fish { animation: fe-bob 3s ease-in-out infinite; transform-origin: 150px 100px; }
.fish-emblem .fe-steam path { opacity: 0; animation: fe-steam 2.4s ease-out infinite; }
.fish-emblem .fe-bars { opacity: calc((var(--done, 0) - 0.3) * 1.1); }
.fish-emblem .fe-crust { opacity: calc(0.2 + var(--done, 0) * 0.7); }
.fish-emblem .fe-salt { opacity: calc(0.35 + var(--done, 0) * 0.6); }
@keyframes fe-flick { 0% { transform: scale(1, 1); } 50% { transform: scale(0.94, 1.08) skewX(2deg); } 100% { transform: scale(1.04, 0.95) skewX(-2deg); } }
@keyframes fe-spark { 0% { opacity: 0; transform: translate(0, 0); } 15% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--dx, 0), -70px); } }
@keyframes fe-bob { 50% { transform: translateY(-2px) rotate(-0.8deg); } }
@keyframes fe-steam { 0% { opacity: 0; transform: translateY(8px); } 35% { opacity: 0.75; } 100% { opacity: 0; transform: translateY(-14px); } }
@media (prefers-reduced-motion: reduce) { .fish-emblem * { animation: none !important; } }"""

ts = ('// (written by scripts/fish-emblem.py: edit it there and run it, not here)\n'
      f'export const FISH_EMBLEM = {repr(svg)}\n')
ts = ts.replace("export const FISH_EMBLEM = '", "export const FISH_EMBLEM = '")
open(os.path.join(ROOT, 'src', 'ui', 'fishEmblem.ts'), 'w', encoding='utf-8').write(ts)

p = os.path.join(ROOT, 'src', 'index.css')
s = open(p, encoding='utf-8').read()
s = re.sub(r'\n/\* ---- fish emblem \(scripts/fish-emblem\.py\) ---- \*/.*?/\* ---- end fish emblem ---- \*/\n', '\n', s, flags=re.S)
s += '\n/* ---- fish emblem (scripts/fish-emblem.py) ---- */\n' + CSS + '\n/* ---- end fish emblem ---- */\n'
open(p, 'w', encoding='utf-8').write(s)

p = os.path.join(ROOT, 'index.html')
s = open(p, encoding='utf-8').read()
s = re.sub(r'<svg class="(grilling-fish|fish-emblem)".*?</svg>', lambda m: svg, s, count=1, flags=re.S)
s = re.sub(r'      /\* fish emblem \*/.*?/\* end fish emblem \*/\n', '', s, flags=re.S)
s = s.replace('    </style>', '      /* fish emblem */\n' + '\n'.join('      ' + l.replace('.fish-emblem', '#boot .fish-emblem') for l in CSS.split('\n')) + '\n      /* end fish emblem */\n    </style>', 1)
open(p, 'w', encoding='utf-8').write(s)
print('ok', len(svg))
