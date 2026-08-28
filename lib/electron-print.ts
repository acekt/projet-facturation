/**
 * electron-print.ts — Utilitaire d'impression/export natif Electron
 * ==================================================================
 * Fournit deux exports publics :
 *
 *  buildPrintHtml(contentHtml)  — construit le document HTML complet prêt
 *                                  à être chargé dans une fenêtre Chromium
 *                                  cachée (impression OU export PDF).
 *
 *  printElement(elementId)      — capture le HTML d'un élément du DOM et
 *                                  l'envoie au Main Process via IPC pour
 *                                  impression avec la boîte de dialogue native.
 */



/**
 * Enveloppe un fragment HTML (outerHTML d'un <DocumentA4 />) dans un
 * squelette HTML complet prêt à être chargé dans une fenêtre Chromium cachée.
 *
 * Points clés :
 *  - Tailwind CDN est chargé pour que les classes arbitraires (ex: w-[210mm])
 *    soient disponibles sans accès au bundle Next.js.
 *  - `print-color-adjust: exact` est forcé sur body pour que Chromium
 *    préserve les fonds de couleur (économie d'encre désactivée).
 *  - Le script window.print() n'est inclus que pour l'impression ;
 *    printToPDF n'en a pas besoin (il rend directement sans boîte de dialogue).
 *
 * @param contentHtml       - outerHTML du <DocumentA4 /> capté dans le DOM
 * @param includePrintScript - true pour l'impression, false pour export PDF
 */
export function buildPrintHtml(contentHtml: string, includePrintScript = true): string {
  const printScript = includePrintScript
    ? `
  <script>
    (function() {
      var printed = false;
      function doPrint() {
        if (printed) return;
        printed = true;
        setTimeout(function() { window.print(); }, 150);
      }
      if (document.readyState === 'complete') {
        setTimeout(doPrint, 500);
      } else {
        window.addEventListener('load', function() { setTimeout(doPrint, 500); });
      }
    })();
  </script>`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>

  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              primary: '#003399',
              secondary: '#002277',
              accent: '#2CA02C',
              muted: '#E6F0FF'
            }
          }
        }
      }
    }
  </script>

  <style>
    /* Polyfill pour les variables CSS (au cas où Chromium cache ne parse pas Tailwind v4 nativement via CDN v3) */
    :root {
      --color-brand-primary: #003399;
      --color-brand-secondary: #002277;
      --color-brand-accent: #2CA02C;
      --color-brand-muted: #E6F0FF;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #f1f5f9;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
    }

    @page {
      size: A4 portrait;
      margin: 0mm;
    }

    @media print {
      html, body {
        background: white !important;
        margin: 0 !important;
        padding: 0 !important;
        display: block !important;
        /* Force Chromium à reproduire les fonds de couleur (sans économie d'encre) */
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      /* Feuille A4 : colle au coin supérieur gauche, zero décalage */
      .doc-a4 {
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        width: 210mm !important;
        height: 297mm !important;
        padding: 15mm !important;
        margin: 0 !important;
        box-shadow: none !important;
      }

      /* Cible l'ID stable — double sécurité contre l'ombre résiduelle */
      #printable-a4-document {
        box-shadow: none !important;
        margin: 0 !important;
      }

      /* En-tête tableau : fond navy forcé */
      .doc-a4 .items-table thead tr {
        background-color: var(--color-brand-secondary) !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .doc-a4 .items-table thead th {
        color: #ffffff !important;
      }

      /* Bloc "Net à payer" : fond bleu clair forcé */
      .doc-a4 .net-a-payer {
        background-color: var(--color-brand-muted) !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  ${contentHtml}
${printScript}
</body>
</html>`
}

/**
 * Capture le HTML d'un élément du DOM et l'envoie au Main Process via IPC
 * pour impression via la boîte de dialogue d'impression native.
 *
 * @param elementId - ID de l'élément <DocumentA4 /> caché à capturer
 */
export async function printElement(elementId: string): Promise<void> {
  const element = document.getElementById(elementId)

  if (!element) {
    throw new Error(`[print] Élément #${elementId} introuvable.`)
  }

  // ── Fallback navigateur (dev mode sans Electron) ──────────────────────────
  if (!window.electron?.printDocument) {
    window.print()
    return
  }

  const htmlDoc = buildPrintHtml(element.outerHTML, /* includePrintScript */ true)

  // ── Envoi au Main Process via IPC ─────────────────────────────────────────
  await window.electron.printDocument(htmlDoc)
}
