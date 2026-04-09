const { generateAttestation } = require('./pdf-generator');

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Clé API non configurée sur Netlify (variable ANTHROPIC_API_KEY manquante)' }) };
    }

    // Validation clé API (appel minimal avec claude-haiku, le moins cher)
    const check = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'ok' }] }),
    });
    if (!check.ok) {
      const err = await check.json().catch(() => ({}));
      return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Clé API invalide : ' + (err.error?.message || check.status) }) };
    }

    // Récupération données
    let data;
    try { data = JSON.parse(event.body).data; if (!data) throw new Error('data manquant'); }
    catch (e) { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Requête invalide : ' + e.message }) }; }

    // Génération PDF
    const pdfBuffer = await generateAttestation(data);
    const nomClient = (data.client_nom || 'client').replace(/[^a-zA-Z0-9]/g, '_');
    const nomFichier = `Attestation_${data.n_rapport || 'thermeo'}_${nomClient}.pdf`;

    return {
      statusCode: 200,
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf: pdfBuffer.toString('base64'), filename: nomFichier }),
    };

  } catch (err) {
    console.error('Erreur PDF:', err.message, err.stack);
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Erreur serveur : ' + err.message }) };
  }
};
