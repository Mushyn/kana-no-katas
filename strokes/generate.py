"""
Générateur SVG d'ordre de tracé pour les kanas japonais.
Chaque SVG 200x200 montre le kana avec ses traits numérotés et des flèches directionnelles.
"""

import os, math

OUT = os.path.dirname(__file__)

# ── Helpers SVG ──────────────────────────────────────────────────────────────

def pt(x, y): return (x, y)

def arrow_head(x1, y1, x2, y2, size=7):
    """Retourne le SVG d'une flèche au bout du segment (x1,y1)→(x2,y2)."""
    angle = math.atan2(y2 - y1, x2 - x1)
    a1 = angle + math.pi * 0.8
    a2 = angle - math.pi * 0.8
    ax1, ay1 = x2 + size * math.cos(a1), y2 + size * math.sin(a1)
    ax2, ay2 = x2 + size * math.cos(a2), y2 + size * math.sin(a2)
    return f'<polygon points="{x2:.1f},{y2:.1f} {ax1:.1f},{ay1:.1f} {ax2:.1f},{ay2:.1f}" fill="#E53935"/>'

def stroke_svg(points, color="#1565C0", width=6):
    """Trait courbe (polyline) avec flèche à la fin."""
    if len(points) < 2:
        return ""
    d = " ".join(f"{p[0]},{p[1]}" for p in points)
    svg = f'<polyline points="{d}" stroke="{color}" stroke-width="{width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    # flèche sur les 2 derniers points
    p1, p2 = points[-2], points[-1]
    svg += arrow_head(p1[0], p1[1], p2[0], p2[1])
    return svg

def number_badge(x, y, n):
    """Cercle numéroté pour l'ordre du trait."""
    return (f'<circle cx="{x}" cy="{y}" r="9" fill="#E53935"/>'
            f'<text x="{x}" y="{y+4}" text-anchor="middle" font-size="11" '
            f'font-family="sans-serif" font-weight="bold" fill="white">{n}</text>')

def make_svg(kana_char, strokes_data):
    """
    strokes_data = liste de traits, chaque trait = liste de (x,y).
    Le repère est 200x200.
    """
    W = H = 200
    parts = []
    parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">')
    # fond
    parts.append(f'<rect width="{W}" height="{H}" fill="#FAFAFA" rx="12"/>')
    # lignes guides légères
    parts.append(f'<line x1="{W//2}" y1="10" x2="{W//2}" y2="{H-10}" stroke="#E0E0E0" stroke-width="1" stroke-dasharray="4,4"/>')
    parts.append(f'<line x1="10" y1="{H//2}" x2="{W-10}" y2="{H//2}" stroke="#E0E0E0" stroke-width="1" stroke-dasharray="4,4"/>')
    # kana fantôme
    parts.append(f'<text x="{W//2}" y="{H//2+52}" text-anchor="middle" font-size="140" '
                 f'font-family="serif" fill="#EEEEEE" dominant-baseline="middle">{kana_char}</text>')
    # traits
    for i, stroke in enumerate(strokes_data):
        color = "#1565C0"
        parts.append(stroke_svg(stroke, color=color))
        # badge au début du trait
        sx, sy = stroke[0]
        parts.append(number_badge(sx, sy, i + 1))
    parts.append('</svg>')
    return "\n".join(parts)

def save(romaji, char, strokes_data):
    svg = make_svg(char, strokes_data)
    path = os.path.join(OUT, f"{romaji}.svg")
    with open(path, "w", encoding="utf-8") as f:
        f.write(svg)

# ── Données de tracé (repère 200x200, marges ~20px) ─────────────────────────
# Convention : points de contrôle réalistes pour chaque kana.
# Les traits suivent l'ordre canonique ZNKR/Heisig.

