#!/usr/bin/env python3
import sys, json, os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, black, white, grey, Color
from reportlab.platypus import Paragraph
from reportlab.lib.styles import getSampleStyleSheet

LOGO_PATH = "/home/claude/logo_thermeo_sm.png"

W, H = A4
ML = 14*mm
MR = W - 14*mm
PW = MR - ML

BLUE_DARK  = HexColor('#1a3a6b')
BLUE_MID   = HexColor('#1a5c96')
BLUE_LIGHT = HexColor('#dce8f4')
GRAY_BG    = HexColor('#f7f7f7')
GRAY_LINE  = HexColor('#cccccc')
GREEN_OK   = HexColor('#27ae60')
GREEN_BG   = HexColor('#d4edda')
RED_NOK    = HexColor('#c0392b')
RED_BG     = HexColor('#f8d7da')
ORANGE     = HexColor('#e67e22')
ORANGE_BG  = HexColor('#fff3cd')
AMBER      = HexColor('#f39c12')

# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def hline(c, y, x1=None, x2=None, color=GRAY_LINE, lw=0.3):
    c.setStrokeColor(color)
    c.setLineWidth(lw)
    c.line(x1 or ML, y, x2 or MR, y)

def vline(c, x, y1, y2, color=GRAY_LINE, lw=0.3):
    c.setStrokeColor(color)
    c.setLineWidth(lw)
    c.line(x, y1, x, y2)

def section_bar(c, y, title, color=BLUE_DARK, h=6.5*mm):
    c.setFillColor(color)
    c.rect(ML, y - h + 1*mm, PW, h, fill=1, stroke=0)
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(ML + 3*mm, y - h + 3.5*mm, title.upper())
    return y - h - 1.5*mm

def mini_bar(c, y, title, x=None, w=None, color=BLUE_LIGHT, h=5.5*mm):
    x = x or ML
    w = w or PW
    c.setFillColor(color)
    c.rect(x, y - h + 1*mm, w, h, fill=1, stroke=0)
    c.setFillColor(BLUE_MID)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(x + 2*mm, y - h + 2.5*mm, title)
    return y - h - 1*mm

def kv(c, y, label, value, x=None, lbl_w=50*mm, row_h=5.2*mm, bg=None, val_color=black, bold_val=True):
    x = x or ML
    if bg:
        c.setFillColor(bg)
        c.rect(x, y - row_h + 0.8*mm, PW - (x - ML), row_h, fill=1, stroke=0)
    c.setFillColor(HexColor('#555555'))
    c.setFont("Helvetica", 7)
    c.drawString(x + 1.5*mm, y - row_h + 2.2*mm, label)
    c.setFillColor(val_color)
    c.setFont("Helvetica-Bold" if bold_val else "Helvetica", 7.5)
    c.drawString(x + lbl_w, y - row_h + 2.2*mm, str(value) if value else "—")
    return y - row_h

def kv2(c, y, items, row_h=5.2*mm, bg=None):
    """items = [(label, value, x, lbl_w), ...]"""
    if bg:
        c.setFillColor(bg)
        c.rect(ML, y - row_h + 0.8*mm, PW, row_h, fill=1, stroke=0)
    for lbl, val, x, lw in items:
        c.setFillColor(HexColor('#555555'))
        c.setFont("Helvetica", 7)
        c.drawString(x + 1.5*mm, y - row_h + 2.2*mm, lbl)
        c.setFillColor(black)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(x + lw, y - row_h + 2.2*mm, str(val) if val else "—")
    return y - row_h

def status_badge(c, x, y, text, w=22*mm, h=4.5*mm):
    t = str(text).upper()
    if t in ("OUI","OK","CONFORME","PRÉSENT","PRESENT","AUTOMATIQUE","AUTO","CORRECT","FONCTIONNEL"):
        bg, fg = GREEN_BG, GREEN_OK
    elif t in ("NON","NOK","NON CONFORME","NON OK","ABSENT"):
        bg, fg = RED_BG, RED_NOK
    elif t in ("PAS APPLICABLE","N/A","—",""):
        bg, fg = GRAY_BG, HexColor('#888888')
    else:
        bg, fg = BLUE_LIGHT, BLUE_MID
    c.setFillColor(bg)
    c.roundRect(x, y - h + 0.5*mm, w, h, 2, fill=1, stroke=0)
    c.setFillColor(fg)
    c.setFont("Helvetica-Bold", 7)
    tw = c.stringWidth(text or "—", "Helvetica-Bold", 7)
    c.drawString(x + (w - tw)/2, y - h + 2*mm, text or "—")

