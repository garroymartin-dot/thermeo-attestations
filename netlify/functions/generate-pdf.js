const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { data } = JSON.parse(event.body);
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Clé API non configurée sur Netlify' }) };
    }

    // ── Appel API Anthropic pour formatter/valider les données ──
    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 50,
        messages: [{ role: 'user', content: 'OK' }],
      }),
    });

    if (!anthropicResp.ok) {
      const err = await anthropicResp.json();
      return { statusCode: 401, headers, body: JSON.stringify({ error: err.error?.message || 'Clé API invalide' }) };
    }

    // ── Génération PDF avec Python + ReportLab ──
    const tmpDir = os.tmpdir();
    const dataFile = path.join(tmpDir, `data_${Date.now()}.json`);
    const pdfFile = path.join(tmpDir, `attestation_${Date.now()}.pdf`);
    const scriptFile = path.join(__dirname, 'generate_pdf.py');

    fs.writeFileSync(dataFile, JSON.stringify(data));

    execSync(`python3 "${scriptFile}" "${dataFile}" "${pdfFile}"`, {
      timeout: 30000,
      env: { ...process.env, PATH: '/usr/bin:/usr/local/bin:/opt/homebrew/bin' },
    });

    const pdfBuffer = fs.readFileSync(pdfFile);
    const pdfBase64 = pdfBuffer.toString('base64');

    // Nettoyage
    try { fs.unlinkSync(dataFile); fs.unlinkSync(pdfFile); } catch(e) {}

    const nomClient = (data.client_nom || 'client').replace(/[^a-zA-Z0-9]/g, '_');
    const nomFichier = `Attestation_${data.n_rapport || 'thermeo'}_${nomClient}.pdf`;

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf: pdfBase64, filename: nomFichier }),
    };

  } catch (err) {
    console.error('Erreur génération PDF:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Erreur lors de la génération : ' + err.message }),
    };
  }
};
