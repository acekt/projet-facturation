"use server";

import { getSession } from "@/lib/api/auth";
import { resolveActiveTenantId } from "@/lib/api/tenant";
import db from "@/lib/db";
import { customSelectOptionSchema } from "@/lib/validations";
import type { ActionResponse } from "@/lib/types/api";
import crypto from "crypto";

export interface CustomSelectOptionItem {
  id: string;
  groupKey: string;
  value: string;
  label: string;
}

/**
 * Récupère les options personnalisées actives et les options masquées (isDeleted=1) pour un groupKey donné.
 */
export async function getCustomSelectOptionsAction(
  groupKey: string
): Promise<ActionResponse<{ added: CustomSelectOptionItem[]; hiddenValues: string[] }>> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: true, data: { added: [], hiddenValues: [] } };
    }
    const tenantId = resolveActiveTenantId(session.userId, session.tenantId);

    const rows = db
      .prepare(
        `SELECT id, groupKey, value, label, isDeleted
         FROM custom_select_options
         WHERE tenant_id = ? AND groupKey = ?
         ORDER BY createdAt ASC`
      )
      .all(tenantId, groupKey) as Array<{
      id: string;
      groupKey: string;
      value: string;
      label: string;
      isDeleted: number;
    }>;

    const added = rows
      .filter((r) => !r.isDeleted)
      .map((r) => ({
        id: r.id,
        groupKey: r.groupKey,
        value: r.value,
        label: r.label,
      }));

    const hiddenValues = rows.filter((r) => r.isDeleted === 1).map((r) => r.value);

    return {
      success: true,
      data: { added, hiddenValues },
    };
  } catch (error) {
    console.error("[getCustomSelectOptionsAction] Error:", error);
    return {
      success: true,
      data: { added: [], hiddenValues: [] },
    };
  }
}

/**
 * Ajoute (ou réactive) une option dans la liste déroulante d'un groupKey.
 */
export async function addCustomSelectOptionAction(input: {
  groupKey: string;
  value: string;
  label?: string;
}): Promise<ActionResponse<CustomSelectOptionItem>> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Non autorisé" };
    }

    const parsed = customSelectOptionSchema.safeParse({
      groupKey: input.groupKey,
      value: input.value.trim(),
      label: (input.label || input.value).trim(),
    });
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Option invalide",
      };
    }

    const tenantId = resolveActiveTenantId(session.userId, session.tenantId);
    const { groupKey, value } = parsed.data;
    const label = parsed.data.label || value;

    const existing = db
      .prepare(
        `SELECT id FROM custom_select_options WHERE tenant_id = ? AND groupKey = ? AND lower(value) = lower(?)`
      )
      .get(tenantId, groupKey, value) as { id: string } | undefined;

    if (existing) {
      db.prepare(
        `UPDATE custom_select_options SET isDeleted = 0, value = ?, label = ? WHERE id = ?`
      ).run(value, label, existing.id);
      return {
        success: true,
        data: { id: existing.id, groupKey, value, label },
      };
    }

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO custom_select_options (id, tenant_id, groupKey, value, label, isDeleted, createdAt)
       VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`
    ).run(id, tenantId, groupKey, value, label);

    return {
      success: true,
      data: { id, groupKey, value, label },
    };
  } catch (error) {
    console.error("[addCustomSelectOptionAction] Error:", error);
    return {
      success: false,
      error: "Impossible d'ajouter cette option",
    };
  }
}

/**
 * Supprime (masque) une option de la liste déroulante future SANS modifier ni supprimer
 * aucun enregistrement existant (Garantie Zéro Cascade).
 */
export async function removeCustomSelectOptionAction(input: {
  groupKey: string;
  value: string;
}): Promise<ActionResponse<{ removedValue: string }>> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Non autorisé" };
    }

    const groupKey = input.groupKey?.trim();
    const value = input.value?.trim();
    if (!groupKey || !value) {
      return { success: false, error: "Option invalide" };
    }

    const tenantId = resolveActiveTenantId(session.userId, session.tenantId);

    const existing = db
      .prepare(
        `SELECT id FROM custom_select_options WHERE tenant_id = ? AND groupKey = ? AND lower(value) = lower(?)`
      )
      .get(tenantId, groupKey, value) as { id: string } | undefined;

    if (existing) {
      db.prepare(`UPDATE custom_select_options SET isDeleted = 1 WHERE id = ?`).run(existing.id);
    } else {
      const id = crypto.randomUUID();
      db.prepare(
        `INSERT INTO custom_select_options (id, tenant_id, groupKey, value, label, isDeleted, createdAt)
         VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`
      ).run(id, tenantId, groupKey, value, value);
    }

    return {
      success: true,
      data: { removedValue: value },
    };
  } catch (error) {
    console.error("[removeCustomSelectOptionAction] Error:", error);
    return {
      success: false,
      error: "Impossible de retirer cette option de la liste",
    };
  }
}
