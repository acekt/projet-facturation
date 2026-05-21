"use client"

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { type Quote, type Invoice, type Settings } from '@/lib/store';

// Register a clean font if possible, otherwise use standard fonts
// Font.register({ family: 'Helvetica', ... });

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#333',
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: '#1a365d',
    paddingBottom: 15,
  },
  logoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 60,
    height: 60,
    objectFit: 'contain',
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a365d',
    textTransform: 'uppercase',
  },
  companyDetails: {
    fontSize: 8,
    color: '#666',
    marginTop: 2,
  },
  docTypeSection: {
    textAlign: 'right',
  },
  docType: {
    fontSize: 24,
    fontWeight: 'black',
    textTransform: 'uppercase',
  },
  docNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 2,
  },
  dateSection: {
    marginTop: 10,
    fontSize: 9,
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 30,
  },
  infoBox: {
    flex: 1,
    padding: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#eee',
  },
  infoBoxGray: {
    flex: 1,
    padding: 10,
    borderRadius: 4,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#eee',
  },
  infoTitle: {
    fontSize: 7,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#9ca3af',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 2,
    marginBottom: 5,
  },
  infoText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  infoSubtext: {
    fontSize: 8,
    color: '#4b5563',
  },
  table: {
    display: 'flex',
    width: 'auto',
    marginBottom: 30,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    minHeight: 30,
    alignItems: 'center',
  },
  colDescription: { width: '55%', padding: 5 },
  colQty: { width: '10%', textAlign: 'right', padding: 5 },
  colPrice: { width: '15%', textAlign: 'right', padding: 5 },
  colTotal: { width: '20%', textAlign: 'right', padding: 5 },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  totalsSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 30,
  },
  totalsContainer: {
    width: 200,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  totalRowBold: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
    marginVertical: 2,
  },
  totalFinal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#1a365d',
    color: '#fff',
    borderRadius: 4,
    marginTop: 5,
  },
  totalFinalText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  bankSection: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#eee',
    borderStyle: 'dashed',
    borderRadius: 8,
    marginBottom: 40,
  },
  bankTitle: {
    fontSize: 7,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#9ca3af',
    marginBottom: 5,
  },
  bankGrid: {
    flexDirection: 'row',
    gap: 20,
  },
  footer: {
    marginTop: 'auto',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 15,
  },
  validationSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  hashText: {
    fontFamily: 'Courier',
    fontSize: 7,
    color: '#9ca3af',
    marginTop: 2,
  },
  badge: {
    fontSize: 7,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#1a365d33',
    backgroundColor: '#1a365d08',
    color: '#1a365d',
    borderRadius: 2,
  },
  bottomCenter: {
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
  }
});

