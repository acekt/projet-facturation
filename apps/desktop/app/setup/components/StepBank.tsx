'use client';

import * as React from 'react';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Info } from 'lucide-react';
import { useSetupWizard } from '../hooks/useSetupWizard';

interface StepBankProps {
  wizard: ReturnType<typeof useSetupWizard>;
}

export function StepBank({ wizard }: StepBankProps) {
  const {
    bankName,
    setBankName,
    bankAgency,
    setBankAgency,
    accountNumber,
    setAccountNumber,
    swiftCode,
    setSwiftCode,
    iban,
    setIban,
  } = wizard;

  return (
    <div className="space-y-4">
      <div className="bg-secondary/40 border border-border rounded-xl p-3 flex items-center gap-2.5 text-xs text-muted-foreground">
        <Info className="w-4 h-4 text-primary shrink-0" />
        <span>Facilitez le virement de vos clients en affichant votre RIB au pied de chaque document officiel.</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="bank-name" className="text-xs font-medium">Établissement Bancaire</Label>
          <Input
            id="bank-name"
            type="text"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="ex: BGFI Bank, BICIG, UBA, Orabank..."
            className="bg-secondary/50 border-border text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bank-agency" className="text-xs font-medium">Agence</Label>
          <Input
            id="bank-agency"
            type="text"
            value={bankAgency}
            onChange={(e) => setBankAgency(e.target.value)}
            placeholder="ex: Agence Principale Libreville"
            className="bg-secondary/50 border-border text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bank-account" className="text-xs font-medium">Numéro de Compte</Label>
          <Input
            id="bank-account"
            type="text"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="ex: 40001 02000 12345678901 25"
            className="bg-secondary/50 border-border font-mono text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bank-swift" className="text-xs font-medium">Code SWIFT / BIC</Label>
          <Input
            id="bank-swift"
            type="text"
            value={swiftCode}
            onChange={(e) => setSwiftCode(e.target.value)}
            placeholder="ex: BGFIGAXXX"
            className="bg-secondary/50 border-border font-mono uppercase text-xs"
          />
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="bank-iban" className="text-xs font-medium">IBAN / Clé RIB</Label>
          <Input
            id="bank-iban"
            type="text"
            value={iban}
            onChange={(e) => setIban(e.target.value)}
            placeholder="ex: GA21 4000 1020 0012 3456 7890 125"
            className="bg-secondary/50 border-border font-mono uppercase text-xs"
          />
        </div>
      </div>
    </div>
  );
}