def check_row(c, y, label, value, x=None, val_x=None, row_h=5.5*mm, bg=None):
    x = x or ML
    vx = val_x or (ML + PW * 0.72)
    if bg:
        c.setFillColor(bg)
        c.rect(x, y - row_h + 0.8*mm, PW - (x - ML), row_h, fill=1, stroke=0)
    c.setFillColor(HexColor('#333333'))
    c.setFont("Helvetica", 7.5)
    c.drawString(x + 2*mm, y - row_h + 2.2*mm, label)
    status_badge(c, vx, y, str(value) if value else "—", w=28*mm)
    return y - row_h

def wrap_text(c, text, x, y, max_w, font, size, lh=4.5*mm):
    c.setFont(font, size)
    words = str(text).split()
    line = ""
    lines = []
    for word in words:
        test = line + (" " if line else "") + word
        if c.stringWidth(test, font, size) <= max_w:
            line = test
        else:
            if line: lines.append(line)
            line = word
    if line: lines.append(line)
    for i, l in enumerate(lines):
        c.drawString(x, y - i * lh, l)
    return y - len(lines) * lh

def new_page_if_needed(c, y, needed=40*mm):
    if y < needed:
        c.showPage()
        return H - 18*mm
    return y

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def generate_pdf(data, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)

    is_pellet    = str(data.get("combustible","")).startswith("Pellet")
    is_gaz       = str(data.get("combustible","")).startswith("Gaz")
    is_condensation = str(data.get("condensation","")).lower() == "oui"
    is_solide    = str(data.get("combustible","")).startswith("Solide")
    type_att     = data.get("type_attestation","periodique")
    label_att    = "CONTRÔLE PÉRIODIQUE" if type_att == "periodique" else "RÉCEPTION"
    pnom         = float(data.get("gen_puissance","0") or 0)

    # ══════════════════════════════════════════
    # HEADER
    # ══════════════════════════════════════════
    c.setFillColor(BLUE_DARK)
    c.rect(0, H - 24*mm, W, 24*mm, fill=1, stroke=0)

    # Logo
    try:
        if os.path.exists(LOGO_PATH):
            c.drawImage(LOGO_PATH, ML, H - 22*mm, width=14*mm, height=14*mm, mask='auto', preserveAspectRatio=True)
    except:
        pass

    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(ML + 18*mm, H - 10*mm, f"ATTESTATION DE {label_att}")
    c.setFont("Helvetica", 8)
    c.drawString(ML + 18*mm, H - 15.5*mm, "Générateur de chaleur — combustibles liquides, gazeux et solides")
    c.drawString(ML + 18*mm, H - 19.5*mm, "Conformément à l'AGW du 29/01/2009 — Région Wallonne")

    c.setFillColor(BLUE_LIGHT)
    c.roundRect(W - 65*mm, H - 21*mm, 50*mm, 16*mm, 3, fill=1, stroke=0)
    c.setFillColor(BLUE_DARK)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(W - 63*mm, H - 10*mm, f"N° attestation :")
    c.setFont("Helvetica-Bold", 9)
    c.drawString(W - 63*mm, H - 14.5*mm, data.get("n_rapport","") or "—")
    c.setFont("Helvetica", 7.5)
    c.drawString(W - 63*mm, H - 18.5*mm, f"Date : {data.get('date','')}")

    y = H - 27*mm

    # ══════════════════════════════════════════
    # VOLET 1 — IDENTIFICATION
    # ══════════════════════════════════════════
    y = section_bar(c, y, "VOLET 1 — IDENTIFICATION ADMINISTRATIVE ET TECHNIQUE")

    # Nature du contrôle
    nature = data.get("nature_controle","Contrôle périodique")
    ramonage = data.get("ramonage","Non")
    c.setFillColor(ORANGE_BG)
    c.rect(ML, y - 6*mm, PW, 6.5*mm, fill=1, stroke=0)
    c.setFillColor(ORANGE)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(ML + 2*mm, y - 4*mm, f"Nature du contrôle : {nature}    |    Ramonage effectué : {ramonage}")
    y -= 7.5*mm

    # 2 colonnes : technicien | client
    cw = PW / 2 - 2*mm
    y_tech = mini_bar(c, y, "TECHNICIEN AGRÉÉ", x=ML, w=cw)
    y_cli  = mini_bar(c, y, "DEMANDEUR / CLIENT", x=ML + cw + 4*mm, w=cw)

    tech_rows = [
        ("Nom :", data.get("tech_nom","")),
        ("N° agrément :", data.get("tech_agrement","")),
        ("Entreprise :", data.get("tech_entreprise","")),
        ("Tél :", data.get("tech_tel","")),
        ("E-mail :", data.get("tech_email","")),
        ("N° entreprise :", data.get("tech_nentreprise","")),
        ("OCA :", data.get("tech_oca","Non")),
    ]
    cli_rows = [
        ("Nom / Prénom :", data.get("client_nom","")),
        ("Qualité :", data.get("client_qualite","")),
        ("Entreprise :", data.get("client_entreprise","")),
        ("Adresse :", data.get("client_adresse","")),
        ("Localité :", data.get("client_localite","")),
        ("Tél :", data.get("client_tel","")),
        ("E-mail :", data.get("client_email","")),
    ]

    yl, yr = y_tech, y_cli
    RH = 5.0*mm
    for i, (lbl, val) in enumerate(tech_rows):
        bg = GRAY_BG if i % 2 == 0 else None
        if bg:
            c.setFillColor(bg)
            c.rect(ML, yl - RH + 0.5*mm, cw, RH, fill=1, stroke=0)
        c.setFillColor(HexColor('#666666'))
        c.setFont("Helvetica", 7)
        c.drawString(ML + 1.5*mm, yl - RH + 1.8*mm, lbl)
        c.setFillColor(black)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(ML + 22*mm, yl - RH + 1.8*mm, str(val) if val else "—")
        yl -= RH

    for i, (lbl, val) in enumerate(cli_rows):
        xr = ML + cw + 4*mm
        bg = GRAY_BG if i % 2 == 0 else None
        if bg:
            c.setFillColor(bg)
            c.rect(xr, yr - RH + 0.5*mm, cw, RH, fill=1, stroke=0)
        c.setFillColor(HexColor('#666666'))
        c.setFont("Helvetica", 7)
        c.drawString(xr + 1.5*mm, yr - RH + 1.8*mm, lbl)
        c.setFillColor(black)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(xr + 23*mm, yr - RH + 1.8*mm, str(val) if val else "—")
        yr -= RH

    y = min(yl, yr) - 3*mm

    # Localisation générateur
    loc = data.get("localisation_gen","IDEM")
    c.setFillColor(GRAY_BG)
    c.rect(ML, y - 5*mm, PW, 5.5*mm, fill=1, stroke=0)
    c.setFillColor(HexColor('#555555'))
    c.setFont("Helvetica", 7)
    c.drawString(ML + 2*mm, y - 3.2*mm, "Localisation du générateur si différente :")
    c.setFillColor(black)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(ML + 65*mm, y - 3.2*mm, str(loc) if loc else "IDEM")
    y -= 7*mm

    # ─── GÉNÉRATEUR ───────────────────────────
    y = mini_bar(c, y, "GÉNÉRATEUR DE CHALEUR")

    # Combustible + plaque + condensation + raccordement
    y = kv2(c, y, [
        ("Combustible :", data.get("combustible",""), ML, 24*mm),
        ("Raccordement :", data.get("raccordement",""), ML + PW*0.30, 25*mm),
        ("Condensation :", data.get("condensation",""), ML + PW*0.60, 25*mm),
        ("Plaque signalétiqu. :", data.get("plaque_signaletique","Oui"), ML + PW*0.80, 25*mm),
    ], bg=GRAY_BG)

    # Brûleur adaptatif
    bruleur_info = []
    if is_gaz or is_pellet:
        if data.get("type_bruleur"):
            bruleur_info.append(("Type brûleur :", data.get("type_bruleur",""), ML, 24*mm))
        if data.get("type_unit_gaz") and is_gaz:
            bruleur_info.append(("Unit gaz :", data.get("type_unit_gaz",""), ML + PW*0.30, 25*mm))
    if not is_pellet and not is_solide:
        bruleur_info.append(("Nb allures :", data.get("nb_allures","1"), ML + PW*0.60, 24*mm))

    if bruleur_info:
        y = kv2(c, y, bruleur_info)

    # Données chaudière
    y = kv2(c, y, [
        ("Marque :", data.get("gen_marque",""), ML, 18*mm),
        ("Type / Modèle :", data.get("gen_type",""), ML + PW*0.28, 28*mm),
        ("Puissance (kW) :", data.get("gen_puissance",""), ML + PW*0.60, 27*mm),
        ("Année :", data.get("gen_annee",""), ML + PW*0.82, 15*mm),
    ], bg=GRAY_BG)

    y = kv2(c, y, [
        ("N° série :", data.get("gen_serie",""), ML, 18*mm),
        ("Nb générateurs :", data.get("nb_gen","1"), ML + PW*0.45, 27*mm),
        ("Id. si plusieurs :", data.get("gen_id_multiple",""), ML + PW*0.65, 27*mm),
    ])

    # Installation
    y = kv2(c, y, [
        ("Fluide caloporteur :", data.get("fluide","Eau"), ML, 32*mm),
        ("Production :", data.get("production",""), ML + PW*0.40, 24*mm),
        ("Permis urbanisme :", data.get("permis_urbanisme",""), ML + PW*0.65, 30*mm),
    ], bg=GRAY_BG)

    if is_pellet:
        y = kv2(c, y, [
            ("Norme appareil :", data.get("pellet_norme",""), ML, 28*mm),
            ("Alimentation :", data.get("pellet_alimentation",""), ML + PW*0.45, 25*mm),
            ("Qualité pellets :", data.get("v2_qualite_pellet",""), ML + PW*0.70, 25*mm),
        ])

    y -= 3*mm

    # ══════════════════════════════════════════
    # VOLET 1B — INSTALLATION / VÉRIFICATION TECHNIQUE
    # ══════════════════════════════════════════
    y = new_page_if_needed(c, y, 80*mm)
    y = section_bar(c, y, "VOLET 1B — VÉRIFICATIONS RELATIVES À L'INSTALLATION")

    checks_install = [
        ("1. Raccordement brûleur-chaudière (si applicable)", data.get("v2_raccordement","Pas applicable")),
        ("2. Adéquation chaudière-brûleur (si applicable)", data.get("v2_adequation","Pas applicable")),
        ("3. Orifice de mesure", data.get("v2_orifice","Conforme")),
    ]
    if not (is_condensation and str(data.get("raccordement","")).startswith("C")):
        checks_install.append(("4. Pression de cheminée (type B tirage naturel)", data.get("v2_pression_cheminee","Pas applicable")))

    checks_ventil = [
        ("Conformité ventilation du local de chauffe", data.get("v2_ventilation","Oui")),
        ("Conformité amenée d'air comburant", data.get("v2_air_comburant","Oui")),
        ("Conformité évacuation gaz de combustion", data.get("v2_evacuation","Oui")),
        ("Instructions d'utilisation et d'entretien", data.get("v2_instructions","Présent")),
        ("Note de calcul du dimensionnement", data.get("v2_dimensionnement","Pas applicable")),
    ]

    if is_pellet:
        checks_ventil += [
            ("Évacuation / bac à cendres conforme", data.get("v2_cendres","Conforme")),
            ("Silo / stockage pellets conforme", data.get("v2_silo","Conforme")),
        ]

    # En-têtes colonnes
    c.setFillColor(BLUE_LIGHT)
    c.rect(ML, y - 5*mm, PW*0.72, 5.5*mm, fill=1, stroke=0)
    c.rect(ML + PW*0.73, y - 5*mm, PW*0.27, 5.5*mm, fill=1, stroke=0)
    c.setFillColor(BLUE_MID)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(ML + 2*mm, y - 3.2*mm, "Vérification")
    c.drawString(ML + PW*0.74, y - 3.2*mm, "Résultat")
    y -= 6.5*mm

    all_checks = checks_install + checks_ventil
    for i, (lbl, val) in enumerate(all_checks):
        y = check_row(c, y, lbl, val, bg=GRAY_BG if i%2==0 else None)

    # Pression cheminée si type B
    if data.get("pression_cheminee_mesuree"):
        y = kv2(c, y, [
            ("Pression cheminée mesurée :", data.get("pression_cheminee_mesuree","") + " Pa", ML, 52*mm),
            ("Prescrite fabricant :", data.get("pression_cheminee_prescrite","< -5 Pa"), ML + PW*0.60, 35*mm),
        ], bg=GRAY_BG)

    # Conformité globale V1B
    v1b_ok = data.get("v2_global","Oui")
    bg_v1b = GREEN_BG if v1b_ok == "Oui" else RED_BG
    fg_v1b = GREEN_OK if v1b_ok == "Oui" else RED_NOK
    c.setFillColor(bg_v1b)
    c.rect(ML, y - 6*mm, PW, 6.5*mm, fill=1, stroke=0)
    c.setFillColor(fg_v1b)
    c.setFont("Helvetica-Bold", 8)
    icon = "✓" if v1b_ok == "Oui" else "✗"
    c.drawString(ML + 3*mm, y - 4*mm, f"{icon}  Conformité globale installation (I, II, III & IV) : {v1b_ok.upper()}")
    y -= 8.5*mm

    # ══════════════════════════════════════════
    # VOLET 2 — RÉGULATION & POMPES
    # ══════════════════════════════════════════
    y = new_page_if_needed(c, y, 70*mm)
    y = section_bar(c, y, "VOLET 2 — INSPECTION SYSTÈME DE RÉGULATION ET POMPE(S) DE CIRCULATION")

    reg_checks = [
        ("Régulation en mode automatique ?", data.get("reg_automatique","Oui"), "Si non : inciter l'utilisateur à repasser en automatique"),
        ("Thermostat d'ambiance fonctionnel ? (pas de code d'erreur)", data.get("reg_thermostat","Oui"), ""),
        ("Horloge (si présente) correctement réglée ?", data.get("reg_horloge","Oui"), ""),
        ("Programmation nuit / réduit activée ?", data.get("reg_programmation_nuit","Oui"), "Si non : conseiller la configuration"),
    ]

    c.setFillColor(BLUE_LIGHT)
    c.rect(ML, y - 5*mm, PW*0.55, 5.5*mm, fill=1, stroke=0)
    c.rect(ML + PW*0.56, y - 5*mm, PW*0.17, 5.5*mm, fill=1, stroke=0)
    c.rect(ML + PW*0.74, y - 5*mm, PW*0.26, 5.5*mm, fill=1, stroke=0)
    c.setFillColor(BLUE_MID)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(ML + 2*mm, y - 3.2*mm, "Inspection régulation")
    c.drawString(ML + PW*0.57, y - 3.2*mm, "Résultat")
    c.drawString(ML + PW*0.75, y - 3.2*mm, "Remarque si NON")
    y -= 6.5*mm

    for i, (lbl, val, remarque) in enumerate(reg_checks):
        bg = GRAY_BG if i%2==0 else None
        if bg:
            c.setFillColor(bg)
            c.rect(ML, y - 5.5*mm, PW, 5.5*mm, fill=1, stroke=0)
        c.setFillColor(HexColor('#333333'))
        c.setFont("Helvetica", 7.5)
        c.drawString(ML + 2*mm, y - 3.5*mm, lbl)
        status_badge(c, ML + PW*0.56, y, str(val), w=26*mm)
        if remarque and str(val).upper() in ("NON","NOK"):
            c.setFillColor(ORANGE)
            c.setFont("Helvetica", 6.5)
            c.drawString(ML + PW*0.75, y - 3.5*mm, remarque)
        y -= 6*mm

    y -= 2*mm

    # Pompes
    y = mini_bar(c, y, "POMPE(S) DE CIRCULATION")
    pompe_checks = [
        ("Mode de fonctionnement pompe(s) de chauffage", data.get("pompe_mode","Automatique")),
        ("Dysfonctionnement(s) détecté(s) (bruit anormal, vibration...)", data.get("pompe_dysfonctionnement","Non")),
    ]
    if data.get("pompe_ecs"):
        pompe_checks.append(("Pompe ECS — fonctionnement", data.get("pompe_ecs","")))

    for i, (lbl, val) in enumerate(pompe_checks):
        y = check_row(c, y, lbl, val, bg=GRAY_BG if i%2==0 else None)

    if data.get("pompe_remarques"):
        c.setFillColor(ORANGE_BG)
        c.rect(ML, y - 8*mm, PW, 8.5*mm, fill=1, stroke=0)
        c.setFillColor(HexColor('#7a4f00'))
        c.setFont("Helvetica-Bold", 7)
        c.drawString(ML + 2*mm, y - 2.5*mm, "Remarques pompe(s) :")
        c.setFillColor(black)
        c.setFont("Helvetica", 7)
        wrap_text(c, data.get("pompe_remarques",""), ML + 2*mm, y - 5.5*mm, PW - 4*mm, "Helvetica", 7, 4*mm)
        y -= 10*mm

    y -= 3*mm

    # ══════════════════════════════════════════
    # VOLET 3 — CONTRÔLE DE COMBUSTION
    # ══════════════════════════════════════════
    y = new_page_if_needed(c, y, 80*mm)
    y = section_bar(c, y, "VOLET 3 — CONTRÔLE DE COMBUSTION")

    pm = data.get("perf_min", {})
    valeurs = data.get("valeurs_combustion", {})
    is_pellet_doc = data.get("is_pellet", False)

    # Colonnes selon combustible
    if is_pellet_doc:
        col_defs = [
            ("co_ppm", "CO MAX\nà 13% O₂ (ppm)", True),
            ("rendement", "Rendement\nMIN (%)", False),
        ]
    elif is_gaz:
        col_defs = [
            ("t_nette", "T° nette fumées\nMAX (°C)", True),
            ("co2", "CO₂ MIN\n(%)", False),
            ("o2", "O₂ MAX\n(%)", True),
            ("co", "CO MAX\n(mg/kWh)", True),
            ("rendement", "Rendement\nMIN (%)", False),
        ]
    else:
        col_defs = [
            ("indice_fumee", "Indice fumée\nMAX (Bacharach)", True),
            ("t_nette", "T° nette fumées\nMAX (°C)", True),
            ("co2", "CO₂ MIN (%)", False),
            ("o2", "O₂ MAX (%)", True),
            ("co", "CO MAX\n(mg/kWh)", True),
            ("rendement", "Rendement\nMIN (%)", False),
        ]

    n_cols = len(col_defs)
    lbl_w = 32*mm
    data_w = (PW - lbl_w) / n_cols

    # Tableau header
    c.setFillColor(BLUE_LIGHT)
    c.rect(ML, y - 9*mm, PW, 9.5*mm, fill=1, stroke=0)
    c.setFillColor(BLUE_MID)
    c.setFont("Helvetica-Bold", 6.5)
    c.drawString(ML + 2*mm, y - 5.5*mm, "Mesure")
    for j, (key, label, _) in enumerate(col_defs):
        lines = label.split("\n")
        x_col = ML + lbl_w + j * data_w
        for li, ln in enumerate(lines):
            c.drawCentredString(x_col + data_w/2, y - 3.5*mm - li * 3.5*mm, ln)
    y -= 10.5*mm

    def comb_row(c, y, row_label, row_data, is_compare=False, bg=None):
        rh = 5.5*mm
        if bg:
            c.setFillColor(bg)
            c.rect(ML, y - rh + 0.5*mm, PW, rh, fill=1, stroke=0)
        c.setFillColor(black)
        c.setFont("Helvetica-Bold" if is_compare else "Helvetica", 7.5)
        c.drawString(ML + 2*mm, y - rh + 2*mm, row_label)
        for j, (key, _, _) in enumerate(col_defs):
            val = str(row_data.get(key,"") or "")
            x_col = ML + lbl_w + j * data_w
            if is_compare:
                if val.upper() == "OK":
                    c.setFillColor(GREEN_OK)
                    c.setFont("Helvetica-Bold", 8)
                elif val.upper() == "NOK":
                    c.setFillColor(RED_NOK)
                    c.setFont("Helvetica-Bold", 8)
                elif val == "N/A":
                    c.setFillColor(HexColor('#888888'))
                    c.setFont("Helvetica", 7)
                else:
                    c.setFillColor(HexColor('#888888'))
                    c.setFont("Helvetica", 7)
            else:
                c.setFillColor(HexColor('#555555') if row_label.startswith("Perf") else black)
                c.setFont("Helvetica", 7.5)
            if val:
                c.drawCentredString(x_col + data_w/2, y - rh + 2*mm, val)
        hline(c, y - rh + 0.5*mm, color=HexColor('#dddddd'))
        return y - rh

    # Perf min
    y = comb_row(c, y, "Perf. min réglementaires", pm, bg=GRAY_BG)
    # Valeurs mesurées (allure nominale)
    y = comb_row(c, y, "Valeurs mesurées — Pnom", valeurs)

    # Allures multiples
    nb_allures = int(data.get("nb_allures","1") or 1)
    if nb_allures > 1 or data.get("type_bruleur","") == "Modulant":
        allure_labels = ["Allure 1 / Pmin","Allure 2 (25% modulant)","Allure 3 (50% modulant)","Allure 4 (75% modulant)"]
        for ai in range(min(nb_allures, 4)):
            allure_data = data.get(f"allure_{ai+1}", {})
            if any(v for v in allure_data.values() if v):
                y = comb_row(c, y, allure_labels[ai], allure_data)

    # Comparaison
    cmp_data = {key: data.get(f"cmp_{key}","") for key, _, _ in col_defs}
    # Remettre les valeurs mesurées dans la ligne comparaison
    y = comb_row(c, y, "Comparaison", cmp_data, is_compare=True, bg=BLUE_LIGHT)

    y -= 2*mm

    # Résultat global combustion
    res = data.get("resultat_combustion","")
    bg_r = GREEN_BG if res == "OK" else (RED_BG if res == "NOK" else GRAY_BG)
    fg_r = GREEN_OK if res == "OK" else (RED_NOK if res == "NOK" else HexColor('#888888'))
    c.setFillColor(bg_r)
    c.rect(ML, y - 6*mm, PW, 6.5*mm, fill=1, stroke=0)
    c.setFillColor(fg_r)
    c.setFont("Helvetica-Bold", 8.5)
    icon_r = "✓" if res == "OK" else ("✗" if res == "NOK" else "")
    c.drawString(ML + 3*mm, y - 4*mm, f"{icon_r}  RÉSULTAT GLOBAL COMBUSTION : {res or '—'}")
    c.setFillColor(HexColor('#555555'))
    c.setFont("Helvetica", 7)
    c.drawRightString(MR - 2*mm, y - 4*mm, f"T° eau lors mesure : {data.get('temp_eau','—') or '—'} °C")
    y -= 8.5*mm

    # ══════════════════════════════════════════
    # VOLET 3B — DIAGNOSTIC APPROFONDI (si Pnom > 20 kW)
    # ══════════════════════════════════════════
    if pnom > 20 or data.get("diagnostic_approfondi_present"):
        y = new_page_if_needed(c, y, 55*mm)
        y = section_bar(c, y, f"VOLET 3B — DIAGNOSTIC APPROFONDI (Pnom = {data.get('gen_puissance','?')} kW > 20 kW)", color=HexColor('#2c4a7c'))

        diag_checks = [
            ("A. Un rapport de diagnostic approfondi est-il présent ?", data.get("diag_rapport_present","Non")),
            ("B. Modification du système ou des exigences depuis le dernier diagnostic ?", data.get("diag_modification","Non")),
            ("C. Modification réalisée après le 30 avril 2015 ?", data.get("diag_modification_2015","Non")),
            ("D. Au moins 2 ans depuis la modification ?", data.get("diag_2ans","Non")),
            ("E. Le diagnostic a-t-il déjà été reporté ?", data.get("diag_reporte","Non")),
        ]
        for i, (lbl, val) in enumerate(diag_checks):
            y = check_row(c, y, lbl, val, bg=GRAY_BG if i%2==0 else None)
        y -= 3*mm

    # ══════════════════════════════════════════
    # VOLET 4 — DÉCLARATION DE CONFORMITÉ
    # ══════════════════════════════════════════
    y = new_page_if_needed(c, y, 65*mm)
    y = section_bar(c, y, "VOLET 4 — DÉCLARATION DE CONFORMITÉ AGW 29/01/2009")

    conf = data.get("declaration_conformite","Non")
    bg_conf = GREEN_BG if conf == "Oui" else RED_BG
    fg_conf = GREEN_OK if conf == "Oui" else RED_NOK
    icon_conf = "✓" if conf == "Oui" else "✗"

    c.setFillColor(bg_conf)
    c.rect(ML, y - 11*mm, PW, 11.5*mm, fill=1, stroke=0)
    c.setFillColor(fg_conf)
    c.setFont("Helvetica", 8)
    c.drawString(ML + 3*mm, y - 4.5*mm, "L'ensemble installation — ventilation — amenée d'air — évacuation gaz est-il conforme à l'AGW ?")
    c.setFont("Helvetica-Bold", 14)
    c.drawString(ML + 3*mm, y - 10*mm, f"{icon_conf}  {conf.upper()}")
    c.setFont("Helvetica", 7)
    c.setFillColor(HexColor('#555555'))
    c.drawRightString(MR - 2*mm, y - 9.5*mm, "Cond : Volet 1B = OUI  +  Résultat combustion = OK")
    y -= 13.5*mm

    # Causes de non-conformité
    causes = data.get("causes_non_conformite","")
    if causes:
        c.setFillColor(ORANGE_BG)
        c.rect(ML, y - 5*mm, PW, 5.5*mm, fill=1, stroke=0)
        c.setFillColor(ORANGE)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(ML + 2*mm, y - 3.2*mm, "Causes de non-conformité et actions à entreprendre :")
        y -= 6.5*mm
        c.setFillColor(ORANGE_BG)
        c.rect(ML, y - 15*mm, PW, 16*mm, fill=1, stroke=0)
        c.setFillColor(black)
        c.setFont("Helvetica", 7.5)
        yn = wrap_text(c, causes, ML + 2*mm, y - 2.5*mm, PW - 4*mm, "Helvetica", 7.5, 4.5*mm)
        y = min(y - 18*mm, yn - 2*mm)

    # Remarques
    remarques = data.get("remarques","")
    if remarques:
        c.setFillColor(HexColor('#555555'))
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(ML, y - 2.5*mm, "Autres remarques :")
        y -= 5.5*mm
        c.setFillColor(black)
        c.setFont("Helvetica", 7.5)
        yn = wrap_text(c, remarques, ML + 2*mm, y - 1.5*mm, PW - 4*mm, "Helvetica", 7.5, 4.5*mm)
        y = min(y - 14*mm, yn - 3*mm)

    y -= 2*mm

    # ══════════════════════════════════════════
    # VOLET 5 — PROCHAINES INTERVENTIONS & SIGNATURES
    # ══════════════════════════════════════════
    y = new_page_if_needed(c, y, 70*mm)
    y = section_bar(c, y, "VOLET 5 — PROCHAINES INTERVENTIONS ET SIGNATURES")

    # Réception positive/négative
    recep_pos = "Oui" if conf == "Oui" else "Non"
    recep_neg = "Non" if conf == "Oui" else "Oui"

    c.setFillColor(GREEN_BG if recep_pos == "Oui" else GRAY_BG)
    c.rect(ML, y - 5.5*mm, PW/2 - 2*mm, 6*mm, fill=1, stroke=0)
    c.setFillColor(RED_BG if recep_neg == "Oui" else GRAY_BG)
    c.rect(ML + PW/2 + 2*mm, y - 5.5*mm, PW/2 - 2*mm, 6*mm, fill=1, stroke=0)
    c.setFillColor(GREEN_OK if recep_pos == "Oui" else HexColor('#888888'))
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(ML + 3*mm, y - 3.8*mm, f"Réception positive : {recep_pos}")
    c.setFillColor(RED_NOK if recep_neg == "Oui" else HexColor('#888888'))
    c.drawString(ML + PW/2 + 5*mm, y - 3.8*mm, f"Réception négative : {recep_neg}")
    y -= 7.5*mm

    interventions = [
        ("Mise en conformité au plus tard le :", data.get("mise_conformite_date","")),
        ("Prochain contrôle périodique entre :", (data.get("prochain_controle_debut","") or "") + (" → " + data.get("prochain_controle_fin","") if data.get("prochain_controle_fin") else "")),
        ("Prochain entretien constructeur au plus tard le :", data.get("prochain_entretien","")),
        ("Analyse de combustion (DA) au plus tard le :", data.get("prochaine_da","")),
        ("Diagnostic approfondi entre :", (data.get("diag_date_debut","") or "") + (" → " + data.get("diag_date_fin","") if data.get("diag_date_fin") else "")),
    ]

    for i, (lbl, val) in enumerate(interventions):
        if val and val.strip() not in ("", "→ ", " → "):
            bg = GRAY_BG if i%2==0 else None
            if bg:
                c.setFillColor(bg)
                c.rect(ML, y - 5.2*mm, PW, 5.5*mm, fill=1, stroke=0)
            c.setFillColor(HexColor('#555555'))
            c.setFont("Helvetica", 7.5)
            c.drawString(ML + 2*mm, y - 3.2*mm, lbl)
            c.setFillColor(BLUE_DARK)
            c.setFont("Helvetica-Bold", 8)
            c.drawString(ML + 85*mm, y - 3.2*mm, val)
            y -= 5.5*mm

    y -= 5*mm
    hline(c, y, color=GRAY_LINE, lw=0.5)
    y -= 7*mm

    # Signatures
    sig_w = PW/2 - 5*mm
    for xi, (title, name, qual) in enumerate([
        ("Rapport réalisé par :", data.get("tech_nom",""), data.get("tech_agrement","")),
        ("Rapport reçu par :", data.get("client_nom",""), "En qualité de : " + str(data.get("client_qualite",""))),
    ]):
        x0 = ML + xi*(sig_w + 10*mm)
        c.setFillColor(BLUE_LIGHT)
        c.rect(x0, y - 5*mm, sig_w, 5.5*mm, fill=1, stroke=0)
        c.setFillColor(BLUE_MID)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(x0 + 2*mm, y - 3.2*mm, title)
        y2 = y - 8*mm
        c.setFillColor(black)
        c.setFont("Helvetica-Bold", 8)
        c.drawString(x0 + 2*mm, y2, name)
        c.setFillColor(HexColor('#555555'))
        c.setFont("Helvetica", 7)
        c.drawString(x0 + 2*mm, y2 - 4.5*mm, qual)

    y -= 10*mm
    SH = 22*mm
    for xi in range(2):
        x0 = ML + xi*(sig_w + 10*mm)
        c.setStrokeColor(GRAY_LINE)
        c.setLineWidth(0.5)
        c.rect(x0, y - SH, sig_w, SH)
        c.setFillColor(HexColor('#bbbbbb'))
        c.setFont("Helvetica", 7)
        c.drawString(x0 + 2*mm, y - SH + 3*mm, "Signature")

    y -= SH + 8*mm

    # Mention urgence gaz
    c.setFillColor(RED_BG)
    c.rect(ML, y - 8*mm, PW, 8.5*mm, fill=1, stroke=0)
    c.setFillColor(RED_NOK)
    c.setFont("Helvetica-Bold", 7)
    c.drawString(ML + 3*mm, y - 3*mm, "ATTENTION — En cas de danger : Secours ORES 0800 87 087  |  SOS gaz EANDIS/FLUXYS 0800 65 065  |  Urgences 100/112")
    c.setFont("Helvetica", 6.5)
    c.setFillColor(HexColor('#721c24'))
    c.drawString(ML + 3*mm, y - 6.5*mm, "En cas de non-conformité, l'utilisateur et le propriétaire sont avertis. Un écrit signé leur est remis, chacun en recevant une copie.")
    y -= 10.5*mm

    # ══════════════════════════════════════════
    # FOOTER
    # ══════════════════════════════════════════
    c.setFillColor(BLUE_DARK)
    c.rect(0, 0, W, 9*mm, fill=1, stroke=0)
    try:
        if os.path.exists(LOGO_PATH):
            c.drawImage(LOGO_PATH, ML, 1*mm, width=7*mm, height=7*mm, mask='auto', preserveAspectRatio=True)
    except:
        pass
    c.setFillColor(white)
    c.setFont("Helvetica-Bold", 7.5)
    c.drawString(ML + 9*mm, 5*mm, "Thermeo")
    c.setFont("Helvetica", 7)
    c.drawString(ML + 9*mm, 2*mm, f"{data.get('tech_tel','')}  •  {data.get('tech_email','')}")
    c.setFont("Helvetica", 7)
    c.drawRightString(MR, 5*mm, f"AGW 29/01/2009 — Région wallonne")
    c.drawRightString(MR, 2*mm, f"Attestation N° {data.get('n_rapport','')}  |  {data.get('date','')}")

    c.save()
    return output_path

if __name__ == "__main__":
    # Lecture depuis fichier JSON (chemin passé en argv[1])
    import json as _json
    with open(sys.argv[1], 'r') as _f:
        data = _json.load(_f)
    out = sys.argv[2]
    generate_pdf(data, out)
    print(f"OK:{out}")
