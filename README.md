# 🔥 Thermeo — Attestations chaudières AGW 29/01/2009

Application web de génération d'attestations de réception et contrôle périodique pour générateurs de chaleur, conformément à la réglementation wallonne (AGW du 29/01/2009).

## Déploiement sur Netlify (5 minutes)

### Étape 1 — Connecter Netlify à GitHub

1. Allez sur **[netlify.com](https://netlify.com)** → créez un compte gratuit (avec votre compte GitHub)
2. Cliquez **"Add new site"** → **"Import an existing project"**
3. Choisissez **GitHub** → autorisez l'accès → sélectionnez le repo **`thermeo-attestations`**
4. Paramètres de build :
   - **Branch** : `main`
   - **Build command** : *(laisser vide)*
   - **Publish directory** : `public`
5. Cliquez **"Deploy site"**

### Étape 2 — Configurer la clé API Anthropic

1. Dans Netlify → votre site → **Site configuration** → **Environment variables**
2. Cliquez **"Add a variable"**
3. Key : `ANTHROPIC_API_KEY`
4. Value : votre clé API (trouvable sur [console.anthropic.com](https://console.anthropic.com) → API Keys)
5. Cliquez **"Save"**
6. Allez dans **Deploys** → **"Trigger deploy"** → **"Deploy site"** pour redémarrer

### Étape 3 — Votre URL

Votre app est disponible sur :
```
https://[nom-auto].netlify.app
```

Vous pouvez personnaliser l'URL dans **Site configuration** → **Domain management** → **Options** → **Edit site name** → `thermeo-attestations` → URL devient :
```
https://thermeo-attestations.netlify.app
```

---

## Mises à jour

Pour mettre à jour l'application :
1. Remplacez les fichiers dans le repo GitHub
2. Netlify redéploie automatiquement en 30 secondes

---

## Structure du projet

```
thermeo-attestations/
├── public/
│   └── index.html          ← Application web complète
├── netlify/
│   └── functions/
│       ├── generate-pdf.js  ← Proxy API + appel Python
│       └── generate_pdf.py  ← Générateur PDF ReportLab
├── netlify.toml             ← Configuration Netlify
├── package.json
└── README.md
```

---

## Coût estimé

- **Netlify** : gratuit (125 000 requêtes/mois)
- **API Anthropic** : ~0,001€ par attestation (validation données)
- **Total** : pratiquement gratuit pour un usage professionnel normal

---

*Développé pour Thermeo — Martin Garroy TGI 467 — AGW 29/01/2009 Région wallonne*
