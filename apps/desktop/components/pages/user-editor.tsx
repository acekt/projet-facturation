"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, User, Lock, Key } from "lucide-react";
import { getUsers, createUser, updateUser as updateUserService } from "@/app/actions/user.actions";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { userCreateSchema, userUpdateSchema } from "@/lib/validations";
import { UserSummaryCard } from "@/components/editor/UserSummaryCard";
import { UserRoleSelector } from "@/components/editor/UserRoleSelector";
import { PasswordStrengthIndicator } from "@/components/editor/PasswordStrengthIndicator";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";

interface UserEditorProps {
  onBack: () => void;
  editingId?: string | null;
}

export function UserEditor({ onBack, editingId }: UserEditorProps) {
  const currentUser = useStore((s) => s.user);
  const setUsers = useStore((s) => s.setUsers);
  const [isLoading, setIsLoading] = React.useState(!!editingId);
  const [isSubmitting, startSubmitTransition] = React.useTransition();
  const [showPassword, setShowPassword] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  const [formData, setFormData] = React.useState({
    name: "",
    email: "",
    phone: "",
    role: "user" as "admin" | "user",
    password: "",
    force_password_change: true,
    is_active: true,
  });

  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const fetchUser = React.useCallback(async () => {
    try {
      const res = await getUsers();
      if (res.success && res.data) {
        const user = res.data.find((u) => u.id === editingId);
        if (user) {
          setFormData({
            name: user.name,
            email: user.email,
            phone: user.phone || "",
            role: user.role,
            password: "",
            force_password_change: Boolean(user.force_password_change),
            is_active: user.is_active === 1,
          });
        }
      } else {
        toast.error(res.error || "Erreur lors du chargement de l'utilisateur");
        onBack();
      }
    } catch {
      toast.error("Erreur lors du chargement de l'utilisateur");
      onBack();
    } finally {
      setIsLoading(false);
    }
  }, [editingId, onBack]);

  React.useEffect(() => {
    if (editingId) {
      fetchUser();
    }
  }, [editingId, fetchUser]);

  const isDirty = React.useMemo(() => {
    if (editingId) {
      return !!(formData.name || formData.phone || formData.password);
    }
    return !!(formData.name || formData.email || formData.password);
  }, [editingId, formData.name, formData.email, formData.phone, formData.password]);

  const { guardNavigation } = useUnsavedChangesGuard({ isDirty });

  const handleBackSafe = () => {
    guardNavigation(onBack);
  };

  useKeyboardShortcuts({
    onSave: () => {
      formRef.current?.requestSubmit();
    },
    onEscape: handleBackSafe,
  });

  const validateForm = () => {
    const schema = editingId ? userUpdateSchema : userCreateSchema;
    const dataToValidate = editingId
      ? {
          ...formData,
          email: formData.email && formData.email !== "" ? formData.email : undefined,
        }
      : { ...formData, username: formData.email };

    const result = schema.safeParse(dataToValidate);

    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      const firstError = result.error.errors[0]?.message || "Veuillez corriger les erreurs du formulaire";
      toast.error(firstError);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    startSubmitTransition(async () => {
      try {
        const payload = editingId
          ? {
              name: formData.name,
              ...(formData.email && formData.email !== "" ? { email: formData.email, username: formData.email } : {}),
              phone: formData.phone || null,
              role: formData.role,
              ...(formData.password && formData.password !== ""
                ? { password: formData.password, force_password_change: true }
                : {}),
              is_active: formData.is_active,
            }
          : {
              username: formData.email,
              name: formData.name,
              email: formData.email,
              phone: formData.phone || null,
              role: formData.role,
              password: formData.password,
              force_password_change: formData.force_password_change,
              is_active: formData.is_active,
            };

        const res = editingId ? await updateUserService(editingId, payload) : await createUser(payload);

        if (res.success) {
          const refreshed = await getUsers();
          if (refreshed.success && refreshed.data) {
            setUsers(refreshed.data);
          }
          toast.success(editingId ? "Utilisateur mis à jour" : "Utilisateur créé avec succès");
          onBack();
        } else {
          toast.error(res.error || "Erreur lors de l'opération");
        }
      } catch (err) {
        console.error("[UserEditor] handleSubmit error:", err);
        toast.error("Erreur réseau");
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground text-sm font-medium">Chargement du profil...</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-6"
    >
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={handleBackSafe} className="cursor-pointer">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {editingId ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {editingId
              ? "Mettez à jour les informations et les droits d'accès du collaborateur"
              : "Créez un nouvel accès sécurisé pour un membre de votre équipe"}
          </p>
        </div>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* INFORMATIONS PERSONNELLES */}
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground font-semibold text-base flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Identité & Coordonnées
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium">
                    Nom complet <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Jean Paul Ndong"
                    className="bg-secondary/60 border-border text-foreground text-sm h-10"
                  />
                  {errors.name && <p className="text-destructive text-xs font-medium">{errors.name}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium">
                      Adresse Email (Identifiant de connexion) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email || ""}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="jean.ndong@entreprise.ga"
                      className="bg-secondary/60 border-border text-foreground text-sm h-10"
                      disabled={!!editingId}
                    />
                    {errors.email && <p className="text-destructive text-xs font-medium">{errors.email}</p>}
                    {editingId && !errors.email && (
                      <p className="text-[11px] text-muted-foreground">L&apos;identifiant email ne peut pas être modifié</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-medium">
                      Numéro de téléphone
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone || ""}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+241 74 00 00 00"
                      className="bg-secondary/60 border-border text-foreground text-sm h-10"
                    />
                    {errors.phone && <p className="text-destructive text-xs font-medium">{errors.phone}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SÉLECTION VISUELLE DE RÔLE & STATUT */}
            <Card className="bg-card border-border shadow-sm">
              <CardContent className="p-4 sm:p-5 space-y-4">
                <UserRoleSelector
                  value={formData.role}
                  onChange={(val) => setFormData({ ...formData, role: val })}
                  disabled={editingId === currentUser?.id}
                  disabledMessage="Vous ne pouvez pas modifier votre propre rôle"
                  error={errors.role}
                />

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/40 border border-border mt-4">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold text-foreground">Autorisation de connexion (Compte actif)</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Désactivez cette option pour suspendre temporairement l&apos;accès du collaborateur sans supprimer son historique.
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    disabled={editingId === currentUser?.id}
                  />
                </div>
              </CardContent>
            </Card>

            {/* SÉCURITÉ & MOT DE PASSE */}
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-foreground font-semibold text-base flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary" />
                  Sécurité & Authentification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-medium">
                    {editingId ? "Nouveau mot de passe (Laisser vide pour conserver l'actuel)" : "Mot de passe provisoire *"}{" "}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password || ""}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder={editingId ? "Conserver le mot de passe actuel" : "Ex: Passw0rd2026!"}
                      className="bg-secondary/60 border-border text-foreground pr-10 text-sm h-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground cursor-pointer"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <Lock className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                    </Button>
                  </div>

                  <PasswordStrengthIndicator password={formData.password} isOptional={!!editingId} />
                  {errors.password && <p className="text-destructive text-xs font-medium">{errors.password}</p>}
                </div>

                {!editingId && (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary/40 border border-border mt-3">
                    <div className="space-y-0.5">
                      <Label className="text-xs font-semibold text-foreground">
                        Exiger le renouvellement du mot de passe
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        Recommandé : Le collaborateur devra obligatoirement définir son propre mot de passe confidentiel lors de son premier accès.
                      </p>
                    </div>
                    <Switch
                      checked={formData.force_password_change}
                      onCheckedChange={(checked) => setFormData({ ...formData, force_password_change: checked })}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RÉCAPITULATIF FLOTTANT */}
          <div className="space-y-6">
            <UserSummaryCard
              name={formData.name}
              email={formData.email}
              role={formData.role}
              isActive={formData.is_active}
              isSubmitting={isSubmitting}
              isEditing={!!editingId}
            />
          </div>
        </div>
      </form>
    </motion.div>
  );
}
