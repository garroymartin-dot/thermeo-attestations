const PDFDocument = require('pdfkit');

// ── Palette Thermeo officielle ──
const C = {
  blue:       '#2234F0',
  blueMid:    '#505FF3',
  blueLight:  '#EEF1FF',
  dark:       '#2E323A',
  darkMid:    '#5D5653',
  gray:       '#E7E8EC',
  grayLight:  '#F7F8FA',
  white:      '#FFFFFF',
  green:      '#1A9E4A',
  greenBg:    '#E8F7EE',
  red:        '#EF2A24',
  redBg:      '#FDEAEA',
  orange:     '#F88539',
  orangeBg:   '#FFF3E6',
  line:       '#DDE1E9',
};

const M     = 28;
const PGAP  = 10;
const RH_MD = 16;

function generateAttestation(data) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;
    const H = doc.page.height;
    const PW = W - M * 2;

    const isPellet = (data.combustible || '').startsWith('Pellet');
    const typeAtt  = data.type_attestation || 'periodique';
    const labelAtt = typeAtt === 'periodique' ? 'CONTR\u00d4LE P\u00c9RIODIQUE' : 'R\u00c9CEPTION';
    const conf     = data.declaration_conformite;
    const confOk   = conf === 'Oui';
    const pnom     = parseFloat(data.gen_puissance || '0') || 0;

    let y = 0;

    function box(x, yy, w, h, fillColor, strokeColor, radius) {
      doc.save();
      if (radius) {
        if (fillColor)   { doc.fillColor(fillColor).roundedRect(x, yy, w, h, radius).fill(); }
        if (strokeColor) { doc.strokeColor(strokeColor).lineWidth(0.6).roundedRect(x, yy, w, h, radius).stroke(); }
      } else {
        if (fillColor && strokeColor) { doc.fillColor(fillColor).strokeColor(strokeColor).lineWidth(0.5).rect(x, yy, w, h).fillAndStroke(); }
        else if (fillColor)   { doc.fillColor(fillColor).rect(x, yy, w, h).fill(); }
        else if (strokeColor) { doc.strokeColor(strokeColor).lineWidth(0.5).rect(x, yy, w, h).stroke(); }
      }
      doc.restore();
    }

    function hline(yy, x1, x2, color, lw) {
      doc.save().strokeColor(color || C.line).lineWidth(lw || 0.4)
        .moveTo(x1 != null ? x1 : M, yy).lineTo(x2 != null ? x2 : W - M, yy).stroke().restore();
    }

    function txt(text, x, yy, opts) {
      opts = opts || {};
      doc.save().fillColor(opts.color || C.dark).font(opts.font || 'Helvetica').fontSize(opts.size || 9)
        .text(String(text != null ? text : '\u2014'), x, yy, { width: opts.width, align: opts.align || 'left', lineBreak: opts.wrap || false })
        .restore();
    }

    function sectionHeader(yy, title, bg) {
      const h = 24;
      box(M, yy, PW, h, bg || C.dark);
      box(M, yy, 4, h, C.blue);
      txt(title, M + 12, yy + 8, { font: 'Helvetica-Bold', size: 8, color: C.white });
      return yy + h + 8;
    }

    function subHeader(yy, title, x, w) {
      x = x != null ? x : M; w = w || PW;
      const h = 20;
      box(x, yy, w, h, C.blueLight);
      txt(title, x + 8, yy + 6, { font: 'Helvetica-Bold', size: 8, color: C.blue, width: w - 16 });
      return yy + h + 4;
    }

    function statusBadge(yy, label, value, bg) {
      const h = 18;
      const vx = M + PW * 0.66;
      const bw = PW * 0.32;
      if (bg) box(M, yy, PW, h, bg);
      txt(label, M + 8, yy + 5, { size: 8.5, color: C.dark, width: PW * 0.62 });
      const v = (value || '').toUpperCase();
      let bbg = C.gray, bfg = C.darkMid;
      if (['OUI','OK','CONFORME','PRESENT','PRÉSENT','AUTOMATIQUE','CORRECT','FONCTIONNEL'].includes(v)) { bbg = C.greenBg; bfg = C.green; }
      else if (['NON','NOK','NON CONFORME','ANOMALIE'].includes(v)) { bbg = C.redBg; bfg = C.red; }
      else if (['PAS APPLICABLE','N/A'].includes(v)) { bbg = C.gray; bfg = C.darkMid; }
      else if (v) { bbg = C.blueLight; bfg = C.blue; }
      box(vx, yy + 2, bw, h - 4, bbg, null, 3);
      txt(value || '\u2014', vx, yy + 5, { font: 'Helvetica-Bold', size: 8, color: bfg, width: bw, align: 'center' });
      hline(yy + h, M, W - M, C.line, 0.3);
      return yy + h;
    }

    function needsPage(yy, needed) {
      if (yy + (needed || 60) > H - 30) { doc.addPage(); return M + 10; }
      return yy;
    }

    // ═══════════════════════════════
    // HEADER
    // ═══════════════════════════════
    const HDR_H = 58;
    box(0, 0, W, HDR_H, C.dark);
    box(0, 0, 5, HDR_H, C.blue);
    txt('ATTESTATION DE ' + labelAtt, M + 8, 12, { font: 'Helvetica-Bold', size: 14, color: C.white });
    txt('Générateur de chaleur  \u2014  AGW du 29/01/2009  \u2014  Région Wallonne', M + 8, 32, { size: 8, color: 'rgba(255,255,255,0.65)' });
    const nbW = 135, nbY = 8;
    box(W - M - nbW, nbY, nbW, 42, C.blue, null, 4);
    txt('N° attestation', W - M - nbW + 8, nbY + 5, { size: 7, color: 'rgba(255,255,255,0.7)' });
    txt(data.n_rapport || '\u2014', W - M - nbW + 8, nbY + 14, { font: 'Helvetica-Bold', size: 11, color: C.white, width: nbW - 16 });
    txt('Date : ' + (data.date || ''), W - M - nbW + 8, nbY + 30, { size: 7.5, color: 'rgba(255,255,255,0.7)' });
    y = HDR_H + 16;

    // ═══════════════════════════════
    // VOLET 1 — IDENTIFICATION
    // ═══════════════════════════════
    y = sectionHeader(y, 'VOLET 1  \u2014  IDENTIFICATION ADMINISTRATIVE ET TECHNIQUE');

    box(M, y, PW, 22, C.orangeBg, C.orange, 3);
    txt('Nature du contrôle : ' + (data.nature_controle || '\u2014'), M + 10, y + 7, { font: 'Helvetica-Bold', size: 9, color: C.orange });
    txt('Ramonage : ' + (data.ramonage || '\u2014'), M + PW * 0.55, y + 7, { font: 'Helvetica-Bold', size: 9, color: C.orange });
    y += 30;

    const cw2 = PW / 2 - 6;
    let yl = subHeader(y, 'TECHNICIEN AGRÉÉ', M, cw2);
    let yr = subHeader(y, 'DEMANDEUR / CLIENT', M + cw2 + 12, cw2);

    [['Nom :', data.tech_nom],['Agrément :', data.tech_agrement],['Entreprise :', data.tech_entreprise],['Tél :', data.tech_tel],['E-mail :', data.tech_email],['N° TVA :', data.tech_nentreprise]].forEach(function(row, i) {
      const h = RH_MD;
      if (i % 2 === 0) box(M, yl, cw2, h, C.grayLight);
      txt(row[0], M + 6, yl + 4, { size: 7.5, color: C.darkMid, width: 30 });
      txt(row[1] || '\u2014', M + 38, yl + 4, { font: 'Helvetica-Bold', size: 8, color: C.dark, width: cw2 - 44 });
      hline(yl + h, M, M + cw2, C.line, 0.3);
      yl += h;
    });

    [['Nom / Prénom :', data.client_nom],['Qualité :', data.client_qualite],['Adresse :', data.client_adresse],['Localité :', data.client_localite],['Tél :', data.client_tel],['E-mail :', data.client_email]].forEach(function(row, i) {
      const h = RH_MD;
      const rx = M + cw2 + 12;
      if (i % 2 === 0) box(rx, yr, cw2, h, C.grayLight);
      txt(row[0], rx + 6, yr + 4, { size: 7.5, color: C.darkMid, width: 32 });
      txt(row[1] || '\u2014', rx + 42, yr + 4, { font: 'Helvetica-Bold', size: 8, color: C.dark, width: cw2 - 48 });
      hline(yr + h, rx, rx + cw2, C.line, 0.3);
      yr += h;
    });

    y = Math.max(yl, yr) + 10;

    // Localisation
    box(M, y, PW, RH_MD, C.grayLight);
    txt("Localisation du générateur si différente :", M + 6, y + 4, { size: 7.5, color: C.darkMid, width: 200 });
    txt(data.localisation_gen || 'IDEM', M + 210, y + 4, { font: 'Helvetica-Bold', size: 8, color: C.dark, width: PW - 220 });
    y += RH_MD + 14;

    // Générateur
    y = subHeader(y, 'GÉNÉRATEUR DE CHALEUR');
    var genRows = [
      [['Combustible :', data.combustible, 36], ['Raccordement :', data.raccordement, 40]],
      [['Condensation :', data.condensation, 40], ['Type brûleur :', data.type_bruleur, 36]],
      [['Marque :', data.gen_marque, 24], ['Type / Modèle :', data.gen_type, 40]],
      [['Puissance (kW) :', data.gen_puissance, 48], ['Année :', data.gen_annee, 24]],
      [['N° de série :', data.gen_serie, 30], ['Nb générateurs :', data.nb_gen, 44]],
      [['Fluide caloporteur :', data.fluide, 52], ['Production :', data.production, 36]],
      [['Permis urbanisme :', data.permis_urbanisme, 52], ['Plaque signalétique :', data.plaque_signaletique, 52]],
    ];
    if (isPellet) genRows.push([['Norme :', data.pellet_norme, 24], ['Alimentation :', data.pellet_alimentation, 36]]);

    genRows.forEach(function(row, i) {
      const h = RH_MD;
      if (i % 2 === 0) box(M, y, PW, h, C.grayLight);
      var hw2 = PW / 2 - 4;
      txt(row[0][0], M + 6, y + 4, { size: 7.5, color: C.darkMid, width: row[0][2] });
      txt(row[0][1] || '\u2014', M + row[0][2] + 8, y + 4, { font: 'Helvetica-Bold', size: 8, color: C.dark, width: hw2 - row[0][2] - 10 });
      if (row[1]) {
        var rx = M + hw2 + 8;
        txt(row[1][0], rx, y + 4, { size: 7.5, color: C.darkMid, width: row[1][2] });
        txt(row[1][1] || '\u2014', rx + row[1][2] + 4, y + 4, { font: 'Helvetica-Bold', size: 8, color: C.dark, width: hw2 - row[1][2] - 8 });
      }
      hline(y + h, M, W - M, C.line, 0.3);
      y += h;
    });
    y += 14;

    // ═══════════════════════════════
    // VOLET 1B — INSTALLATION
    // ═══════════════════════════════
    y = needsPage(y, 100);
    y = sectionHeader(y, "VOLET 1B  \u2014  VÉRIFICATIONS RELATIVES À L'INSTALLATION");

    box(M, y, PW * 0.64, 20, C.blueLight);
    box(M + PW * 0.65, y, PW * 0.35, 20, C.blueLight);
    txt('Vérification', M + 8, y + 6, { font: 'Helvetica-Bold', size: 8.5, color: C.blue });
    txt('Résultat', M + PW * 0.66, y + 6, { font: 'Helvetica-Bold', size: 8.5, color: C.blue });
    y += 22;

    var checks1b = [
      ['1. Raccordement brûleur-chaudière (si applicable)', data.v2_raccordement],
      ['2. Adéquation chaudière-brûleur (si applicable)', data.v2_adequation],
      ['3. Orifice de mesure', data.v2_orifice],
      ['4. Pression de cheminée (type B tirage naturel)', data.v2_pression_cheminee],
      ['Conformité ventilation du local de chauffe', data.v2_ventilation],
      ["Conformité amenée d'air comburant", data.v2_air_comburant],
      ['Conformité évacuation des gaz de combustion', data.v2_evacuation],
      ["Instructions d'utilisation et d'entretien", data.v2_instructions],
      ['Note de calcul du dimensionnement', data.v2_dimensionnement],
    ];
    if (isPellet) {
      checks1b.push(['Bac à cendres / évacuation conforme', data.v2_cendres]);
      checks1b.push(['Silo / stockage pellets conforme', data.v2_silo]);
    }
    checks1b.forEach(function(row, i) { y = statusBadge(y, row[0], row[1], i % 2 === 0 ? C.grayLight : null); });

    var v1bOk = data.v2_global === 'Oui';
    y += 6;
    box(M, y, PW, 26, v1bOk ? C.greenBg : C.redBg, v1bOk ? C.green : C.red, 4);
    txt((v1bOk ? '\u2713  Conformité globale installation : OUI' : '\u2717  Conformité globale installation : NON'), M + 12, y + 8, { font: 'Helvetica-Bold', size: 10, color: v1bOk ? C.green : C.red });
    y += 34;

    // ═══════════════════════════════
    // VOLET 2 — RÉGULATION & POMPES
    // ═══════════════════════════════
    y = needsPage(y, 90);
    y = sectionHeader(y, 'VOLET 2  \u2014  INSPECTION SYSTÈME DE RÉGULATION ET POMPE(S) DE CIRCULATION');

    var checksReg = [
      ['Régulation en mode automatique ?', data.reg_automatique],
      ["Thermostat d'ambiance fonctionnel ?", data.reg_thermostat],
      ['Horloge (si présente) correctement réglée ?', data.reg_horloge],
      ['Programmation nuit / mode réduit activée ?', data.reg_programmation_nuit],
      ['Mode de fonctionnement pompe(s)', data.pompe_mode],
      ['Dysfonctionnement pompe détecté (bruit, vibration, fuite...)', data.pompe_dysfonctionnement],
      ['Pompe ECS \u2014 fonctionnement', data.pompe_ecs],
    ];
    checksReg.forEach(function(row, i) { y = statusBadge(y, row[0], row[1], i % 2 === 0 ? C.grayLight : null); });

    if (data.pompe_remarques) {
      y += 6;
      box(M, y, PW, 22, C.orangeBg, null, 3);
      txt('Remarques pompes :', M + 8, y + 4, { font: 'Helvetica-Bold', size: 8, color: C.orange });
      txt(data.pompe_remarques, M + 110, y + 4, { size: 8, color: C.dark, width: PW - 120 });
      y += 30;
    }

    if (pnom > 20) {
      y += 8;
      y = subHeader(y, 'DIAGNOSTIC APPROFONDI (Pnom = ' + pnom + ' kW > 20 kW \u2014 obligatoire)');
      [['A. Rapport de diagnostic approfondi présent ?', data.diag_rapport_present],['B. Modification du système depuis dernier diagnostic ?', data.diag_modification],['C. Modification réalisée après le 30/04/2015 ?', data.diag_modification_2015],['D. Au moins 2 ans depuis la modification ?', data.diag_2ans],["E. Le diagnostic a-t-il déjà été reporté ?", data.diag_reporte]].forEach(function(row, i) { y = statusBadge(y, row[0], row[1], i % 2 === 0 ? C.grayLight : null); });
    }
    y += 14;

    // ═══════════════════════════════
    // VOLET 3 — COMBUSTION
    // ═══════════════════════════════
    y = needsPage(y, 110);
    y = sectionHeader(y, 'VOLET 3  \u2014  CONTRÔLE DE COMBUSTION');

    var pm      = data.perf_min || {};
    var valeurs = data.valeurs_combustion || {};
    var colDefs = isPellet
      ? [['co_ppm', 'CO MAX\nà 13% O\u2082\n(ppm)'], ['rendement', 'Rendement\nMIN (%)']]
      : [['t_nette', 'T° nette\nfumées\nMAX (°C)'], ['co2', 'CO\u2082\nMIN (%)'], ['o2', 'O\u2082\nMAX (%)'], ['co', 'CO MAX\n(mg/kWh)'], ['rendement', 'Rendement\nMIN (%)']];

    var lblW2  = 130;
    var dataW2 = (PW - lblW2) / colDefs.length;
    var thH    = 38;

    // Header tableau
    box(M, y, lblW2, thH, C.blueLight);
    txt('Mesure', M + 8, y + thH / 2 - 5, { font: 'Helvetica-Bold', size: 8.5, color: C.blue });
    colDefs.forEach(function(col, j) {
      var xc  = M + lblW2 + j * dataW2;
      var bg2 = j % 2 === 0 ? C.blueLight : '#E4E8FF';
      box(xc, y, dataW2, thH, bg2);
      var lines = col[1].split('\n');
      var lh2   = 9;
      var startY2 = y + (thH - lines.length * lh2) / 2;
      lines.forEach(function(line, li) {
        txt(line, xc, startY2 + li * lh2, { font: 'Helvetica-Bold', size: 7.5, color: C.blue, width: dataW2, align: 'center' });
      });
    });
    y += thH;

    // Perf min
    var combRH2 = 22;
    box(M, y, PW, combRH2, C.grayLight);
    txt('Perf. min réglementaires', M + 8, y + 7, { font: 'Helvetica-Bold', size: 8.5, color: C.darkMid });
    colDefs.forEach(function(col, j) { txt(pm[col[0]] || '\u2014', M + lblW2 + j * dataW2, y + 7, { size: 9, color: C.darkMid, width: dataW2, align: 'center' }); });
    hline(y + combRH2, M, W - M, C.line, 0.3); y += combRH2;

    // Valeurs mesurées
    box(M, y, PW, combRH2, C.white);
    txt('Valeurs mesurées', M + 8, y + 7, { font: 'Helvetica-Bold', size: 8.5, color: C.dark });
    colDefs.forEach(function(col, j) { txt(valeurs[col[0]] || '\u2014', M + lblW2 + j * dataW2, y + 7, { font: 'Helvetica-Bold', size: 11, color: C.blue, width: dataW2, align: 'center' }); });
    hline(y + combRH2, M, W - M, C.line, 0.3); y += combRH2;

    // Comparaison
    box(M, y, PW, combRH2 + 4, C.blueLight);
    txt('Comparaison', M + 8, y + 8, { font: 'Helvetica-Bold', size: 8.5, color: C.blue });
    colDefs.forEach(function(col, j) {
      var xc2 = M + lblW2 + j * dataW2;
      var v2  = (data['cmp_' + col[0]] || '').toUpperCase();
      var fg2 = v2 === 'OK' ? C.green : v2 === 'NOK' ? C.red : C.darkMid;
      var bg3 = v2 === 'OK' ? C.greenBg : v2 === 'NOK' ? C.redBg : C.gray;
      box(xc2 + 6, y + 4, dataW2 - 12, combRH2 - 4, bg3, null, 3);
      txt(v2 || '\u2014', xc2 + 6, y + 9, { font: 'Helvetica-Bold', size: 9, color: fg2, width: dataW2 - 12, align: 'center' });
    });
    y += combRH2 + 10;

    // Temp eau + résultat
    txt('Température eau lors de la mesure : ' + (data.temp_eau || '\u2014') + ' °C', W - M - 200, y, { size: 8.5, color: C.darkMid, align: 'right', width: 200 });
    y += 14;

    var resOk2  = data.resultat_combustion === 'OK';
    var resNok2 = data.resultat_combustion === 'NOK';
    box(M, y, PW, 30, resOk2 ? C.greenBg : resNok2 ? C.redBg : C.gray, resOk2 ? C.green : resNok2 ? C.red : C.line, 4);
    txt((resOk2 ? '\u2713' : resNok2 ? '\u2717' : '') + '  RÉSULTAT GLOBAL COMBUSTION : ' + (data.resultat_combustion || '\u2014'), M + 12, y + 9, { font: 'Helvetica-Bold', size: 12, color: resOk2 ? C.green : resNok2 ? C.red : C.darkMid });
    y += 38;

    // ═══════════════════════════════
    // VOLET 4 — CONFORMITÉ
    // ═══════════════════════════════
    y = needsPage(y, 80);
    y = sectionHeader(y, 'VOLET 4  \u2014  DÉCLARATION DE CONFORMITÉ  \u2014  AGW 29/01/2009');

    box(M, y, PW, 48, confOk ? C.greenBg : C.redBg, confOk ? C.green : C.red, 4);
    txt("L'ensemble installation — ventilation — amenée d'air — évacuation gaz est-il conforme à l'AGW ?", M + 12, y + 8, { size: 8.5, color: confOk ? C.green : C.red, width: PW - 24 });
    txt((confOk ? '\u2713' : '\u2717') + '  ' + (conf || '\u2014').toUpperCase(), M + 12, y + 24, { font: 'Helvetica-Bold', size: 18, color: confOk ? C.green : C.red });
    y += 56;

    if (data.causes_non_conformite) {
      box(M, y, PW, 18, C.orangeBg, C.orange, 3);
      txt('\u26a0  Causes de non-conformité et actions à entreprendre :', M + 10, y + 5, { font: 'Helvetica-Bold', size: 8.5, color: C.orange });
      y += 22;
      var causeH2 = Math.max(32, doc.heightOfString(data.causes_non_conformite, { width: PW - 20 }) + 14);
      box(M, y, PW, causeH2, '#FFFAF5', C.orange, 3);
      doc.save().fillColor(C.dark).font('Helvetica').fontSize(8.5).text(data.causes_non_conformite, M + 10, y + 8, { width: PW - 20, lineBreak: true }).restore();
      y += causeH2 + 10;
    }

    if (data.remarques) {
      txt('Autres remarques :', M + 6, y, { font: 'Helvetica-Bold', size: 8.5, color: C.darkMid });
      y += 14;
      var remH2 = Math.max(28, doc.heightOfString(data.remarques, { width: PW - 20 }) + 14);
      box(M, y, PW, remH2, C.grayLight, C.line, 3);
      doc.save().fillColor(C.dark).font('Helvetica').fontSize(8.5).text(data.remarques, M + 10, y + 8, { width: PW - 20, lineBreak: true }).restore();
      y += remH2 + 10;
    }

    // ═══════════════════════════════
    // VOLET 5 — SIGNATURES
    // ═══════════════════════════════
    y = needsPage(y, 100);
    y = sectionHeader(y, 'VOLET 5  \u2014  PROCHAINES INTERVENTIONS ET SIGNATURES');

    var hw3 = PW / 2 - 4;
    box(M, y, hw3, 28, confOk ? C.greenBg : C.grayLight, confOk ? C.green : C.line, 3);
    box(M + hw3 + 8, y, hw3, 28, !confOk ? C.redBg : C.grayLight, !confOk ? C.red : C.line, 3);
    txt('Réception positive : ' + (confOk ? 'OUI' : 'NON'), M + 10, y + 9, { font: 'Helvetica-Bold', size: 10, color: confOk ? C.green : C.darkMid });
    txt('Réception négative : ' + (!confOk ? 'OUI' : 'NON'), M + hw3 + 18, y + 9, { font: 'Helvetica-Bold', size: 10, color: !confOk ? C.red : C.darkMid });
    y += 36;

    var interventions2 = [
      ['Mise en conformité au plus tard le :', data.mise_conformite_date],
      ['Prochain contrôle périodique entre :', [data.prochain_controle_debut, data.prochain_controle_fin].filter(Boolean).join(' \u2192 ')],
      ['Prochain entretien constructeur au plus tard le :', data.prochain_entretien],
      ['Analyse de combustion (DA) au plus tard le :', data.prochaine_da],
    ].filter(function(r) { return r[1] && r[1].trim() && r[1].trim() !== '\u2192'; });

    if (interventions2.length > 0) {
      y = subHeader(y, 'PROCHAINES INTERVENTIONS');
      interventions2.forEach(function(r, i) {
        var h = RH_MD;
        if (i % 2 === 0) box(M, y, PW, h, C.grayLight);
        txt(r[0], M + 6, y + 4, { size: 8, color: C.darkMid, width: 210 });
        txt(r[1] || '\u2014', M + 220, y + 4, { font: 'Helvetica-Bold', size: 9, color: C.blue, width: PW - 226 });
        hline(y + h, M, W - M, C.line, 0.3);
        y += h;
      });
      y += 12;
    }

    hline(y, M, W - M, C.line, 0.8);
    y += 16;

    [[data.tech_nom, data.tech_agrement, 'Rapport réalisé par :'], [data.client_nom, 'En qualité de : ' + (data.client_qualite || ''), 'Rapport reçu par :']].forEach(function(row, xi) {
      var x0 = M + xi * (hw3 + 8);
      box(x0, y, hw3, 22, C.blueLight, null, 3);
      txt(row[2], x0 + 8, y + 7, { font: 'Helvetica-Bold', size: 8.5, color: C.blue });
      txt(row[0] || '\u2014', x0 + 8, y + 30, { font: 'Helvetica-Bold', size: 9.5, color: C.dark, width: hw3 - 16 });
      txt(row[1] || '', x0 + 8, y + 43, { size: 8, color: C.darkMid, width: hw3 - 16 });
    });
    y += 50;

    [M, M + hw3 + 8].forEach(function(x0) {
      box(x0, y, hw3, 40, C.white, C.line, 3);
      txt('Signature', x0 + 8, y + 32, { size: 8, color: '#cccccc' });
    });
    y += 48;

    y = needsPage(y, 28);
    box(M, y, PW, 26, C.redBg, C.red, 3);
    txt('\u26a0  ATTENTION \u2014 En cas de danger : Secours ORES 0800 87 087  |  SOS gaz EANDIS/FLUXYS 0800 65 065  |  Urgences 100/112', M + 10, y + 6, { font: 'Helvetica-Bold', size: 7.5, color: C.red, width: PW - 20 });
    txt("En cas de non-conformité, l'utilisateur et le propriétaire sont avertis. Un écrit signé leur est remis, chacun en recevant une copie.", M + 10, y + 16, { size: 7, color: '#9B1C1C', width: PW - 20 });

    // ═══════════════════════════════
    // FOOTER toutes pages
    // ═══════════════════════════════
    var pageCount2 = doc.bufferedPageRange().count;
    for (var pi = 0; pi < pageCount2; pi++) {
      doc.switchToPage(pi);
      var fY2 = H - 24;
      box(0, fY2, W, 24, C.dark);
      box(0, fY2, 5, 24, C.blue);
      txt('Thermeo', M + 6, fY2 + 8, { font: 'Helvetica-Bold', size: 8.5, color: C.white });
      txt((data.tech_tel || '') + '  \u2022  ' + (data.tech_email || ''), M + 58, fY2 + 8, { size: 7.5, color: 'rgba(255,255,255,0.55)' });
      txt('AGW 29/01/2009 \u2014 Région wallonne  |  N° ' + (data.n_rapport || '') + '  |  ' + (data.date || '') + '  |  Page ' + (pi + 1) + '/' + pageCount2, 0, fY2 + 8, { size: 7, color: 'rgba(255,255,255,0.5)', width: W - M - 4, align: 'right' });
    }

    doc.end();
  });
}

module.exports = { generateAttestation };
