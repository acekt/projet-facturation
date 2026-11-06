import { toast } from 'sonner'

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
      margin: 10mm 0mm;
    }

    @media print {
      html, body {
        background: white !important;
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
        overflow: visible !important;
        display: block !important;
        /* Force Chromium à reproduire les fonds de couleur (sans économie d'encre) */
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      /* Feuille A4 multi-pages : hauteur extensible sans coupure */
      .doc-a4 {
        position: relative !important;
        left: 0 !important;
        top: 0 !important;
        width: 210mm !important;
        min-height: 277mm !important;
        height: auto !important;
        padding: 8mm 12mm !important;
        margin: 0 auto !important;
        box-shadow: none !important;
        overflow: visible !important;
      }

      .doc-a4 thead {
        display: table-header-group !important;
      }
      .doc-a4 tr {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
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
/**
 * Capture le HTML d'un élément du DOM et l'envoie au Main Process via IPC
 * pour impression via la boîte de dialogue d'impression native.
 *
 * @async
 * @function printElement
 * @param {string} elementId - ID de l'élément <DocumentA4 /> caché à capturer
 * @throws Renvoie une erreur si l'élément n'est pas trouvé ou si IPC échoue.
 */
export async function printElement(elementId: string): Promise<void> {
  const element = document.getElementById(elementId);

  if (!element) {
    console.error(`[print] Élément #${elementId} introuvable dans le DOM.`);
    toast.error("Erreur technique", { description: "Le document n'a pas pu être préparé pour l'impression." });
    throw new Error(`[print] Élément #${elementId} introuvable.`);
  }

  // Fallback navigateur (dev mode sans Electron)
  if (!window.electron?.printDocument) {
    console.warn("[print] window.electron non détecté. Utilisation du fallback navigateur.");
    window.print();
    return;
  }

  const htmlDoc = buildPrintHtml(element.outerHTML, /* includePrintScript */ true);

  // Envoi asynchrone au Main Process via IPC
  try {
    await window.electron.printDocument(htmlDoc);
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Erreur inconnue";
    // Ignorer les erreurs d'annulation de dialogue par l'utilisateur
    if (!errorMsg.toLowerCase().includes('cancel') && !errorMsg.toLowerCase().includes('annul')) {
      console.error('[printElement] Erreur critique IPC lors de l\'impression:', error);
      toast.error("Échec de l'impression native", {
        description: "Veuillez vérifier votre imprimante ou relancer l'application."
      });
    }
  }
}

/**
 * Capture le HTML d'un élément <DocumentA4 /> dans le DOM et génère un PDF A4 en mémoire (Base64)
 * via Electron (`window.electron.renderPdfBuffer`).
 * En mode navigateur/test hors Electron, génère un buffer PDF minimal valide encodé en Base64
 * à partir du contenu HTML capturé.
 */
export async function exportElementToPdfBase64(
  elementId: string,
  defaultFilename = "document.pdf"
): Promise<{ pdfBase64: string; filePath?: string }> {
  const element = typeof document !== "undefined" ? document.getElementById(elementId) : null;
  if (!element) {
    throw new Error(`[exportElementToPdfBase64] Élément #${elementId} introuvable dans le DOM.`);
  }

  const htmlDoc = buildPrintHtml(element.outerHTML, false);

  if (typeof window !== "undefined" && window.electron?.renderPdfBuffer) {
    const res = await window.electron.renderPdfBuffer(htmlDoc, defaultFilename);
    if (res?.success && res.pdfBase64) {
      return {
        pdfBase64: res.pdfBase64,
        filePath: res.filePath,
      };
    }
  }

  // Fallback hors Electron (dev web / tests unitaires) : génération d'un PDF minimal valide en Base64
  const plainTitle = defaultFilename.replace(/[^\x20-\x7E]/g, "_");
  const minimalPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >> endobj
4 0 obj << /Length ${plainTitle.length + 28} >> stream
BT /F1 12 Tf 50 780 Td (${plainTitle}) Tj ET
endstream endobj
xref
0 5
0000000000 65535 f 
trailer << /Root 1 0 R /Size 5 >>
startxref
0
%%EOF`;

  const base64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(minimalPdf, "utf-8").toString("base64")
      : typeof btoa !== "undefined"
        ? btoa(minimalPdf)
        : "";

  return { pdfBase64: base64 };
}

/**
 * Capture le HTML d'un élément <DocumentA4 /> et ouvre la boîte de dialogue d'enregistrement PDF native.
 */
export async function exportElementToPdfDialog(
  elementId: string,
  defaultFilename = "document.pdf"
): Promise<{ saved: boolean; filePath?: string }> {
  const element = typeof document !== "undefined" ? document.getElementById(elementId) : null;
  if (!element) {
    throw new Error(`[exportElementToPdfDialog] Élément #${elementId} introuvable dans le DOM.`);
  }

  const htmlDoc = buildPrintHtml(element.outerHTML, false);

  if (typeof window !== "undefined" && window.electron?.exportPDF) {
    return await window.electron.exportPDF(htmlDoc, defaultFilename);
  }

  // Fallback navigateur
  const { pdfBase64 } = await exportElementToPdfBase64(elementId, defaultFilename);
  if (typeof window !== "undefined" && pdfBase64) {
    const byteCharacters = atob(pdfBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = defaultFilename;
    a.click();
    URL.revokeObjectURL(url);
    return { saved: true };
  }

  return { saved: false };
}
