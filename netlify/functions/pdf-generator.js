const PDFDocument = require('pdfkit');

// ── Palette Thermeo ──
const BLUE      = '#2234F0';
const BLUE_MID  = '#505FF3';
const BLUE_LIGHT= '#FFFFFF';
const DARK      = '#2E323A';
const DARK_MID  = '#5D5653';
const GRAY      = '#E7E8EC';
const WHITE     = '#FEFEFE';
const GREEN     = '#1db954';
const GREEN_BG  = '#e6f9ed';
const RED       = '#EF2A24';
const RED_BG    = '#fde8e8';
const ORANGE    = '#F88539';
const ORANGE_BG = '#fff3e6';
const GRAY_LINE = '#D0D5DD';

const ML = 20, MR_MARGIN = 20;

function hex(color) { return color; }

function generateAttestation(data) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;
    const PW = W - ML - MR_MARGIN;

    const isPellet = (data.combustible || '').startsWith('Pellet');
    const isGaz    = (data.combustible || '').startsWith('Gaz');
    const typeAtt  = data.type_attestation || 'periodique';
    const labelAtt = typeAtt === 'periodique' ? 'CONTRÔLE PÉRIODIQUE' : 'RÉCEPTION';
    const pnom     = parseFloat(data.gen_puissance || '0') || 0;

    let y = 0;

    // ─── helpers ───────────────────────────────────────
    function hline(yy, x1, x2, color = GRAY_LINE, lw = 0.3) {
      doc.save().strokeColor(color).lineWidth(lw)
        .moveTo(x1 || ML, yy).lineTo(x2 || (W - MR_MARGIN), yy).stroke().restore();
    }

    function rect(x, yy, w, h, fill, stroke) {
      doc.save();
      if (fill) doc.fillColor(fill);
      if (stroke) doc.strokeColor(stroke).lineWidth(0.5);
      if (fill && stroke) doc.rect(x, yy, w, h).fillAndStroke();
      else if (fill) doc.rect(x, yy, w, h).fill();
      else if (stroke) doc.rect(x, yy, w, h).stroke();
      doc.restore();
    }

    function sectionBar(yy, title, color = DARK, h = 9) {
      rect(ML, yy, PW, h, color);
      doc.save().fillColor(WHITE).font('Helvetica-Bold').fontSize(7)
        .text(title.toUpperCase(), ML + 3, yy + 2.5, { width: PW - 6, lineBreak: false })
        .restore();
      return yy + h + 2;
    }

    function miniBar(yy, title, x, w, color = BLUE_LIGHT, h = 7) {
      x = x || ML; w = w || PW;
      rect(x, yy, w, h, color);
      doc.save().fillColor(BLUE).font('Helvetica-Bold').fontSize(7)
        .text(title, x + 2, yy + 1.5, { width: w - 4, lineBreak: false })
        .restore();
      return yy + h + 1;
    }

    function kv2row(yy, items, bg) {
      const rh = 6.5;
      if (bg) rect(ML, yy, PW, rh, bg);
      items.forEach(([lbl, val, x, lw]) => {
        doc.save().fillColor(DARK_MID).font('Helvetica').fontSize(6.5)
          .text(lbl, x + 1.5, yy + 1.8, { width: lw - 2, lineBreak: false }).restore();
        doc.save().fillColor(DARK).font('Helvetica-Bold').fontSize(7)
          .text(val || '—', x + lw, yy + 1.8, { width: 60, lineBreak: false }).restore();
      });
      hline(yy + rh, ML, W - MR_MARGIN, '#EEEEEE');
      return yy + rh;
    }

    function checkRow(yy, label, value, bg) {
      const rh = 6.5;
      const vx = ML + PW * 0.72;
      if (bg) rect(ML, yy, PW, rh, bg);
      doc.save().fillColor(DARK).font('Helvetica').fontSize(7)
        .text(label, ML + 2, yy + 1.8, { width: PW * 0.68, lineBreak: false }).restore();
      // Status badge
      const v = (value || '').toUpperCase();
      let bgC = GRAY, fgC = DARK_MID;
      if (['OUI','OK','CONFORME','PRÉSENT','PRESENT','AUTOMATIQUE','CORRECT'].includes(v)) { bgC = GREEN_BG; fgC = GREEN; }
      else if (['NON','NOK','NON CONFORME'].includes(v)) { bgC = RED_BG; fgC = RED; }
      else if (v === 'PAS APPLICABLE') { bgC = GRAY; fgC = DARK_MID; }
      else { bgC = BLUE_LIGHT; fgC = BLUE; }
      rect(vx, yy + 0.5, 32, rh - 1, bgC);
      const valTxt = value || '—';
      doc.save().fillColor(fgC).font('Helvetica-Bold').fontSize(6)
        .text(valTxt, vx, yy + 2.2, { width: 32, align: 'center', lineBreak: false }).restore();
      hline(yy + rh, ML, W - MR_MARGIN, '#EEEEEE');
      return yy + rh;
    }

    function wrapText(yy, text, x, maxW, font, size, lh) {
      doc.save().fillColor(DARK).font(font).fontSize(size)
        .text(String(text || ''), x, yy, { width: maxW, lineBreak: true }).restore();
      const th = doc.heightOfString(String(text || ''), { width: maxW });
      return yy + Math.max(th, lh || 8);
    }

    function newPageIfNeeded(yy, needed = 50) {
      if (yy > H - needed - 20) { doc.addPage(); return 15; }
      return yy;
    }

    // ══════════════════════════════════════════════════
    // HEADER
    // ══════════════════════════════════════════════════
    rect(0, 0, W, 28, DARK);
    doc.save().fillColor(WHITE).font('Helvetica-Bold').fontSize(12)
      .text(`ATTESTATION DE ${labelAtt}`, ML + 4, 7, { width: W * 0.65 }).restore();
    doc.save().fillColor('#aaaaaa').font('Helvetica').fontSize(7)
      .text('Générateur de chaleur — AGW du 29/01/2009 — Région Wallonne', ML + 4, 18, { width: W * 0.65 }).restore();

    // Bloc numéro en haut à droite
    rect(W - 75, 3, 58, 22, BLUE);
    doc.save().fillColor(WHITE).font('Helvetica-Bold').fontSize(7)
      .text('N° attestation :', W - 73, 6, { width: 54 })
      .font('Helvetica-Bold').fontSize(8.5)
      .text(data.n_rapport || '—', W - 73, 13, { width: 54 })
      .font('Helvetica').fontSize(6.5)
      .text(`Date : ${data.date || ''}`, W - 73, 21.5, { width: 54 })
      .restore();

    y = 32;

    // ══════════════════════════════════════════════════
    // VOLET 1 — IDENTIFICATION
    // ══════════════════════════════════════════════════
    y = sectionBar(y, 'VOLET 1 — IDENTIFICATION ADMINISTRATIVE ET TECHNIQUE');

    // Nature du contrôle
    rect(ML, y, PW, 7, ORANGE_BG);
    doc.save().fillColor(ORANGE).font('Helvetica-Bold').fontSize(7)
      .text(`Nature du contrôle : ${data.nature_controle || '—'}    |    Ramonage : ${data.ramonage || '—'}`, ML + 2, y + 1.5, { width: PW - 4, lineBreak: false }).restore();
    y += 9;

    // 2 colonnes technicien | client
    const cw = PW / 2 - 2;
    let yl = miniBar(y, 'TECHNICIEN AGRÉÉ', ML, cw);
    let yr = miniBar(y, 'DEMANDEUR / CLIENT', ML + cw + 4, cw);

    const techRows = [
      ['Nom :', data.tech_nom], ['Agrément :', data.tech_agrement],
      ['Entreprise :', data.tech_entreprise], ['Tél :', data.tech_tel],
      ['E-mail :', data.tech_email], ['N° TVA :', data.tech_nentreprise],
    ];
    const cliRows = [
      ['Nom / Prénom :', data.client_nom], ['Qualité :', data.client_qualite],
      ['Entreprise :', data.client_entreprise], ['Adresse :', data.client_adresse],
      ['Localité :', data.client_localite], ['Tél :', data.client_tel],
    ];

    const RH = 5.5;
    techRows.forEach(([lbl, val], i) => {
      if (i % 2 === 0) rect(ML, yl, cw, RH, GRAY);
      doc.save().fillColor(DARK_MID).font('Helvetica').fontSize(6.5)
        .text(lbl, ML + 1.5, yl + 1.3, { width: 22, lineBreak: false }).restore();
      doc.save().fillColor(DARK).font('Helvetica-Bold').fontSize(7)
        .text(val || '—', ML + 25, yl + 1.3, { width: cw - 27, lineBreak: false }).restore();
      yl += RH;
    });
    cliRows.forEach(([lbl, val], i) => {
      const xr = ML + cw + 4;
      if (i % 2 === 0) rect(xr, yr, cw, RH, GRAY);
      doc.save().fillColor(DARK_MID).font('Helvetica').fontSize(6.5)
        .text(lbl, xr + 1.5, yr + 1.3, { width: 24, lineBreak: false }).restore();
      doc.save().fillColor(DARK).font('Helvetica-Bold').fontSize(7)
        .text(val || '—', xr + 26, yr + 1.3, { width: cw - 28, lineBreak: false }).restore();
      yr += RH;
    });

    y = Math.max(yl, yr) + 2;

    // Localisation générateur
    y = kv2row(y, [['Localisation du générateur si différente :', data.localisation_gen || 'IDEM', ML, 70]], GRAY);
    y += 2;

    // ─── Générateur ───────────────────────────────────
    y = miniBar(y, 'GÉNÉRATEUR DE CHALEUR');
    y = kv2row(y, [
      ['Combustible :', data.combustible, ML, 22],
      ['Raccordement :', data.raccordement, ML + PW * 0.30, 24],
      ['Condensation :', data.condensation, ML + PW * 0.58, 22],
      ['Plaque signal. :', data.plaque_signaletique, ML + PW * 0.78, 22],
    ], GRAY);
    y = kv2row(y, [
      ['Brûleur :', data.type_bruleur, ML, 16],
      ['Nb allures :', data.nb_allures, ML + PW * 0.28, 20],
      ['Marque :', data.gen_marque, ML + PW * 0.50, 16],
      ['Type :', data.gen_type, ML + PW * 0.72, 12],
    ]);
    y = kv2row(y, [
      ['Puissance (kW) :', data.gen_puissance, ML, 26],
      ['Année :', data.gen_annee, ML + PW * 0.28, 14],
      ['N° série :', data.gen_serie, ML + PW * 0.46, 16],
      ['Nb appareils :', data.nb_gen, ML + PW * 0.78, 20],
    ], GRAY);
    y = kv2row(y, [
      ['Fluide :', data.fluide, ML, 14],
      ['Production :', data.production, ML + PW * 0.25, 20],
      ['Permis urbanisme :', data.permis_urbanisme, ML + PW * 0.55, 28],
    ]);

    if (isPellet) {
      y = kv2row(y, [
        ['Norme :', data.pellet_norme, ML, 14],
        ['Alimentation :', data.pellet_alimentation, ML + PW * 0.35, 22],
        ['Qualité pellets :', data.v2_qualite_pellet, ML + PW * 0.65, 24],
      ], GRAY);
    }
    y += 2;

    // ══════════════════════════════════════════════════
    // VOLET 1B — VÉRIFICATIONS INSTALLATION
    // ══════════════════════════════════════════════════
    y = newPageIfNeeded(y, 80);
    y = sectionBar(y, 'VOLET 1B — VÉRIFICATIONS RELATIVES À L\'INSTALLATION');

    // En-têtes colonnes
    rect(ML, y, PW * 0.72, 6, BLUE_LIGHT);
    rect(ML + PW * 0.73, y, PW * 0.27, 6, BLUE_LIGHT);
    doc.save().fillColor(BLUE).font('Helvetica-Bold').fontSize(6.5)
      .text('Vérification', ML + 2, y + 1.3, { lineBreak: false })
      .text('Résultat', ML + PW * 0.74, y + 1.3, { lineBreak: false }).restore();
    y += 7;

    const checksInstall = [
      ['1. Raccordement brûleur-chaudière (si applicable)', data.v2_raccordement],
      ['2. Adéquation chaudière-brûleur (si applicable)', data.v2_adequation],
      ['3. Orifice de mesure', data.v2_orifice],
      ['4. Pression de cheminée (type B tirage naturel)', data.v2_pression_cheminee],
      ['Conformité ventilation du local de chauffe', data.v2_ventilation],
      ['Conformité amenée d\'air comburant', data.v2_air_comburant],
      ['Conformité évacuation gaz de combustion', data.v2_evacuation],
      ['Instructions d\'utilisation et d\'entretien', data.v2_instructions],
      ['Note de calcul du dimensionnement', data.v2_dimensionnement],
    ];
    if (isPellet) {
      checksInstall.push(['Évacuation / bac à cendres conforme', data.v2_cendres]);
      checksInstall.push(['Silo / stockage pellets conforme', data.v2_silo]);
    }
    checksInstall.forEach(([lbl, val], i) => { y = checkRow(y, lbl, val, i % 2 === 0 ? GRAY : null); });

    // Conformité globale V1B
    const v1bOk = data.v2_global === 'Oui';
    rect(ML, y, PW, 8, v1bOk ? GREEN_BG : RED_BG);
    doc.save().fillColor(v1bOk ? GREEN : RED).font('Helvetica-Bold').fontSize(8)
      .text(`${v1bOk ? '✓' : '✗'}  Conformité globale installation (I, II, III & IV) : ${data.v2_global || '—'}`, ML + 3, y + 2, { width: PW - 6, lineBreak: false }).restore();
    y += 11;

    // ══════════════════════════════════════════════════
    // VOLET 2 — RÉGULATION & POMPES
    // ══════════════════════════════════════════════════
    y = newPageIfNeeded(y, 70);
    y = sectionBar(y, 'VOLET 2 — INSPECTION SYSTÈME DE RÉGULATION ET POMPE(S) DE CIRCULATION');

    const checksReg = [
      ['Régulation en mode automatique ?', data.reg_automatique],
      ['Thermostat d\'ambiance fonctionnel ?', data.reg_thermostat],
      ['Horloge (si présente) correctement réglée ?', data.reg_horloge],
      ['Programmation nuit / mode réduit activée ?', data.reg_programmation_nuit],
      ['Mode de fonctionnement pompe(s)', data.pompe_mode],
      ['Dysfonctionnement pompe détecté (bruit, vibration...)', data.pompe_dysfonctionnement],
      ['Pompe ECS — fonctionnement', data.pompe_ecs],
    ];
    checksReg.forEach(([lbl, val], i) => { y = checkRow(y, lbl, val, i % 2 === 0 ? GRAY : null); });

    if (data.pompe_remarques) {
      rect(ML, y, PW, 10, ORANGE_BG);
      doc.save().fillColor(ORANGE).font('Helvetica-Bold').fontSize(6.5)
        .text('Remarques pompe(s) :', ML + 2, y + 1.5, { lineBreak: false }).restore();
      doc.save().fillColor(DARK).font('Helvetica').fontSize(6.5)
        .text(data.pompe_remarques, ML + 2, y + 5, { width: PW - 4, lineBreak: false }).restore();
      y += 12;
    }
    y += 2;

    // Diagnostic approfondi si Pnom > 20 kW
    if (pnom > 20) {
      y = newPageIfNeeded(y, 50);
      y = sectionBar(y, `DIAGNOSTIC APPROFONDI (Pnom = ${data.gen_puissance} kW > 20 kW)`, BLUE_MID);
      const checksDiag = [
        ['A. Rapport de diagnostic approfondi présent ?', data.diag_rapport_present],
        ['B. Modification du système depuis dernier diagnostic ?', data.diag_modification],
        ['C. Modification réalisée après le 30/04/2015 ?', data.diag_modification_2015],
        ['D. Au moins 2 ans depuis la modification ?', data.diag_2ans],
        ['E. Le diagnostic a-t-il déjà été reporté ?', data.diag_reporte],
      ];
      checksDiag.forEach(([lbl, val], i) => { y = checkRow(y, lbl, val, i % 2 === 0 ? GRAY : null); });
      y += 2;
    }

    // ══════════════════════════════════════════════════
    // VOLET 3 — COMBUSTION
    // ══════════════════════════════════════════════════
    y = newPageIfNeeded(y, 70);
    y = sectionBar(y, 'VOLET 3 — CONTRÔLE DE COMBUSTION');

    const pm = data.perf_min || {};
    const valeurs = data.valeurs_combustion || {};
    let colDefs;
    if (isPellet) {
      colDefs = [['co_ppm', 'CO MAX\nà 13% O₂ (ppm)', true], ['rendement', 'Rendement\nMIN (%)', false]];
    } else if (isGaz) {
      colDefs = [['t_nette','T° nette\nMAX (°C)',true],['co2','CO₂ MIN\n(%)',false],['o2','O₂ MAX\n(%)',true],['co','CO MAX\n(mg/kWh)',true],['rendement','Rendement\nMIN (%)',false]];
    } else {
      colDefs = [['indice_fumee','Indice fumée\nMAX (Bch.)',true],['t_nette','T° nette\nMAX (°C)',true],['co2','CO₂ MIN\n(%)',false],['co','CO MAX\n(mg/kWh)',true],['rendement','Rendement\nMIN (%)',false]];
    }

    const lblW = 30, dataW = (PW - lblW) / colDefs.length;
    // En-tête tableau
    rect(ML, y, PW, 11, BLUE_LIGHT);
    doc.save().fillColor(BLUE).font('Helvetica-Bold').fontSize(6)
      .text('Mesure', ML + 2, y + 3, { width: lblW, lineBreak: false }).restore();
    colDefs.forEach(([key, label], j) => {
      const xc = ML + lblW + j * dataW;
      doc.save().fillColor(BLUE).font('Helvetica-Bold').fontSize(5.5)
        .text(label.replace(/\n/g, '\n'), xc, y + 1.5, { width: dataW, align: 'center' }).restore();
    });
    y += 12;

    const combRows = [
      ['Perf. min réglementaires', colDefs.map(([k]) => pm[k] || '—'), GRAY],
      ['Valeurs mesurées', colDefs.map(([k]) => valeurs[k] || '—'), null],
    ];
    combRows.forEach(([rowLbl, rowVals, bg]) => {
      const rh = 6.5;
      if (bg) rect(ML, y, PW, rh, bg);
      doc.save().fillColor(DARK_MID).font('Helvetica-Bold').fontSize(6.5)
        .text(rowLbl, ML + 2, y + 1.3, { width: lblW - 2, lineBreak: false }).restore();
      rowVals.forEach((val, j) => {
        const xc = ML + lblW + j * dataW;
        doc.save().fillColor(DARK).font('Helvetica').fontSize(7)
          .text(String(val), xc, y + 1.3, { width: dataW, align: 'center', lineBreak: false }).restore();
      });
      hline(y + rh, ML, W - MR_MARGIN, '#EEEEEE');
      y += rh;
    });

    // Ligne comparaison
    rect(ML, y, PW, 7, BLUE_LIGHT);
    doc.save().fillColor(BLUE).font('Helvetica-Bold').fontSize(6.5)
      .text('Comparaison', ML + 2, y + 1.3, { width: lblW - 2, lineBreak: false }).restore();
    colDefs.forEach(([k], j) => {
      const xc = ML + lblW + j * dataW;
      const v = (data[`cmp_${k}`] || '').toUpperCase();
      const fg = v === 'OK' ? GREEN : v === 'NOK' ? RED : DARK_MID;
      const bg2 = v === 'OK' ? GREEN_BG : v === 'NOK' ? RED_BG : GRAY;
      rect(xc + 2, y + 0.5, dataW - 4, 6, bg2);
      doc.save().fillColor(fg).font('Helvetica-Bold').fontSize(7)
        .text(v || '—', xc + 2, y + 1.5, { width: dataW - 4, align: 'center', lineBreak: false }).restore();
    });
    y += 9;

    // Résultat global combustion
    const resOk = data.resultat_combustion === 'OK';
    const resNok = data.resultat_combustion === 'NOK';
    rect(ML, y, PW, 9, resOk ? GREEN_BG : resNok ? RED_BG : GRAY);
    doc.save().fillColor(resOk ? GREEN : resNok ? RED : DARK_MID).font('Helvetica-Bold').fontSize(8.5)
      .text(`${resOk ? '✓' : resNok ? '✗' : ''}  RÉSULTAT GLOBAL COMBUSTION : ${data.resultat_combustion || '—'}`, ML + 3, y + 2, { width: PW * 0.7, lineBreak: false }).restore();
    doc.save().fillColor(DARK_MID).font('Helvetica').fontSize(6.5)
      .text(`T° eau lors mesure : ${data.temp_eau || '—'} °C`, ML + PW * 0.72, y + 3, { width: PW * 0.26, align: 'right', lineBreak: false }).restore();
    y += 12;

    // ══════════════════════════════════════════════════
    // VOLET 4 — DÉCLARATION DE CONFORMITÉ
    // ══════════════════════════════════════════════════
    y = newPageIfNeeded(y, 55);
    y = sectionBar(y, 'VOLET 4 — DÉCLARATION DE CONFORMITÉ AGW 29/01/2009');

    const conf = data.declaration_conformite;
    const confOk = conf === 'Oui';
    rect(ML, y, PW, 13, confOk ? GREEN_BG : RED_BG);
    doc.save().fillColor(confOk ? GREEN : RED).font('Helvetica').fontSize(7.5)
      .text("L'ensemble installation — ventilation — amenée d'air — évacuation gaz est-il conforme à l'AGW ?", ML + 3, y + 2, { width: PW - 6, lineBreak: false }).restore();
    doc.save().fillColor(confOk ? GREEN : RED).font('Helvetica-Bold').fontSize(13)
      .text(`${confOk ? '✓' : '✗'}  ${(conf || '—').toUpperCase()}`, ML + 3, y + 7, { width: PW * 0.5, lineBreak: false }).restore();
    y += 16;

    const causes = data.causes_non_conformite;
    if (causes) {
      rect(ML, y, PW, 7, ORANGE_BG);
      doc.save().fillColor(ORANGE).font('Helvetica-Bold').fontSize(7)
        .text('Causes de non-conformité et actions à entreprendre :', ML + 2, y + 1.5, { lineBreak: false }).restore();
      y += 8;
      rect(ML, y, PW, 18, ORANGE_BG);
      y = wrapText(y + 1, causes, ML + 2, PW - 4, 'Helvetica', 7);
      y += 2;
    }

    const remarques = data.remarques;
    if (remarques) {
      doc.save().fillColor(DARK_MID).font('Helvetica-Bold').fontSize(7)
        .text('Autres remarques :', ML, y + 1, { lineBreak: false }).restore();
      y += 7;
      y = wrapText(y, remarques, ML + 2, PW - 4, 'Helvetica', 7);
      y += 2;
    }

    // ══════════════════════════════════════════════════
    // VOLET 5 — SIGNATURES
    // ══════════════════════════════════════════════════
    y = newPageIfNeeded(y, 65);
    y = sectionBar(y, 'VOLET 5 — PROCHAINES INTERVENTIONS ET SIGNATURES');

    // Réception positive/négative
    const recepPos = confOk ? 'Oui' : 'Non';
    const recepNeg = confOk ? 'Non' : 'Oui';
    const hw = PW / 2 - 2;
    rect(ML, y, hw, 7, confOk ? GREEN_BG : GRAY);
    rect(ML + hw + 4, y, hw, 7, !confOk ? RED_BG : GRAY);
    doc.save().fillColor(confOk ? GREEN : DARK_MID).font('Helvetica-Bold').fontSize(8)
      .text(`Réception positive : ${recepPos}`, ML + 2, y + 2, { width: hw - 4, lineBreak: false }).restore();
    doc.save().fillColor(!confOk ? RED : DARK_MID).font('Helvetica-Bold').fontSize(8)
      .text(`Réception négative : ${recepNeg}`, ML + hw + 6, y + 2, { width: hw - 4, lineBreak: false }).restore();
    y += 10;

    // Prochaines interventions
    const interventions = [
      ['Mise en conformité au plus tard le :', data.mise_conformite_date],
      ['Prochain contrôle périodique entre :', `${data.prochain_controle_debut || ''} → ${data.prochain_controle_fin || ''}`],
      ['Prochain entretien constructeur :', data.prochain_entretien],
      ['Analyse de combustion (DA) au plus tard le :', data.prochaine_da],
    ].filter(([, v]) => v && v.trim() && v.trim() !== '→ ');

    interventions.forEach(([lbl, val], i) => {
      y = kv2row(y, [[lbl, val, ML, 72]], i % 2 === 0 ? GRAY : null);
    });
    y += 4;

    hline(y, ML, W - MR_MARGIN, GRAY_LINE, 0.5);
    y += 6;

    // Signatures
    const sigW = hw;
    [[data.tech_nom, data.tech_agrement, 'Rapport réalisé par :'],
     [data.client_nom, `En qualité de : ${data.client_qualite || ''}`, 'Rapport reçu par :']
    ].forEach(([name, qual, title], xi) => {
      const x0 = ML + xi * (sigW + 10);
      rect(x0, y, sigW, 6, BLUE_LIGHT);
      doc.save().fillColor(BLUE).font('Helvetica-Bold').fontSize(7)
        .text(title, x0 + 2, y + 1.3, { width: sigW - 4, lineBreak: false }).restore();
      doc.save().fillColor(DARK).font('Helvetica-Bold').fontSize(7.5)
        .text(name || '—', x0 + 2, y + 8, { width: sigW - 4, lineBreak: false }).restore();
      doc.save().fillColor(DARK_MID).font('Helvetica').fontSize(6.5)
        .text(qual || '', x0 + 2, y + 14.5, { width: sigW - 4, lineBreak: false }).restore();
    });
    y += 18;

    // Cadres signature
    [[ML, 'Signature'], [ML + sigW + 10, 'Signature']].forEach(([x0, lbl]) => {
      doc.save().strokeColor(GRAY_LINE).lineWidth(0.5)
        .rect(x0, y, sigW, 22).stroke().restore();
      doc.save().fillColor('#cccccc').font('Helvetica').fontSize(7)
        .text(lbl, x0 + 2, y + 17, { width: sigW - 4, lineBreak: false }).restore();
    });
    y += 27;

    // Mention urgence
    y = newPageIfNeeded(y, 18);
    rect(ML, y, PW, 10, RED_BG);
    doc.save().fillColor(RED).font('Helvetica-Bold').fontSize(6.5)
      .text('ATTENTION — En cas de danger : Secours ORES 0800 87 087  |  SOS gaz EANDIS/FLUXYS 0800 65 065  |  Urgences 100/112', ML + 2, y + 2, { width: PW - 4, lineBreak: false }).restore();
    doc.save().fillColor('#721c24').font('Helvetica').fontSize(6)
      .text("En cas de non-conformité, l'utilisateur et le propriétaire sont avertis. Un écrit signé leur est remis, chacun en recevant une copie.", ML + 2, y + 6.5, { width: PW - 4, lineBreak: false }).restore();
    y += 12;

    // ── FOOTER sur toutes les pages ──
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      const fY = doc.page.height - 11;
      rect(0, fY, W, 11, DARK);
      doc.save().fillColor(WHITE).font('Helvetica-Bold').fontSize(7)
        .text('Thermeo', ML + 2, fY + 3, { lineBreak: false }).restore();
      doc.save().fillColor('#aaaaaa').font('Helvetica').fontSize(6.5)
        .text(`${data.tech_tel || ''}  •  ${data.tech_email || ''}`, ML + 22, fY + 3, { lineBreak: false }).restore();
      doc.save().fillColor('#aaaaaa').font('Helvetica').fontSize(6.5)
        .text(`AGW 29/01/2009 — Région wallonne  |  N° ${data.n_rapport || ''}  |  ${data.date || ''}`, 0, fY + 3, { width: W - MR_MARGIN - 2, align: 'right', lineBreak: false }).restore();
    }

    doc.end();
  });
}

module.exports = { generateAttestation };
