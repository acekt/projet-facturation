"use client";

import React from "react";
import ReactPDF from "@react-pdf/renderer";
const { Document, Page, Text, View, Image } = ReactPDF;
import { type Quote, type Invoice, type Settings, type CreditNote } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import { amountInWordsFCFA } from "@/lib/utils/amount-in-words";
import { pdfStyles as styles } from "@/components/pdf/pdf-styles";

type DocumentData = Quote | Invoice | CreditNote;

function formatCurrencyPDF(amount: number): string {
  return (
    new Intl.NumberFormat("fr-FR", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(Math.round(amount))
      .replace(/\u00a0/g, " ") + " FCFA"
  );
}

function generateHash(doc: DocumentData, type: string): string {
  const inputStr = `${type}-${doc.number || ""}-${doc.date || ""}-${doc.total || 0}`;
  let hash = 0;
  for (let i = 0; i < inputStr.length; i++) {
    hash = (hash << 5) - hash + inputStr.charCodeAt(i);
    hash = hash & hash;
  }
  const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
  return `DGI-VAL-${hexHash.substring(0, 4)}-${hexHash.substring(4, 8)}-${(
    Math.round(doc.total) % 997
  )
    .toString()
    .padStart(3, "0")}`;
}

export interface PDFDocumentProps {
  document: DocumentData;
  type: "devis" | "facture" | "avoir";
  settings: Settings;
  relatedInvoiceNumber?: string | null;
}

export const PDFDocument = ({
  document,
  type,
  settings,
  relatedInvoiceNumber,
}: PDFDocumentProps) => {
  const hash = generateHash(document, type);
  const docTypeLabel =
    type === "devis" ? "DEVIS" : type === "facture" ? "FACTURE" : "NOTE D'AVOIR";
  const companyCity = settings.address
    ? settings.address.split(",")[0]?.trim()
    : "Libreville";

  const discount = "discount" in document ? Number((document as any).discount) || 0 : 0;
  const netHT = (document.taxBase ?? document.subtotal) - (document.cssAmount ?? 0);
  const tpsAmt = document.tpsAmount ?? 0;
  const dueDate = "dueDate" in document ? (document as Invoice).dueDate : undefined;
  const validUntil = "validUntil" in document ? (document as Quote).validUntil : undefined;
  const subject =
    type === "avoir"
      ? ("reason" in document && (document as any).reason) || ("subject" in document && (document as any).subject) || "Avoir commercial"
      : ("subject" in document && (document as any).subject) || undefined;
  const notes =
    ("notes" in document && (document as any).notes) || settings.mentionsLegales || undefined;

  const clientEmail = "clientEmail" in document ? (document as any).clientEmail : undefined;

  const netLabel =
    type === "devis"
      ? "TOTAL ESTIMÉ"
      : type === "avoir"
      ? "AVOIR TTC (CRÉDIT)"
      : "TOTAL TTC";

  return (
    <Document title={`${type.toUpperCase()}_${document.number}`}>
      <Page size="A4" style={styles.page}>
        {/* ── 1. EN-TÊTE ── */}
        <View style={styles.header}>
          <View style={styles.logoSection}>
            {settings.logo ? (
              <Image src={settings.logo} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderText}>LOGO</Text>
              </View>
            )}
            <View>
              <Text style={styles.companyName}>{settings.companyName || "ENTREPRISE"}</Text>
              {settings.legalForm && (
                <Text style={styles.companyDetails}>{settings.legalForm}</Text>
              )}
              {settings.address && (
                <Text style={styles.companyDetails}>{settings.address}</Text>
              )}
              {(settings.phone || settings.email) && (
                <Text style={styles.companyDetails}>
                  {[settings.phone && `Tél: ${settings.phone}`, settings.email]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.docTypeSection}>
            <View style={styles.docHeaderContainer}>
              <Text style={styles.docType}>{docTypeLabel}</Text>
              <Text style={styles.docNumber}>N° {document.number}</Text>
            </View>
            <Text style={styles.dateText}>
              {companyCity}, le {formatDate(document.date)}
            </Text>
            {type === "devis" && validUntil && (
              <Text style={styles.dateText}>
                Date de validité : {formatDate(validUntil)}
              </Text>
            )}
            {dueDate && (
              <Text style={styles.accentText}>Échéance : {formatDate(dueDate)}</Text>
            )}
            {type === "avoir" && (relatedInvoiceNumber || ("invoiceId" in document && (document as any).invoiceId)) && (
              <Text style={styles.dateText}>
                Réf. Facture liée : {relatedInvoiceNumber || (document as any).invoiceId}
              </Text>
            )}
          </View>
        </View>

        {/* ── 2. DESTINATAIRE & OBJET ── */}
        <View style={styles.metaGrid}>
          <View style={styles.recipientBox}>
            <Text style={styles.recipientLabel}>Client destinataire</Text>
            <Text style={styles.recipientName}>{document.clientName}</Text>
            {clientEmail && <Text style={styles.recipientSub}>{clientEmail}</Text>}
          </View>
        </View>

        {subject && (
          <View style={styles.subjectBox}>
            <Text style={styles.subjectText}>
              <Text style={{ fontWeight: "bold" }}>{type === "avoir" ? "Motif de l'avoir : " : "Objet : "}</Text>
              {subject}
            </Text>
          </View>
        )}

        {/* ── 3. TABLEAU DES PRESTATIONS ── */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colDescription}>
              <Text style={styles.tableHeaderText}>Désignation</Text>
            </View>
            <View style={styles.colQty}>
              <Text style={styles.tableHeaderText}>Qté</Text>
            </View>
            <View style={styles.colPrice}>
              <Text style={styles.tableHeaderText}>P.U (HT)</Text>
            </View>
            <View style={styles.colTotal}>
              <Text style={styles.tableHeaderText}>Total (HT)</Text>
            </View>
          </View>

          {document.items.map((item, index) => (
            <View key={index} style={styles.tableRow} wrap={false}>
              <View style={styles.colDescription}>
                <Text style={styles.rowText}>{item.description}</Text>
              </View>
              <View style={styles.colQty}>
                <Text style={styles.rowText}>{item.quantity}</Text>
              </View>
              <View style={styles.colPrice}>
                <Text style={styles.rowText}>{formatCurrencyPDF(item.unitPrice)}</Text>
              </View>
              <View style={styles.colTotal}>
                <Text style={styles.rowTextBold}>{formatCurrencyPDF(item.total)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── 4. CASCADE FISCALE DGI & TOTAUX ── */}
        <View style={styles.totalsSection} wrap={false}>
          <View style={styles.totalsContainer}>
            <View style={styles.totalCol}>
              <Text style={styles.totalLabel}>Brut HT</Text>
              <Text style={styles.totalVal}>{formatCurrencyPDF(document.subtotal)}</Text>
            </View>
            {discount > 0 && (
              <View style={styles.totalCol}>
                <Text style={styles.totalLabel}>Remise</Text>
                <Text style={styles.totalVal}>− {formatCurrencyPDF(discount)}</Text>
              </View>
            )}
            <View style={styles.totalCol}>
              <Text style={styles.totalLabel}>Net HT</Text>
              <Text style={styles.totalVal}>{formatCurrencyPDF(netHT)}</Text>
            </View>
            <View style={styles.totalCol}>
              <Text style={styles.totalLabel}>CSS {settings.cssRate ?? 1}%</Text>
              <Text style={styles.totalVal}>{formatCurrencyPDF(document.cssAmount)}</Text>
            </View>
            {tpsAmt > 0 && (
              <View style={styles.totalCol}>
                <Text style={styles.totalLabel}>TPS {settings.tpsRate ?? 9.5}%</Text>
                <Text style={styles.totalVal}>{formatCurrencyPDF(tpsAmt)}</Text>
              </View>
            )}
            <View style={styles.totalCol}>
              <Text style={styles.totalLabel}>TVA {settings.tvaRate ?? 18}%</Text>
              <Text style={styles.totalVal}>{formatCurrencyPDF(document.tvaAmount)}</Text>
            </View>
            <View style={styles.totalColFinal}>
              <Text style={styles.totalLabelFinal}>{netLabel}</Text>
              <Text style={styles.totalValFinal}>{formatCurrencyPDF(document.total)}</Text>
            </View>
          </View>
        </View>

        {/* ── 5. ARRÊTÉ DU DOCUMENT EN TOUTES LETTRES ── */}
        <View style={styles.arrestationBox} wrap={false}>
          <Text style={styles.arrestationText}>
            Arrêté{" "}
            {type === "devis"
              ? "le présent devis à la somme estimative de"
              : type === "avoir"
              ? "la présente note d'avoir à la somme de"
              : "la présente facture à la somme de"}{" "}
            : {amountInWordsFCFA(document.total)} ({formatCurrencyPDF(document.total)}).
          </Text>
        </View>

        {/* ── 6. COORDONNÉES BANCAIRES & MODALITÉS ── */}
        <View style={styles.bottomGrid} wrap={false}>
          <View style={styles.bankBox}>
            <Text style={styles.bankTitle}>Coordonnées pour Virement Bancaire</Text>
            <View style={styles.bankText}>
              {settings.bankName && (
                <Text>
                  <Text style={{ fontWeight: "bold" }}>Banque : </Text>
                  {settings.bankName}
                </Text>
              )}
              {settings.accountNumber && (
                <Text>
                  <Text style={{ fontWeight: "bold" }}>N° Compte : </Text>
                  {settings.accountNumber}
                </Text>
              )}
              {settings.iban && (
                <Text>
                  <Text style={{ fontWeight: "bold" }}>IBAN/RIB : </Text>
                  {settings.iban}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.conditionsBox}>
            <Text style={styles.bankTitle}>{type === "avoir" ? "Modalités de Remboursement" : "Conditions & Notes"}</Text>
            <View style={styles.bankText}>
              {notes ? (
                <Text>{notes}</Text>
              ) : type === "avoir" ? (
                <Text>
                  Crédit porté en déduction des prochaines factures ou remboursement selon
                  accord commercial.
                </Text>
              ) : type === "devis" ? (
                <Text>
                  Règlement par virement bancaire ou chèque à validation du bon de commande.
                </Text>
              ) : (
                <Text>
                  Modes acceptés : Espèces · Chèques · Virements bancaires. Délais : Au comptant.
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* ── 7. SIGNATURE ── */}
        <View style={styles.signatureSection} wrap={false}>
          <View style={styles.signatureBox}>
            <Text style={styles.signatureTitle}>La Direction</Text>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureSub}>Cachet & Signature autorisée</Text>
          </View>
        </View>

        {/* ── 8. PIED DE PAGE LÉGAL & HASH ── */}
        <View style={styles.footer} wrap={false}>
          <Text style={styles.footerCompany}>
            {(settings.companyName || "ENTREPRISE").toUpperCase()}
          </Text>
          <Text style={styles.footerText}>
            {[
              settings.legalForm,
              settings.nif ? `NIF : ${settings.nif}` : null,
              settings.rccm ? `RCCM : ${settings.rccm}` : null,
              settings.phone ? `Tél : ${settings.phone}` : null,
              settings.email,
            ]
              .filter(Boolean)
              .join(" | ")}
          </Text>
          {settings.mentionsLegales && (
            <Text style={styles.footerText}>{settings.mentionsLegales}</Text>
          )}
          <Text style={styles.footerHash}>{hash}</Text>
        </View>
      </Page>
    </Document>
  );
};
