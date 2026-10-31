/**
 * Convertisseur de montants monétaires entiers en toutes lettres en français (Norme OHADA & FCFA).
 * Prend en charge les règles grammaticales françaises :
 * - Invariabilité de "mille"
 * - Accord de "cent" et "vingt" (quatre-vingts, deux cents)
 * - Accord de "million" et "milliard"
 * - Conjonction "et un" (vingt et un, soixante et un, etc.)
 */

const UNITES = [
  "",
  "un",
  "deux",
  "trois",
  "quatre",
  "cinq",
  "six",
  "sept",
  "huit",
  "neuf",
  "dix",
  "onze",
  "douze",
  "treize",
  "quatorze",
  "quinze",
  "seize",
  "dix-sept",
  "dix-huit",
  "dix-neuf",
];

const DIZAINES = [
  "",
  "dix",
  "vingt",
  "trente",
  "quarante",
  "cinquante",
  "soixante",
  "soixante-dix",
  "quatre-vingt",
  "quatre-vingt-dix",
];

function convertLessThanThousand(n: number): string {
  if (n === 0) return "";

  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;
  const parts: string[] = [];

  if (hundreds > 0) {
    if (hundreds === 1) {
      parts.push("cent");
    } else {
      // "deux cents" si aucun reste, sinon "deux cent dix"
      parts.push(remainder === 0 ? `${UNITES[hundreds]} cents` : `${UNITES[hundreds]} cent`);
    }
  }

  if (remainder > 0) {
    if (remainder < 20) {
      parts.push(UNITES[remainder]);
    } else {
      const ten = Math.floor(remainder / 10);
      const unit = remainder % 10;

      if (ten === 7) {
        // 70 = soixante-dix, 71 = soixante et onze, 72 = soixante-douze, etc.
        if (unit === 1) {
          parts.push("soixante et onze");
        } else {
          parts.push(`soixante-${UNITES[10 + unit]}`);
        }
      } else if (ten === 8) {
        // 80 = quatre-vingts, 81 = quatre-vingt-un, etc.
        if (unit === 0) {
          parts.push("quatre-vingts");
        } else {
          parts.push(`quatre-vingt-${UNITES[unit]}`);
        }
      } else if (ten === 9) {
        // 90 = quatre-vingt-dix, 91 = quatre-vingt-onze, etc.
        parts.push(`quatre-vingt-${UNITES[10 + unit]}`);
      } else {
        if (unit === 0) {
          parts.push(DIZAINES[ten]);
        } else if (unit === 1) {
          parts.push(`${DIZAINES[ten]} et un`);
        } else {
          parts.push(`${DIZAINES[ten]}-${UNITES[unit]}`);
        }
      }
    }
  }

  return parts.join(" ");
}

/**
 * Convertit un nombre entier positif en toutes lettres en français.
 */
export function numberToWordsFR(n: number): string {
  const rounded = Math.round(Math.abs(n));
  if (rounded === 0) return "zéro";

  const billions = Math.floor(rounded / 1_000_000_000);
  const millions = Math.floor((rounded % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((rounded % 1_000_000) / 1_000);
  const remainder = rounded % 1_000;

  const chunks: string[] = [];

  if (billions > 0) {
    const text = convertLessThanThousand(billions);
    chunks.push(billions > 1 ? `${text} milliards` : `${text} milliard`);
  }

  if (millions > 0) {
    const text = convertLessThanThousand(millions);
    chunks.push(millions > 1 ? `${text} millions` : `${text} million`);
  }

  if (thousands > 0) {
    if (thousands === 1) {
      chunks.push("mille");
    } else {
      chunks.push(`${convertLessThanThousand(thousands)} mille`);
    }
  }

  if (remainder > 0) {
    chunks.push(convertLessThanThousand(remainder));
  }

  return chunks.filter(Boolean).join(" ");
}

/**
 * Formate un montant monétaire en toutes lettres pour documents commerciaux (Francs CFA).
 * Exemple : 1487500 -> "un million quatre cent quatre-vingt-sept mille cinq cents Francs CFA"
 */
export function amountInWordsFCFA(amount: number): string {
  const words = numberToWordsFR(amount);
  return `${words} Francs CFA`;
}

