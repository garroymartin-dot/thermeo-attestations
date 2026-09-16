const { generateAttestation, generateReceptionGaz } = require('./pdf-generator');

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-App-Password',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Identité du technicien fixée côté serveur — jamais acceptée depuis le
// payload client, pour empêcher qu'une attestation usurpe un autre nom
// ou numéro d'agréation.
const TECH_FIXED = {
  tech_nom: 'Martin Garroy',
  tech_agrement: 'TGI 467',
  tech_entreprise: 'Thermeo',
  tech_tel: '0478/655033',
  tech_email: 'Contact@thermeo.be',
  tech_nentreprise: 'BE0755731354',
};

async function archiveByEmail(pdfBuffer, data, nomFichier) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // archivage désactivé si non configuré
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Thermeo Attestations <onboarding@resend.dev>',
        to: ['contact@thermeo.be'],
        subject: `Attestation générée — ${data.n_rapport || '—'} — ${data.client_nom || 'client'}`,
        text: [
          'Nouvelle attestation générée automatiquement.',
          `Type : ${data.type_attestation === 'reception' ? 'Réception chauffage gaz' : 'Contrôle périodique'}`,
          `N° attestation : ${data.n_rapport || '—'}`,
          `Date : ${data.date || '—'}`,
          `Client : ${data.client_nom || '—'}`,
          `Adresse : ${data.client_adresse || '—'} ${data.client_localite || ''}`.trim(),
        ].join('\n'),
        attachments: [{ filename: nomFichier, content: pdfBuffer.toString('base64') }],
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      console.error('Archivage email échoué (Resend) :', resp.status, err.message || '');
    }
  } catch (err) {
    console.error('Archivage email échoué :', err.message);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: HEADERS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const appPassword = process.env.APP_PASSWORD;
    if (!appPassword) {
      return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ error: 'Application non configurée (variable APP_PASSWORD manquante sur Netlify)' }) };
    }
    const provided = event.headers['x-app-password'] || event.headers['X-App-Password'];
    if (provided !== appPassword) {
      return { statusCode: 401, headers: HEADERS, body: JSON.stringify({ error: 'Mot de passe invalide' }) };
    }

    // Récupération données
    let data;
    try { data = JSON.parse(event.body).data; if (!data) throw new Error('data manquant'); }
    catch (e) { return { statusCode: 400, headers: HEADERS, body: JSON.stringify({ error: 'Requête invalide : ' + e.message }) }; }

    // Identité du technicien imposée côté serveur (jamais depuis le client)
    Object.assign(data, TECH_FIXED);

    // Génération PDF — routage selon le type d'attestation
    const pdfBuffer = data.type_attestation === 'reception'
      ? await generateReceptionGaz(data)
      : await generateAttestation(data);
    const nomClient = (data.client_nom || 'client').replace(/[^a-zA-Z0-9]/g, '_');
    const nomFichier = `Attestation_${data.n_rapport || 'thermeo'}_${nomClient}.pdf`;

    // Archivage — ne doit jamais empêcher la remise du PDF au technicien
    await archiveByEmail(pdfBuffer, data, nomFichier);

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