STROKES = {

# ── HIRAGANA ─────────────────────────────────────────────────────────────────

"a": ("あ", [
    [(60,50),(140,50)],                                   # 1 trait horizontal haut
    [(100,50),(100,100),(80,140),(60,160)],               # 2 vertical courbe gauche
    [(80,90),(130,110),(150,130),(130,160),(90,170),(60,155)],  # 3 boucle droite
]),
"i": ("い", [
    [(65,50),(55,120),(65,155),(80,165)],                 # 1 courbe gauche
    [(130,50),(120,110),(100,150),(80,170),(65,165)],     # 2 courbe droite
]),
"u": ("う", [
    [(100,35),(120,45),(115,55),(100,55)],                # 1 petit trait courbe haut
    [(70,70),(130,70),(145,100),(130,140),(100,165),(70,155),(60,130)],  # 2 grande boucle
]),
"e": ("え", [
    [(60,60),(140,60)],                                   # 1 horizontal
    [(100,60),(105,100),(140,130),(120,155),(90,165),(70,155),(65,135),(80,115),(120,100)],  # 2 spirale
]),
"o": ("お", [
    [(60,50),(140,50)],                                   # 1 horizontal
    [(100,50),(100,100),(75,140),(60,160)],               # 2 vertical gauche
    [(80,95),(140,105),(155,130),(140,155),(110,165),(80,158),(70,140)],  # 3 boucle
]),

"ka": ("か", [
    [(70,45),(70,165)],                                   # 1 vertical
    [(55,90),(145,90)],                                   # 2 horizontal
    [(120,90),(140,110),(135,140),(115,160),(95,160)],    # 3 courbe droite
]),
"ki": ("き", [
    [(55,55),(145,55)],                                   # 1 horizontal haut
    [(55,90),(145,90)],                                   # 2 horizontal milieu
    [(100,90),(100,130)],                                 # 3 vertical court
    [(80,130),(100,165),(125,155),(135,130),(120,110)],   # 4 boucle bas
]),
"ku": ("く", [
    [(140,50),(70,100),(140,160)],                        # 1 chevron
]),
"ke": ("け", [
    [(70,40),(70,165)],                                   # 1 vertical
    [(70,80),(150,80)],                                   # 2 horizontal
    [(150,80),(145,140),(130,165)],                       # 3 courbe droite
]),
"ko": ("こ", [
    [(60,65),(145,65)],                                   # 1 horizontal haut
    [(60,130),(145,130)],                                 # 2 horizontal bas
]),

"sa": ("さ", [
    [(55,60),(145,60)],                                   # 1 horizontal haut
    [(55,100),(145,100)],                                 # 2 horizontal bas
    [(110,60),(115,130),(100,160),(75,165),(60,150)],     # 3 courbe
]),
"si": ("し", [
    [(100,40),(95,120),(100,155),(120,168),(140,160)],    # 1 courbe en J
]),
"su": ("す", [
    [(60,55),(145,55)],                                   # 1 horizontal
    [(100,55),(105,100),(140,125),(125,155),(95,165),(70,155),(65,130)],  # 2 boucle
    [(105,155),(115,170)],                                # 3 petit trait bas
]),
"se": ("せ", [
    [(75,45),(75,165)],                                   # 1 vertical
    [(55,80),(145,80)],                                   # 2 horizontal haut
    [(55,130),(145,110),(140,155)],                       # 3 courbe bas
]),
"so": ("そ", [
    [(60,55),(140,55),(130,85),(60,100)],                 # 1 trait + courbe haut
    [(70,120),(140,120),(145,150),(120,168),(85,160),(65,140)],  # 2 boucle bas
]),

"ta": ("た", [
    [(60,55),(145,55)],                                   # 1 horizontal
    [(100,55),(95,100)],                                  # 2 vertical court
    [(55,90),(145,90)],                                   # 3 horizontal
    [(120,90),(140,115),(130,150),(105,165),(80,158),(70,135)],  # 4 boucle
]),
"ti": ("ち", [
    [(60,55),(145,55)],                                   # 1 horizontal
    [(105,55),(110,95),(145,115),(135,150),(105,165),(75,155),(65,130),(75,110),(110,95)],  # 2 spirale
]),
"tu": ("つ", [
    [(60,60),(140,75),(150,115),(130,155),(95,168),(65,155),(55,125)],  # 1 grande courbe
]),
"te": ("て", [
    [(60,65),(145,65),(130,100),(100,115)],               # 1 horizontal + courbe
    [(100,115),(85,145),(95,165),(120,168),(140,155)],    # 2 boucle bas
]),
"to": ("と", [
    [(90,40),(85,100)],                                   # 1 vertical
    [(70,100),(150,100),(155,135),(130,160),(95,165),(70,148)],  # 2 boucle
]),

"na": ("な", [
    [(60,60),(145,60)],                                   # 1 horizontal
    [(100,60),(95,110),(70,150),(55,165)],                # 2 courbe gauche
    [(80,100),(140,115),(145,150),(120,165),(90,158),(80,135)],  # 3 boucle
    [(130,158),(140,170)],                                # 4 petit
]),
"ni": ("に", [
    [(70,50),(70,165)],                                   # 1 vertical
    [(70,100),(145,100)],                                 # 2 horizontal
    [(145,100),(145,155),(65,155)],                       # 3 L inversé
]),
"nu": ("ぬ", [
    [(70,50),(65,120),(80,158),(105,165),(130,155),(140,125),(110,100),(75,95)],  # 1 boucle gauche
    [(110,100),(150,130),(145,158),(120,170),(95,162)],   # 2 boucle droite
    [(140,155),(150,168)],                                # 3 petit
]),
"ne": ("ね", [
    [(70,45),(65,165)],                                   # 1 vertical
    [(65,90),(145,90)],                                   # 2 horizontal
    [(120,90),(130,125),(115,155),(90,165),(70,155),(65,130)],  # 3 boucle
    [(110,150),(120,168)],                                # 4 petit
]),
"no": ("の", [
    [(100,40),(130,60),(145,100),(130,145),(100,165),(70,155),(55,120),(65,85),(100,70),(130,80)],  # 1 spirale
]),

"ha": ("は", [
    [(70,45),(70,165)],                                   # 1 vertical
    [(70,95),(145,95)],                                   # 2 horizontal
    [(115,95),(125,130),(110,160),(85,165),(70,150)],     # 3 boucle gauche
    [(135,95),(150,130),(140,160),(115,168),(90,160)],    # 4 boucle droite
]),
"hi": ("ひ", [
    [(80,50),(70,120),(80,158),(110,168),(140,155),(150,120),(130,90),(95,80),(70,90)],  # 1 grande boucle
    [(130,145),(148,168)],                                # 2 petit
]),
"hu": ("ふ", [
    [(100,35),(115,50),(110,65),(90,65),(80,52)],         # 1 haut
    [(55,85),(145,85)],                                   # 2 horizontal
    [(75,85),(60,120),(80,155),(100,162)],                # 3 gauche
    [(125,85),(140,120),(125,155),(100,162),(80,155)],    # 4 droite
]),
"he": ("へ", [
    [(50,100),(100,50),(155,100)],                        # 1 chevron
]),
"ho": ("ほ", [
    [(75,40),(70,165)],                                   # 1 vertical
    [(70,90),(150,90)],                                   # 2 horizontal
    [(110,90),(120,125),(105,158),(80,165),(65,150)],     # 3 boucle gauche
    [(135,90),(150,125),(138,158),(112,168),(90,160)],    # 4 boucle droite
]),

"ma": ("ま", [
    [(60,65),(145,65)],                                   # 1 horizontal haut
    [(60,100),(145,100)],                                 # 2 horizontal bas
    [(100,100),(105,135),(140,155),(125,170),(95,165),(70,150),(65,125)],  # 3 boucle
]),
"mi": ("み", [
    [(65,55),(80,90),(70,120),(80,155),(100,165)],        # 1 gauche
    [(95,55),(110,80),(100,100),(120,130),(140,158),(125,170),(100,165)],  # 2 droite boucle
    [(130,150),(148,168)],                                # 3 petit
]),
"mu": ("む", [
    [(65,65),(145,65),(145,105),(65,105),(65,65)],        # 1 rectangle ouvert
    [(105,105),(120,145),(105,165),(80,162),(68,140)],    # 2 boucle
    [(118,155),(130,170)],                                # 3 petit
]),
"me": ("め", [
    [(75,55),(65,125),(80,158),(105,165),(130,155),(140,125),(120,100),(80,90),(65,105)],  # 1 boucle gauche
    [(115,105),(148,140),(140,165),(115,170),(90,162)],   # 2 droite
]),
"mo": ("も", [
    [(60,65),(145,65)],                                   # 1 horizontal haut
    [(60,100),(145,100)],                                 # 2 horizontal
    [(100,65),(100,135),(120,158),(100,168),(75,160),(65,135)],  # 3 boucle
]),

"ya": ("や", [
    [(75,55),(65,120),(75,158),(100,165)],                # 1 gauche
    [(100,55),(130,85),(145,120),(130,155),(100,165),(75,158)],  # 2 boucle droite
]),
"yu": ("ゆ", [
    [(65,75),(65,140),(100,158)],                         # 1 gauche
    [(65,105),(145,105)],                                 # 2 horizontal
    [(145,75),(145,140),(110,158)],                       # 3 droite
]),
"yo": ("よ", [
    [(60,65),(145,65)],                                   # 1 horizontal haut
    [(100,65),(100,168)],                                 # 2 vertical
    [(60,120),(145,120)],                                 # 3 horizontal bas
]),

"ra": ("ら", [
    [(60,60),(145,60)],                                   # 1 horizontal
    [(100,60),(105,100),(140,130),(125,158),(95,165),(70,155),(65,130),(80,110),(115,100)],  # 2 spirale
]),
"ri": ("り", [
    [(75,45),(70,130),(80,160),(100,168)],                # 1 gauche
    [(130,45),(130,165)],                                 # 2 droite vertical
]),
"ru": ("る", [
    [(70,55),(130,55),(145,85),(125,105),(85,105),(70,125),(80,158),(105,168),(135,158),(148,130)],  # 1 spirale
]),
"re": ("れ", [
    [(75,45),(70,165)],                                   # 1 vertical
    [(70,90),(145,90),(140,135),(110,158),(80,165),(68,148)],  # 2 horizontal + boucle
]),
"ro": ("ろ", [
    [(60,65),(145,65),(140,105),(60,105)],                # 1 haut
    [(80,105),(65,145),(80,165),(110,170),(140,158),(150,125)],  # 2 boucle bas
]),

"wa": ("わ", [
    [(75,45),(70,165)],                                   # 1 vertical
    [(70,90),(145,90),(140,135),(115,160),(85,165),(70,150)],  # 2 boucle droite
]),
"wo": ("を", [
    [(60,55),(145,55)],                                   # 1 haut
    [(60,85),(145,85)],                                   # 2 milieu
    [(100,85),(95,130),(80,160),(60,170)],                # 3 gauche
    [(100,85),(130,120),(145,150),(130,168),(100,168),(75,158)],  # 4 boucle droite
]),
"n": ("ん", [
    [(80,50),(75,120),(90,155),(115,165),(140,155),(150,120),(130,90),(90,80),(70,95)],  # 1 spirale
]),

# ── KATAKANA ─────────────────────────────────────────────────────────────────

"A": ("ア", [
    [(55,65),(145,65)],                                   # 1 horizontal
    [(120,65),(100,168)],                                 # 2 diagonal
]),
"I": ("イ", [
    [(80,45),(55,165)],                                   # 1 diagonal gauche
    [(130,45),(130,165)],                                 # 2 vertical droite
]),
"U": ("ウ", [
    [(100,35),(115,50),(110,65),(95,65)],                 # 1 petit haut
    [(55,85),(145,85)],                                   # 2 horizontal
    [(100,85),(100,168)],                                 # 3 vertical
]),
"E": ("エ", [
    [(55,60),(145,60)],                                   # 1 horizontal haut
    [(100,60),(100,148)],                                 # 2 vertical
    [(55,148),(145,148)],                                 # 3 horizontal bas
]),
"O": ("オ", [
    [(55,65),(145,65)],                                   # 1 horizontal
    [(100,40),(100,168)],                                 # 2 vertical
    [(65,110),(145,130)],                                 # 3 diagonal
]),

"KA": ("カ", [
    [(55,60),(145,60)],                                   # 1 horizontal
    [(110,60),(100,168)],                                 # 2 vertical
]),
"KI": ("キ", [
    [(55,60),(145,60)],                                   # 1 horizontal haut
    [(55,100),(145,100)],                                 # 2 horizontal milieu
    [(100,60),(100,168)],                                 # 3 vertical
]),
"KU": ("ク", [
    [(100,45),(145,75),(145,120)],                        # 1 diagonal + vertical
    [(55,90),(145,90),(130,165)],                         # 2 horizontal + diagonal
]),
"KE": ("ケ", [
    [(75,40),(75,168)],                                   # 1 vertical
    [(75,85),(145,65)],                                   # 2 diagonal haut
    [(75,115),(145,135),(140,168)],                       # 3 diagonal bas
]),
"KO": ("コ", [
    [(55,55),(145,55),(145,100)],                         # 1 haut + droite
    [(55,148),(145,148)],                                 # 2 bas
]),

"SA": ("サ", [
    [(80,45),(80,105)],                                   # 1 vertical gauche
    [(125,45),(125,105)],                                 # 2 vertical droite
    [(55,90),(145,90)],                                   # 3 horizontal
    [(100,105),(90,168)],                                 # 4 diagonal bas
]),
"SI": ("シ", [
    [(70,75),(90,65),(95,80)],                            # 1 petit haut gauche
    [(100,95),(120,85),(125,100)],                        # 2 petit haut droite
    [(55,125),(100,105),(150,140),(130,168)],             # 3 diagonal bas
]),
"SU": ("ス", [
    [(55,65),(145,65),(100,115)],                         # 1 horizontal + diagonal
    [(100,115),(80,155),(55,170)],                        # 2 diagonal gauche
]),
"SE": ("セ", [
    [(75,50),(75,148)],                                   # 1 vertical
    [(55,100),(145,100)],                                 # 2 horizontal
    [(55,148),(145,148),(145,110)],                       # 3 bas + remontée
]),
"SO": ("ソ", [
    [(70,50),(90,95),(70,135)],                           # 1 gauche
    [(125,50),(145,95),(100,168)],                        # 2 droite diagonal
]),

"TA": ("タ", [
    [(55,60),(145,60)],                                   # 1 horizontal
    [(115,60),(145,100)],                                 # 2 diagonal droite
    [(55,95),(130,120),(100,168),(65,168)],               # 3 courbe bas
]),
"TI": ("チ", [
    [(55,60),(145,60)],                                   # 1 horizontal haut
    [(55,100),(145,100)],                                 # 2 horizontal bas
    [(115,100),(100,168)],                                # 3 vertical
]),
"TU": ("ツ", [
    [(65,60),(85,50),(90,65)],                            # 1 petit gauche
    [(100,75),(120,65),(125,80)],                         # 2 petit milieu
    [(55,115),(100,95),(150,130),(130,168)],              # 3 diagonal bas
]),
"TE": ("テ", [
    [(55,60),(145,60)],                                   # 1 horizontal haut
    [(55,100),(145,100)],                                 # 2 horizontal bas
    [(100,60),(100,168)],                                 # 3 vertical
]),
"TO": ("ト", [
    [(80,40),(80,168)],                                   # 1 vertical
    [(80,90),(148,120)],                                  # 2 diagonal droite
]),

"NA": ("ナ", [
    [(55,90),(145,90)],                                   # 1 horizontal
    [(100,50),(100,168)],                                 # 2 vertical
]),
"NI": ("ニ", [
    [(60,75),(140,75)],                                   # 1 horizontal haut
    [(55,135),(145,135)],                                 # 2 horizontal bas
]),
"NU": ("ヌ", [
    [(55,75),(145,75)],                                   # 1 horizontal
    [(140,75),(60,148),(100,168),(145,155)],              # 2 diagonal + boucle
]),
"NE": ("ネ", [
    [(55,60),(145,60)],                                   # 1 horizontal
    [(100,60),(100,120)],                                 # 2 vertical
    [(65,100),(100,120),(135,100)],                       # 3 V
    [(100,120),(80,168)],                                 # 4 diagonal gauche
    [(100,120),(125,168)],                                # 5 diagonal droite
]),
"NO": ("ノ", [
    [(140,40),(60,168)],                                  # 1 diagonal
]),

"HA": ("ハ", [
    [(90,50),(65,165)],                                   # 1 gauche
    [(110,50),(138,165)],                                 # 2 droite
]),
"HI": ("ヒ", [
    [(65,50),(65,168)],                                   # 1 vertical
    [(65,110),(145,110),(145,168)],                       # 2 horizontal + droite
]),
"HU": ("フ", [
    [(55,60),(145,60),(140,100),(100,148),(65,168)],      # 1 horizontal + courbe
]),
"HE": ("ヘ", [
    [(50,110),(100,55),(150,110)],                        # 1 chevron
]),
"HO": ("ホ", [
    [(100,40),(100,168)],                                 # 1 vertical
    [(55,95),(145,95)],                                   # 2 horizontal
    [(68,95),(55,168)],                                   # 3 diagonal gauche
    [(135,95),(148,168)],                                 # 4 diagonal droite
]),

"MA": ("マ", [
    [(55,65),(145,65)],                                   # 1 horizontal
    [(145,65),(100,110),(65,168)],                        # 2 diagonal gauche
    [(80,90),(130,168)],                                  # 3 diagonal droite
]),
"MI": ("ミ", [
    [(65,60),(135,60)],                                   # 1 haut
    [(60,100),(140,100)],                                 # 2 milieu
    [(55,140),(145,140)],                                 # 3 bas
]),
"MU": ("ム", [
    [(100,40),(65,100),(100,168),(145,115),(100,100)],    # 1 boucle
    [(100,100),(55,168)],                                 # 2 diagonal
]),
"ME": ("メ", [
    [(55,75),(145,115)],                                  # 1 diagonal droite
    [(145,60),(100,115),(55,168)],                        # 2 diagonal gauche
]),
"MO": ("モ", [
    [(55,60),(145,60)],                                   # 1 horizontal haut
    [(55,100),(145,100)],                                 # 2 horizontal milieu
    [(100,60),(100,168)],                                 # 3 vertical
    [(55,148),(145,148)],                                 # 4 horizontal bas
]),

"YA": ("ヤ", [
    [(80,50),(80,168)],                                   # 1 vertical
    [(55,80),(145,80)],                                   # 2 horizontal
    [(120,80),(120,168)],                                 # 3 vertical droite
]),
"YU": ("ユ", [
    [(55,65),(145,65)],                                   # 1 horizontal haut
    [(100,65),(100,148)],                                 # 2 vertical
    [(55,148),(145,148)],                                 # 3 horizontal bas
]),
"YO": ("ヨ", [
    [(55,55),(145,55),(145,100)],                         # 1 haut + droite
    [(55,100),(145,100)],                                 # 2 milieu
    [(55,148),(145,148),(145,100)],                       # 3 bas + remontée
]),

"RA": ("ラ", [
    [(55,65),(145,65)],                                   # 1 horizontal
    [(145,65),(110,115),(65,168)],                        # 2 diagonal bas
]),
"RI": ("リ", [
    [(75,45),(75,148),(90,168)],                          # 1 gauche courbe
    [(130,45),(130,168)],                                 # 2 vertical droite
]),
"RU": ("ル", [
    [(75,45),(65,148),(80,168),(100,158)],                # 1 gauche
    [(130,45),(130,120),(65,168)],                        # 2 droite diagonal
]),
"RE": ("レ", [
    [(80,45),(75,148),(110,168),(145,145)],               # 1 courbe bas
]),
"RO": ("ロ", [
    [(60,55),(145,55),(145,155),(60,155),(60,55)],        # 1 rectangle
]),

"WA": ("ワ", [
    [(55,60),(145,60),(145,100)],                         # 1 haut + droite
    [(80,60),(65,168)],                                   # 2 vertical gauche
]),
"WO": ("ヲ", [
    [(55,55),(145,55)],                                   # 1 haut
    [(55,90),(145,90)],                                   # 2 milieu
    [(110,55),(100,168)],                                 # 3 vertical
]),
"N": ("ン", [
    [(70,60),(90,50),(95,65)],                            # 1 petit haut
    [(140,55),(60,168)],                                  # 2 diagonal
]),
}

# ── Génération ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    for romaji, (char, strokes_data) in STROKES.items():
        save(romaji, char, strokes_data)
    print(f"✓ {len(STROKES)} SVGs générés dans {OUT}/")
