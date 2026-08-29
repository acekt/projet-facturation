"use client"

import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { type Quote, type Invoice, type Settings, type CreditNote } from '@/lib/store';

type DocumentData = Quote | Invoice | CreditNote;

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
    marginBottom: 40,
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
  docHeaderContainer: {
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
    padding: 8,
    width: 200,
    alignSelf: 'flex-end',
    marginBottom: 10,
  },
  docType: {
    fontSize: 18,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  docNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
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
    backgroundColor: '#E6F0FF',
    borderWidth: 1,
    borderColor: '#000',
  },
  tableRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
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
    color: '#000',
  },
  totalsSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 30,
  },
  totalsContainer: {
    width: '100%',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#000',
  },
  totalCol: {
    flex: 1,
    borderRightWidth: 1,
    borderColor: '#000',
    padding: 4,
    alignItems: 'center',
  },
  totalColLast: {
    flex: 1,
    padding: 4,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 8,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  totalVal: {
    fontSize: 9,
    fontWeight: 'bold',
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
    backgroundColor: '#003399',
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
    borderColor: '#00339933',
    backgroundColor: '#00339908',
    color: '#003399',
    borderRadius: 2,
  },
  bottomCenter: {
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
  }
});

function formatCurrencyPDF(amount: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount)).replace(/\u00a0/g, ' ') + ' FCFA';
}

function generateHash(doc: DocumentData, type: string) {
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
  document: DocumentData;
  type: 'devis' | 'facture' | 'avoir';
  settings: Settings;
}

export const PDFDocument = ({ document, type, settings }: PDFDocumentProps) => {
  const hash = generateHash(document, type);
  const docTypeLabel = type === 'devis' ? 'DEVIS' : type === 'facture' ? 'FACTURE' : 'AVOIR';

  return (
    <Document title={`${type.toUpperCase()}_${document.number}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoSection}>
            {settings.logo ? (
              <Image src={settings.logo} style={styles.logo} />
            ) : (
              <View style={[styles.logo, { backgroundColor: '#eee', borderRadius: 10 }]} />
            )}
            <View>
              <Text style={styles.companyName}>{settings.companyName}</Text>
            </View>
          </View>
          <View style={styles.docTypeSection}>
            <Text style={{ fontSize: 10, marginBottom: 20 }}>Moanda, le {document.date}</Text>
            <View style={styles.docHeaderContainer}>
              <Text style={styles.docType}>{docTypeLabel}: N°{document.number}</Text>
            </View>
          </View>
        </View>

        {/* Client Info */}
        <View style={{ marginBottom: 30, fontSize: 10 }}>
          <Text style={{ fontWeight: 'bold' }}>Client: {document.clientName}</Text>
          <Text>Objet: {('notes' in document ? (document as any).notes : null) || "Prestations de services"}</Text>
          <Text>NIF:</Text>
          <Text>BC:</Text>
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

        {/* Totals Grid */}
        <View style={styles.totalsSection} wrap={false}>
          <View style={styles.totalsContainer}>
            <View style={styles.totalCol}>
              <Text style={styles.totalLabel}>Brut HT</Text>
              <Text style={styles.totalVal}>{formatCurrencyPDF(document.subtotal)}</Text>
            </View>
            <View style={styles.totalCol}>
              <Text style={styles.totalLabel}>Remise</Text>
              <Text style={styles.totalVal}>{formatCurrencyPDF('discount' in document ? (document as any).discount : 0)}</Text>
            </View>
            <View style={styles.totalCol}>
              <Text style={styles.totalLabel}>Net HT</Text>
              <Text style={styles.totalVal}>{formatCurrencyPDF(document.taxBase - document.cssAmount)}</Text>
            </View>
            <View style={styles.totalCol}>
              <Text style={styles.totalLabel}>CSS</Text>
              <Text style={styles.totalVal}>{formatCurrencyPDF(document.cssAmount)}</Text>
            </View>
            <View style={styles.totalCol}>
              <Text style={styles.totalLabel}>TVA {settings.tvaRate}%</Text>
              <Text style={styles.totalVal}>{formatCurrencyPDF(document.tvaAmount)}</Text>
            </View>
            <View style={styles.totalColLast}>
              <Text style={styles.totalLabel}>NET A PAYER</Text>
              <Text style={styles.totalVal}>{formatCurrencyPDF(document.total)}</Text>
            </View>
          </View>
        </View>

        {/* Bank */}
        <View style={styles.bankSection} wrap={false}>
          <Text style={styles.bankTitle}>Coordonnées pour Virement Bancaire</Text>
          <View style={styles.bankGrid}>
            <Text style={{ fontSize: 8 }}><Text style={{ fontWeight: 'bold' }}>Banque:</Text> {settings.bankName}</Text>
            <Text style={{ fontSize: 8 }}><Text style={{ fontWeight: 'bold' }}>IBAN/RIB:</Text> {settings.iban}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 40, fontSize: 10 }} wrap={false}>
           <Text style={{ fontWeight: 'bold', marginBottom: 10 }}>
             Arrêter {type === 'devis' ? 'Le Présent devis' : 'La Présente facture'} à la Somme totale de : ... FCFA TTC
           </Text>
           <Text style={{ color: '#003399', fontSize: 9, fontWeight: 'bold' }}>N.B:</Text>
           <Text style={{ color: '#2CA02C', fontSize: 9 }}>- Les modes de règlement: *Espèces ; *Chèques ; *Virements .</Text>
           <Text style={{ color: '#2CA02C', fontSize: 9 }}>- Les délais de règlement: *Au Comptant;</Text>
        </View>

        <View style={{ alignItems: 'flex-end', marginBottom: 60 }} wrap={false}>
          <Text style={{ fontWeight: 'bold', marginRight: 40 }}>La Direction</Text>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopWidth: 0 }]}>
          <View style={styles.bottomCenter}>
            <Text style={{ fontWeight: 'bold', fontSize: 10, color: '#000', marginBottom: 2 }}>{settings.companyName.toUpperCase()}</Text>
            <Text>Tél: {settings.phone}</Text>
            <Text>BP: {settings.address.split(',')[1]?.trim() || "111 LIBREVILLE"}</Text>
            <Text>Email: {settings.email}</Text>
            <Text>NIF: {settings.nif} / RCCM: {settings.rccm}</Text>
            <Text>Compte BGFI N°: {settings.iban}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