function formatCurrencyPDF(amount: number) {
  return new Intl.NumberFormat('fr-GA', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('XAF', '').trim() + ' FCFA';
}

function generateHash(doc: any, type: string) {
  const inputStr = `${type}-${doc.number || ''}-${doc.date || ''}-${doc.total || 0}`;
  let hash = 0;
  for (let i = 0; i < inputStr.length; i++) {
    hash = ((hash << 5) - hash) + inputStr.charCodeAt(i);
    hash = hash & hash;
  }
  const hexHash = Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
  return `DGI-VAL-${hexHash.substring(0, 4)}-${hexHash.substring(4, 8)}-${(Math.round(doc.total) % 997).toString().padStart(3, '0')}`;
}

interface PDFDocumentProps {
  document: Quote | Invoice | any;
  type: 'devis' | 'facture' | 'avoir';
  settings: Settings;
}

export const PDFDocument = ({ document, type, settings }: PDFDocumentProps) => {
  const hash = generateHash(document, type);

  return (
    <Document title={`${type.toUpperCase()}_${document.number}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoSection}>
            {settings.logo && (
              <Image src={settings.logo} style={styles.logo} />
            )}
            <View>
              <Text style={styles.companyName}>{settings.companyName}</Text>
              <View style={styles.companyDetails}>
                <Text>{settings.address}</Text>
                <Text>Email: {settings.email} | Tél: {settings.phone}</Text>
              </View>
            </View>
          </View>
          <View style={styles.docTypeSection}>
            <Text style={styles.docType}>{type}</Text>
            <Text style={styles.docNumber}>N° {document.number}</Text>
            <View style={styles.dateSection}>
              <Text>Date d'émission: {document.date}</Text>
              <Text>Date d'échéance: {document.dueDate}</Text>
            </View>
          </View>
        </View>

        {/* Client Info */}
        <View style={styles.infoGrid}>
          <View style={styles.infoBoxGray}>
            <Text style={styles.infoTitle}>Émetteur</Text>
            <Text style={styles.infoText}>{settings.companyName}</Text>
            <Text style={styles.infoSubtext}>NIF: {settings.nif}</Text>
            <Text style={styles.infoSubtext}>RCCM: {settings.rccm}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Destinataire</Text>
            <Text style={styles.infoText}>{document.clientName}</Text>
            <Text style={styles.infoSubtext}>{document.clientEmail}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.colDescription}><Text style={styles.tableHeaderText}>Désignation</Text></View>
            <View style={styles.colQty}><Text style={styles.tableHeaderText}>Qté</Text></View>
            <View style={styles.colPrice}><Text style={styles.tableHeaderText}>P.U (HT)</Text></View>
            <View style={styles.colTotal}><Text style={styles.tableHeaderText}>Total (HT)</Text></View>
          </View>

          {document.items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <View style={styles.colDescription}><Text>{item.description}</Text></View>
              <View style={styles.colQty}><Text>{item.quantity}</Text></View>
              <View style={styles.colPrice}><Text>{formatCurrencyPDF(item.unitPrice)}</Text></View>
              <View style={styles.colTotal}><Text style={{ fontWeight: 'bold' }}>{formatCurrencyPDF(item.total)}</Text></View>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsContainer}>
            <View style={styles.totalRow}>
              <Text style={{ color: '#666' }}>Total HT</Text>
              <Text>{formatCurrencyPDF(document.subtotal)}</Text>
            </View>
            {document.discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={{ color: '#dc2626', fontStyle: 'italic' }}>Remise</Text>
                <Text style={{ color: '#dc2626' }}>- {formatCurrencyPDF(document.discount)}</Text>
              </View>
            )}
            <View style={styles.totalRowBold}>
              <Text style={{ fontWeight: 'bold' }}>Net Hors Taxes</Text>
              <Text style={{ fontWeight: 'bold' }}>{formatCurrencyPDF(document.taxBase)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={{ color: '#666', fontSize: 8 }}>TVA ({settings.tvaRate}%)</Text>
              <Text style={{ fontSize: 8 }}>{formatCurrencyPDF(document.tvaAmount)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={{ color: '#666', fontSize: 8 }}>CSS ({settings.cssRate}%)</Text>
              <Text style={{ fontSize: 8 }}>{formatCurrencyPDF(document.cssAmount)}</Text>
            </View>
            <View style={styles.totalFinal}>
              <Text style={styles.totalFinalText}>NET À PAYER</Text>
              <Text style={styles.totalFinalText}>{formatCurrencyPDF(document.total)}</Text>
            </View>
          </View>
        </View>

        {/* Bank */}
        <View style={styles.bankSection}>
          <Text style={styles.bankTitle}>Coordonnées Bancaires</Text>
          <View style={styles.bankGrid}>
            <Text style={{ fontSize: 8 }}><Text style={{ fontWeight: 'bold' }}>Banque:</Text> {settings.bankName}</Text>
            <Text style={{ fontSize: 8 }}><Text style={{ fontWeight: 'bold' }}>IBAN/RIB:</Text> {settings.iban}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.validationSection}>
            <View>
              <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#666' }}>Validation Numérique DGI Gabon</Text>
              <Text style={styles.hashText}>{hash}</Text>
            </View>
            <Text style={styles.badge}>Conforme Système DGI-Gabon</Text>
          </View>
          <View style={styles.bottomCenter}>
            <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>{settings.companyName}</Text>
            <Text>Siège: {settings.address} | NIF: {settings.nif} | RCCM: {settings.rccm}</Text>
            <Text style={{ marginTop: 5, fontStyle: 'italic', fontSize: 7 }}>
              {type === 'facture' && "Facture originale émise électroniquement selon le code général des impôts gabonais."}
              {type === 'devis' && "Ce document est un devis proforma valable 30 jours."}
              {type === 'avoir' && "Avoir commercial émis en réduction d'une facture précédente."}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
