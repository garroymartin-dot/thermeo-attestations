const PDFDocument = require('pdfkit');

// Palette Thermeo officielle — doit rester synchronisée avec :root dans public/index.html
const C = {
  blue:      '#2234F0',
  blueMid:   '#505FF3',
  bluePale:  '#F4FAFF',
  blueBorder:'#C8D4FD',
  gray:      '#E7E8EC',
  grayLight: '#F7F8FA',
  white:     '#FEFEFE',
  text:      '#2E323A',
  textMid:   '#5D5653',
  green:     '#1DB954',
  greenBg:   '#E6F9ED',
  greenBord: '#A3D9B8',
  red:       '#EF2A24',
  redBg:     '#FDE8E8',
  redBord:   '#F5AAAA',
  orange:    '#F88539',
  orangeBg:  '#FFF3E6',
  orangeBord:'#F8C89A',
  line:      '#E7E8EC',
};

const ML   = 30;   // marge gauche
const MR   = 30;   // marge droite
const FOOT = 28;   // hauteur footer

function generateAttestation(data) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W  = doc.page.width;
    const H  = doc.page.height;
    const PW = W - ML - MR;
    const SAFE_BOTTOM = H - FOOT - 16; // zone de contenu sécurisée

    const isPellet = (data.combustible || '').startsWith('Pellet');
    const typeAtt  = data.type_attestation || 'periodique';
    const labelAtt = typeAtt === 'periodique' ? 'CONTR\u00d4LE P\u00c9RIODIQUE' : 'R\u00c9CEPTION';
    const conf     = data.declaration_conformite;
    const confOk   = conf === 'Oui';
    const pnom     = parseFloat(data.gen_puissance || '0') || 0;

    let y = 0;

    // ───────────────────────────────────────
    // PRIMITIVES
    // ───────────────────────────────────────
    function fillRect(x, yy, w, h, color) {
      if (!color) return;
      doc.save().fillColor(color).rect(x, yy, w, h).fill().restore();
    }
    function strokeRect(x, yy, w, h, color, lw, r) {
      doc.save().strokeColor(color || C.line).lineWidth(lw || 0.5);
      if (r) doc.roundedRect(x, yy, w, h, r).stroke();
      else   doc.rect(x, yy, w, h).stroke();
      doc.restore();
    }
    function fillRRect(x, yy, w, h, fill, border, r) {
      r = r || 3;
      doc.save();
      if (fill)   doc.fillColor(fill).roundedRect(x, yy, w, h, r).fill();
      if (border) doc.strokeColor(border).lineWidth(0.6).roundedRect(x, yy, w, h, r).stroke();
      doc.restore();
    }
    function hl(yy, x1, x2, color, lw) {
      doc.save().strokeColor(color || C.line).lineWidth(lw || 0.4)
        .moveTo(x1 != null ? x1 : ML, yy)
        .lineTo(x2 != null ? x2 : W - MR, yy).stroke().restore();
    }
    function t(text, x, yy, o) {
      o = o || {};
      const opts = { align: o.align || 'left' };
      if (o.width != null) {
        opts.width = o.width;
        if (o.wrap) {
          opts.lineBreak = true;
        } else {
          // PDFKit wraps to a new line as soon as `width` is set, whatever
          // `lineBreak` is told \u2014 there is no "single line, allow overflow"
          // mode. Force one line with an ellipsis instead, so a value that's
          // too long is trimmed instead of wrapping mid-word into the row below.
          opts.height = (o.size || 9) + 3;
          opts.ellipsis = true;
        }
      }
      doc.save()
        .fillColor(o.color || C.text)
        .font(o.bold ? 'Helvetica-Bold' : (o.font || 'Helvetica'))
        .fontSize(o.size || 9)
        .text(String(text != null ? text : '\u2014'), x, yy, opts)
        .restore();
    }
    function labelWidth(text, size, bold) {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size || 8);
      return doc.widthOfString(String(text));
    }
    // Coche / croix dessinées en vectoriel : les polices standard de PDFKit
    // (Helvetica, encodage WinAnsi) n'ont pas les glyphes \u2713/\u2717 et les
    // affichaient comme des caractères aléatoires (\', &...) dans le PDF.
    function checkIcon(x, yy, ok, size, color) {
      const s = size || 10;
      doc.save().lineWidth(Math.max(1.2, s * 0.13)).strokeColor(color).lineCap('round').lineJoin('round');
      if (ok) {
        doc.moveTo(x, yy + s * 0.55).lineTo(x + s * 0.38, yy + s * 0.9).lineTo(x + s, yy + s * 0.15).stroke();
      } else {
        doc.moveTo(x + s * 0.1, yy + s * 0.1).lineTo(x + s * 0.9, yy + s * 0.9)
           .moveTo(x + s * 0.9, yy + s * 0.1).lineTo(x + s * 0.1, yy + s * 0.9).stroke();
      }
      doc.restore();
      return x + s + 6;
    }

    // ───────────────────────────────────────
    // COMPOSANTS
    // ───────────────────────────────────────
    function secHeader(yy, title) {
      const h = 26;
      fillRect(ML, yy, PW, h, C.blue);
      fillRect(ML, yy, 5, h, C.blueMid);
      t(title, ML + 14, yy + 8, { bold: true, size: 8.5, color: C.white });
      return yy + h + 8;
    }

    function subHeader(yy, title, x, w) {
      x = x != null ? x : ML; w = w || PW;
      const h = 20;
      fillRRect(x, yy, w, h, C.bluePale, C.blueBorder, 3);
      t(title, x + 10, yy + 6, { bold: true, size: 8, color: C.blue, width: w - 20 });
      return yy + h + 4;
    }

    // Ligne label : valeur (pleine largeur, jamais coupée)
    // Largeur de colonne fixe pour aligner toutes les valeurs d'une même
    // liste (assez large pour le plus long des libellés utilisés ici).
    const KV_LABEL_W = 180;
    function kvRow(yy, label, value, bg) {
      const h = 20;
      if (bg) fillRect(ML, yy, PW, h, bg);
      t(label, ML + 8, yy + 6, { size: 8, color: C.textMid, width: KV_LABEL_W });
      t(value || '\u2014', ML + 8 + KV_LABEL_W + 6, yy + 6, { bold: true, size: 8.5, color: C.text, width: PW - KV_LABEL_W - 30 });
      hl(yy + h, ML, W - MR, C.line, 0.3);
      return yy + h;
    }

    // Ligne label : valeur sur 2 colonnes. La largeur de la colonne label est
    // mesurée sur le texte réel (le 3e élément éventuel du tuple [label,
    // valeur, largeur] est ignoré — un budget en dur finissait toujours par
    // être trop étroit pour l'un ou l'autre des libellés).
    function kvRow2(yy, left, right, bg) {
      const h = 20;
      const hw = PW / 2;
      if (bg) fillRect(ML, yy, PW, h, bg);
      // col gauche
      const lw = labelWidth(left[0], 8) + 4;
      t(left[0], ML + 8, yy + 6, { size: 8, color: C.textMid, width: lw + 2 });
      t(left[1] || '\u2014', ML + 8 + lw + 8, yy + 6, { bold: true, size: 8.5, color: C.text, width: hw - lw - 20 });
      // col droite
      if (right) {
        const rx = ML + hw + 4;
        const rlw = labelWidth(right[0], 8) + 4;
        t(right[0], rx, yy + 6, { size: 8, color: C.textMid, width: rlw + 2 });
        t(right[1] || '\u2014', rx + rlw + 8, yy + 6, { bold: true, size: 8.5, color: C.text, width: hw - rlw - 20 });
      }
      hl(yy + h, ML, W - MR, C.line, 0.3);
      return yy + h;
    }

    function statusRow(yy, label, value, bg) {
      const h = 20;
      const vx = ML + PW * 0.63;
      const bw = PW * 0.35;
      if (bg) fillRect(ML, yy, PW, h, bg);
      t(label, ML + 8, yy + 6, { size: 8.5, color: C.text, width: PW * 0.59 });
      const v = (value || '').toUpperCase().trim();
      let bb = C.gray, bf = C.textMid;
      if (['OUI','OK','CONFORME','PRESENT','PR\u00c9SENT','AUTOMATIQUE','CORRECT','FONCTIONNEL'].includes(v)) { bb = C.greenBg; bf = C.green; }
      else if (['NON','NOK','NON CONFORME','ANOMALIE'].includes(v)) { bb = C.redBg; bf = C.red; }
      else if (['PAS APPLICABLE','N/A'].includes(v)) { bb = C.gray; bf = C.textMid; }
      else if (v) { bb = C.bluePale; bf = C.blue; }
      fillRRect(vx, yy + 2, bw, h - 4, bb, null, 3);
      t(value || '\u2014', vx, yy + 5, { bold: true, size: 8, color: bf, width: bw, align: 'center' });
      hl(yy + h, ML, W - MR, C.line, 0.3);
      return yy + h;
    }

    function checkPage(yy, needed) {
      if (yy + (needed || 60) > SAFE_BOTTOM) {
        doc.addPage();
        return ML;
      }
      return yy;
    }

    function drawFooters() {
      const n = doc.bufferedPageRange().count;
      for (let i = 0; i < n; i++) {
        doc.switchToPage(i);
        const fy = H - FOOT;
        fillRect(0, fy, W, FOOT, C.blue);
        fillRect(0, fy, 5, FOOT, C.blueMid);
        t('Thermeo', ML + 4, fy + 9, { bold: true, size: 8.5, color: C.white });
        t((data.tech_tel || '') + '  \u2022  ' + (data.tech_email || ''), ML + 62, fy + 9, { size: 7.5, color: 'rgba(255,255,255,0.7)' });
        t('AGW 29/01/2009 \u2014 Région wallonne  |  N° ' + (data.n_rapport || '') + '  |  ' + (data.date || '') + '  |  Page ' + (i + 1) + '/' + n,
          0, fy + 9, { size: 7, color: 'rgba(255,255,255,0.55)', width: W - MR - 4, align: 'right' });
      }
    }

    // ───────────────────────────────────────
    // HEADER
    // ───────────────────────────────────────
    const HDR = 60;
    fillRect(0, 0, W, HDR, '#FFFFFF');
    fillRect(0, 0, 5, HDR, C.blue);
    // Titre
    t('ATTESTATION DE ' + labelAtt, ML + 8, 13, { bold: true, size: 15, color: C.blue });
    t('G\u00e9n\u00e9rateur de chaleur  \u2014  AGW du 29/01/2009  \u2014  R\u00e9gion Wallonne', ML + 8, 34, { size: 8.5, color: 'rgba(255,255,255,0.6)' });
    // Badge N°
    const bx = W - MR - 138, by = 9;
    fillRRect(bx, by, 138, 42, C.blue, null, 4);
    t('N\u00b0 attestation', bx + 9, by + 6, { size: 7.5, color: 'rgba(255,255,255,0.75)' });
    t(data.n_rapport || '\u2014', bx + 9, by + 17, { bold: true, size: 12, color: C.white, width: 120 });
    t('Date : ' + (data.date || ''), bx + 9, by + 31, { size: 7.5, color: 'rgba(255,255,255,0.7)' });
    y = HDR + 16;

    // ───────────────────────────────────────
    // VOLET 1 — IDENTIFICATION
    // ───────────────────────────────────────
    y = secHeader(y, 'VOLET 1  \u2014  IDENTIFICATION ADMINISTRATIVE ET TECHNIQUE');

    // Bandeau nature contrôle
    fillRRect(ML, y, PW, 24, C.orangeBg, C.orangeBord, 3);
    t('Nature du contr\u00f4le : ' + (data.nature_controle || '\u2014'), ML + 10, y + 8, { bold: true, size: 9, color: C.orange });
    t('Ramonage : ' + (data.ramonage || '\u2014'), ML + PW * 0.54, y + 8, { bold: true, size: 9, color: C.orange });
    y += 32;

    // 2 colonnes technicien | client
    const cw = PW / 2 - 5;
    const rx2 = ML + cw + 10;
    let yl = subHeader(y, 'TECHNICIEN AGRÉÉ', ML, cw);
    let yr = subHeader(y, 'DEMANDEUR / CLIENT', rx2, cw);

    const techR = [['Nom :', data.tech_nom], ['Agr\u00e9ment :', data.tech_agrement], ['Entreprise :', data.tech_entreprise], ['T\u00e9l :', data.tech_tel], ['E-mail :', data.tech_email], ['N\u00b0 TVA :', data.tech_nentreprise]];
    const cliR  = [['Nom :', data.client_nom], ['Qualit\u00e9 :', data.client_qualite], ['Adresse :', data.client_adresse], ['Localit\u00e9 :', data.client_localite], ['T\u00e9l :', data.client_tel], ['E-mail :', data.client_email]];
    const rowH  = 18;
    // Largeur de label mesurée sur le texte réel (les libellés ci-dessus ne
    // sont pas tous de la même longueur : un budget fixe finissait par être
    // trop étroit et provoquait un retour à la ligne qui chevauchait la
    // ligne suivante).
    const techLW = Math.max.apply(null, techR.map(function(r) { return labelWidth(r[0], 8); }));
    const cliLW  = Math.max.apply(null, cliR.map(function(r) { return labelWidth(r[0], 8); }));

    techR.forEach(function(r, i) {
      if (i % 2 === 0) fillRect(ML, yl, cw, rowH, C.grayLight);
      t(r[0], ML + 8, yl + 5, { size: 8, color: C.textMid, width: techLW + 4 });
      t(r[1] || '\u2014', ML + techLW + 16, yl + 5, { bold: true, size: 8.5, color: C.text, width: cw - techLW - 24 });
      hl(yl + rowH, ML, ML + cw, C.line, 0.3);
      yl += rowH;
    });

    cliR.forEach(function(r, i) {
      if (i % 2 === 0) fillRect(rx2, yr, cw, rowH, C.grayLight);
      t(r[0], rx2 + 8, yr + 5, { size: 8, color: C.textMid, width: cliLW + 4 });
      t(r[1] || '\u2014', rx2 + cliLW + 16, yr + 5, { bold: true, size: 8.5, color: C.text, width: cw - cliLW - 24 });
      hl(yr + rowH, rx2, rx2 + cw, C.line, 0.3);
      yr += rowH;
    });

    y = Math.max(yl, yr) + 10;
    y = kvRow(y, 'Localisation du g\u00e9n\u00e9rateur si diff\u00e9rente :', data.localisation_gen || 'IDEM', C.grayLight);
    y += 12;

    // ── GÉNÉRATEUR (une ligne = un champ lisible) ──
    y = checkPage(y, 180);
    y = subHeader(y, 'G\u00c9N\u00c9RATEUR DE CHALEUR');
    y = kvRow2(y, ['Combustible :', data.combustible, 58], ['Raccordement :', data.raccordement, 62], C.grayLight);
    y = kvRow2(y, ['Condensation :', data.condensation, 62], ['Type br\u00fbleur :', data.type_bruleur, 58]);
    y = kvRow2(y, ['Marque :', data.gen_marque, 40], ['Type / Mod\u00e8le :', data.gen_type, 62], C.grayLight);
    y = kvRow2(y, ['Puissance nominale (kW) :', data.gen_puissance, 104], ['Ann\u00e9e de construction :', data.gen_annee, 98]);
    y = kvRow2(y, ['N\u00b0 de s\u00e9rie :', data.gen_serie, 52], ['Nb g\u00e9n\u00e9rateurs :', data.nb_gen, 68], C.grayLight);
    y = kvRow2(y, ['Fluide caloporteur :', data.fluide, 82], ['Production chaleur :', data.production, 80]);
    y = kvRow2(y, ['Permis d\'urbanisme :', data.permis_urbanisme, 82], ['Plaque signal\u00e9tique :', data.plaque_signaletique, 84], C.grayLight);
    if (isPellet) {
      y = kvRow2(y, ['Norme :', data.pellet_norme, 36], ['Alimentation :', data.pellet_alimentation, 56]);
      y = kvRow(y, 'Qualit\u00e9 pellets :', data.v2_qualite_pellet, C.grayLight);
    }
    y += 14;

    // ───────────────────────────────────────
    // VOLET 1B — INSTALLATION
    // ───────────────────────────────────────
    y = checkPage(y, 120);
    y = secHeader(y, "VOLET 1B  \u2014  V\u00c9RIFICATIONS RELATIVES \u00c0 L'INSTALLATION");

    // Entêtes tableau
    fillRRect(ML, y, PW * 0.61, 22, C.bluePale, C.blueBorder, 3);
    fillRRect(ML + PW * 0.63, y, PW * 0.37, 22, C.bluePale, C.blueBorder, 3);
    t('V\u00e9rification', ML + 10, y + 7, { bold: true, size: 9, color: C.blue });
    t('R\u00e9sultat', ML + PW * 0.64, y + 7, { bold: true, size: 9, color: C.blue });
    y += 26;

    var ch1b = [
      ['1. Raccordement br\u00fbleur-chaudi\u00e8re (si applicable)', data.v2_raccordement],
      ['2. Ad\u00e9quation chaudi\u00e8re-br\u00fbleur (si applicable)', data.v2_adequation],
      ['3. Orifice de mesure', data.v2_orifice],
      ['4. Pression de chemin\u00e9e (type B tirage naturel)', data.v2_pression_cheminee],
      ['Conformit\u00e9 ventilation du local de chauffe', data.v2_ventilation],
      ["Conformit\u00e9 amen\u00e9e d'air comburant", data.v2_air_comburant],
      ['Conformit\u00e9 \u00e9vacuation des gaz de combustion', data.v2_evacuation],
      ["Instructions d'utilisation et d'entretien", data.v2_instructions],
      ['Note de calcul du dimensionnement', data.v2_dimensionnement],
    ];
    if (isPellet) { ch1b.push(['Bac \u00e0 cendres / \u00e9vacuation conforme', data.v2_cendres]); ch1b.push(['Silo / stockage pellets conforme', data.v2_silo]); }
    ch1b.forEach(function(r, i) { y = statusRow(y, r[0], r[1], i % 2 === 0 ? C.grayLight : null); });

    y += 6;
    var v1bOk = data.v2_global === 'Oui';
    fillRRect(ML, y, PW, 28, v1bOk ? C.greenBg : C.redBg, v1bOk ? C.greenBord : C.redBord, 4);
    checkIcon(ML + 14, y + 8, v1bOk, 11, v1bOk ? C.green : C.red);
    t('Conformit\u00e9 globale installation (I, II, III & IV) : ' + (v1bOk ? 'OUI' : 'NON'), ML + 32, y + 9, { bold: true, size: 10, color: v1bOk ? C.green : C.red });
    y += 36;

    // ───────────────────────────────────────
    // VOLET 2 — RÉGULATION & POMPES
    // ───────────────────────────────────────
    y = checkPage(y, 100);
    y = secHeader(y, 'VOLET 2  \u2014  INSPECTION SYST\u00c8ME DE R\u00c9GULATION ET POMPE(S) DE CIRCULATION');

    var chReg = [
      ['R\u00e9gulation en mode automatique ?', data.reg_automatique],
      ["Thermostat d'ambiance fonctionnel ? (pas de code d'erreur)", data.reg_thermostat],
      ['Horloge (si pr\u00e9sente) correctement r\u00e9gl\u00e9e ?', data.reg_horloge],
      ['Programmation nuit / mode r\u00e9duit activ\u00e9e ?', data.reg_programmation_nuit],
      ['Mode de fonctionnement pompe(s)', data.pompe_mode],
      ['Dysfonctionnement pompe d\u00e9tect\u00e9 (bruit, vibration, fuite...)', data.pompe_dysfonctionnement],
      ['Pompe ECS \u2014 fonctionnement', data.pompe_ecs],
    ];
    chReg.forEach(function(r, i) { y = statusRow(y, r[0], r[1], i % 2 === 0 ? C.grayLight : null); });

    if (data.pompe_remarques) {
      y += 6;
      fillRRect(ML, y, PW, 28, C.orangeBg, C.orangeBord, 3);
      t('Remarques pompes :', ML + 10, y + 5, { bold: true, size: 8.5, color: C.orange });
      t(data.pompe_remarques, ML + 120, y + 5, { size: 8.5, color: C.text, width: PW - 130 });
      y += 36;
    }

    if (pnom > 20) {
      y = checkPage(y, 80);
      y += 8;
      y = subHeader(y, 'DIAGNOSTIC APPROFONDI (Pnom = ' + pnom + ' kW > 20 kW \u2014 obligatoire)');
      [['A. Rapport de diagnostic approfondi pr\u00e9sent ?', data.diag_rapport_present], ['B. Modification du syst\u00e8me depuis dernier diagnostic ?', data.diag_modification], ['C. Modification r\u00e9alis\u00e9e apr\u00e8s le 30/04/2015 ?', data.diag_modification_2015], ['D. Au moins 2 ans depuis la modification ?', data.diag_2ans], ["E. Le diagnostic a-t-il d\u00e9j\u00e0 \u00e9t\u00e9 report\u00e9 ?", data.diag_reporte]].forEach(function(r, i) { y = statusRow(y, r[0], r[1], i % 2 === 0 ? C.grayLight : null); });
    }
    y += 14;

    // ───────────────────────────────────────
    // VOLET 3 — COMBUSTION
    // ───────────────────────────────────────
    y = checkPage(y, 130);
    y = secHeader(y, 'VOLET 3  \u2014  CONTR\u00d4LE DE COMBUSTION');

    var pm      = data.perf_min || {};
    var vals    = data.valeurs_combustion || {};
    var colDefs = isPellet
      ? [['co_ppm', 'CO MAX\n\u00e0 13% O2\n(ppm)'], ['rendement', 'Rendement\nMIN (%)']]
      : [['t_nette', 'T\u00b0 nette\nfum\u00e9es\nMAX (\u00b0C)'], ['co2', 'CO2\nMIN (%)'], ['o2', 'O2\nMAX (%)'], ['co', 'CO MAX\n(mg/kWh)'], ['rendement', 'Rendement\nMIN (%)']];

    var lblW = 140;
    var dw   = (PW - lblW) / colDefs.length;
    var thH2 = 42;

    // En-tête tableau combustion
    fillRRect(ML, y, lblW, thH2, C.bluePale, C.blueBorder, 3);
    t('Mesure', ML + 10, y + thH2 / 2 - 5, { bold: true, size: 9, color: C.blue });
    colDefs.forEach(function(col, j) {
      var xc = ML + lblW + j * dw;
      fillRect(xc, y, dw, thH2, j % 2 === 0 ? C.bluePale : '#E8EAFE');
      if (j === 0) strokeRect(xc, y, dw, thH2, C.blueBorder, 0.4);
      var lines = col[1].split('\n');
      var lhh   = 10;
      var sy    = y + (thH2 - lines.length * lhh) / 2;
      lines.forEach(function(line, li) {
        t(line, xc, sy + li * lhh, { bold: true, size: 8, color: C.blue, width: dw, align: 'center' });
      });
    });
    strokeRect(ML, y, PW, thH2, C.blueBorder, 0.5);
    y += thH2;

    // Perf min
    var crh = 24;
    fillRect(ML, y, PW, crh, C.grayLight);
    t('Performances min. r\u00e9glementaires', ML + 10, y + 8, { bold: true, size: 8.5, color: C.textMid });
    colDefs.forEach(function(col, j) { t(pm[col[0]] || '\u2014', ML + lblW + j * dw, y + 8, { size: 9, color: C.textMid, width: dw, align: 'center' }); });
    hl(y + crh, ML, W - MR, C.line, 0.4);
    y += crh;

    // Valeurs mesurées
    fillRect(ML, y, PW, crh, C.white);
    t('Valeurs mesur\u00e9es', ML + 10, y + 8, { bold: true, size: 8.5, color: C.text });
    colDefs.forEach(function(col, j) { t(vals[col[0]] || '\u2014', ML + lblW + j * dw, y + 8, { bold: true, size: 11, color: C.blue, width: dw, align: 'center' }); });
    hl(y + crh, ML, W - MR, C.line, 0.4);
    y += crh;

    // Comparaison
    fillRect(ML, y, PW, crh + 4, C.bluePale);
    t('Comparaison', ML + 10, y + 9, { bold: true, size: 8.5, color: C.blue });
    colDefs.forEach(function(col, j) {
      var xc  = ML + lblW + j * dw;
      var v   = (data['cmp_' + col[0]] || '').toUpperCase();
      var fg  = v === 'OK' ? C.green : v === 'NOK' ? C.red : C.textMid;
      var bg  = v === 'OK' ? C.greenBg : v === 'NOK' ? C.redBg : C.gray;
      fillRRect(xc + 6, y + 4, dw - 12, crh - 4, bg, null, 3);
      t(v || '\u2014', xc + 6, y + 9, { bold: true, size: 9.5, color: fg, width: dw - 12, align: 'center' });
    });
    y += crh + 10;

    // Temp eau
    t('Temp\u00e9rature eau lors de la mesure : ' + (data.temp_eau || '\u2014') + ' \u00b0C', W - MR - 220, y, { size: 8.5, color: C.textMid, width: 220, align: 'right' });
    y += 16;

    // Résultat global
    var rOk = data.resultat_combustion === 'OK';
    var rNok = data.resultat_combustion === 'NOK';
    fillRRect(ML, y, PW, 32, rOk ? C.greenBg : rNok ? C.redBg : C.grayLight, rOk ? C.greenBord : rNok ? C.redBord : C.line, 4);
    if (rOk || rNok) checkIcon(ML + 14, y + 9, rOk, 13, rOk ? C.green : C.red);
    t('R\u00c9SULTAT GLOBAL COMBUSTION : ' + (data.resultat_combustion || '\u2014'), ML + (rOk || rNok ? 34 : 14), y + 10, { bold: true, size: 12, color: rOk ? C.green : rNok ? C.red : C.textMid });
    y += 40;

    // ───────────────────────────────────────
    // VOLET 4 — CONFORMITÉ
    // ───────────────────────────────────────
    y = checkPage(y, 90);
    y = secHeader(y, 'VOLET 4  \u2014  D\u00c9CLARATION DE CONFORMIT\u00c9  \u2014  AGW 29/01/2009');

    fillRRect(ML, y, PW, 50, confOk ? C.greenBg : C.redBg, confOk ? C.greenBord : C.redBord, 4);
    t("L'ensemble installation \u2014 ventilation \u2014 amen\u00e9e d'air \u2014 \u00e9vacuation gaz est-il conforme \u00e0 l'AGW ?", ML + 14, y + 8, { size: 9, color: confOk ? C.green : C.red, width: PW - 28 });
    checkIcon(ML + 14, y + 24, confOk, 15, confOk ? C.green : C.red);
    t((conf || '\u2014').toUpperCase(), ML + 36, y + 26, { bold: true, size: 18, color: confOk ? C.green : C.red });
    y += 58;

    if (data.causes_non_conformite) {
      fillRRect(ML, y, PW, 20, C.orangeBg, C.orangeBord, 3);
      t('Causes de non-conformit\u00e9 et actions \u00e0 entreprendre :', ML + 10, y + 6, { bold: true, size: 9, color: C.orange });
      y += 24;
      var cH = Math.max(36, doc.heightOfString(data.causes_non_conformite, { width: PW - 22 }) + 16);
      fillRRect(ML, y, PW, cH, '#FFFAF4', C.orangeBord, 3);
      doc.save().fillColor(C.text).font('Helvetica').fontSize(9).text(data.causes_non_conformite, ML + 11, y + 9, { width: PW - 22, lineBreak: true }).restore();
      y += cH + 10;
    }

    if (data.remarques) {
      t('Autres remarques :', ML + 8, y, { bold: true, size: 9, color: C.textMid });
      y += 16;
      var rH = Math.max(30, doc.heightOfString(data.remarques, { width: PW - 22 }) + 16);
      fillRRect(ML, y, PW, rH, C.grayLight, C.line, 3);
      doc.save().fillColor(C.text).font('Helvetica').fontSize(9).text(data.remarques, ML + 11, y + 9, { width: PW - 22, lineBreak: true }).restore();
      y += rH + 12;
    }

    // ───────────────────────────────────────
    // VOLET 5 — SIGNATURES
    // ───────────────────────────────────────
    y = checkPage(y, 110);
    y = secHeader(y, 'VOLET 5  \u2014  PROCHAINES INTERVENTIONS ET SIGNATURES');

    var hw4 = PW / 2 - 4;
    fillRRect(ML, y, hw4, 30, confOk ? C.greenBg : C.grayLight, confOk ? C.greenBord : C.line, 3);
    fillRRect(ML + hw4 + 8, y, hw4, 30, !confOk ? C.redBg : C.grayLight, !confOk ? C.redBord : C.line, 3);
    t('R\u00e9ception positive : ' + (confOk ? 'OUI' : 'NON'), ML + 12, y + 10, { bold: true, size: 10.5, color: confOk ? C.green : C.textMid });
    t('R\u00e9ception n\u00e9gative : ' + (!confOk ? 'OUI' : 'NON'), ML + hw4 + 20, y + 10, { bold: true, size: 10.5, color: !confOk ? C.red : C.textMid });
    y += 38;

    var intv = [
      ['Mise en conformit\u00e9 au plus tard le :', data.mise_conformite_date],
      ['Prochain contr\u00f4le p\u00e9riodique entre :', [data.prochain_controle_debut, data.prochain_controle_fin].filter(Boolean).join(' \u2013 ')],
      ['Prochain entretien constructeur au plus tard le :', data.prochain_entretien],
      ['Analyse de combustion (DA) au plus tard le :', data.prochaine_da],
    ].filter(function(r) { return r[1] && r[1].trim() && r[1].trim() !== '\u2013'; });

    if (intv.length) {
      y = subHeader(y, 'PROCHAINES INTERVENTIONS');
      intv.forEach(function(r, i) { y = kvRow(y, r[0], r[1], i % 2 === 0 ? C.grayLight : null); });
      y += 12;
    }

    hl(y, ML, W - MR, C.line, 0.8);
    y += 16;

    // Signataires
    [[data.tech_nom, data.tech_agrement, 'Rapport r\u00e9alis\u00e9 par :'], [data.client_nom, 'En qualit\u00e9 de : ' + (data.client_qualite || ''), 'Rapport re\u00e7u par :']].forEach(function(r, xi) {
      var x0 = ML + xi * (hw4 + 8);
      fillRRect(x0, y, hw4, 24, C.bluePale, C.blueBorder, 3);
      t(r[2], x0 + 10, y + 8, { bold: true, size: 9, color: C.blue });
      t(r[0] || '\u2014', x0 + 10, y + 32, { bold: true, size: 10, color: C.text, width: hw4 - 20 });
      t(r[1] || '', x0 + 10, y + 46, { size: 8.5, color: C.textMid, width: hw4 - 20 });
    });
    y += 54;

    // Cadres signature
    [ML, ML + hw4 + 8].forEach(function(x0) {
      fillRRect(x0, y, hw4, 44, C.white, C.line, 3);
      t('Signature', x0 + 10, y + 36, { size: 8.5, color: C.line });
    });
    y += 52;

    // Mention urgence
    y = checkPage(y, 30);
    fillRRect(ML, y, PW, 28, C.redBg, C.redBord, 3);
    t('ATTENTION \u2014 En cas de danger : Secours ORES 0800 87 087  |  SOS gaz EANDIS/FLUXYS 0800 65 065  |  Urgences 100/112', ML + 10, y + 6, { bold: true, size: 8, color: C.red, width: PW - 20 });
    t("En cas de non-conformit\u00e9, l'utilisateur et le propri\u00e9taire sont avertis. Un \u00e9crit sign\u00e9 leur est remis, chacun en recevant une copie.", ML + 10, y + 17, { size: 7.5, color: '#9B1C1C', width: PW - 20 });

    // Footers toutes pages
    drawFooters();
    doc.end();
  });
}

module.exports = { generateAttestation };
