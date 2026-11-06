"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, Plus, Trash2, Check } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import {
  getCustomSelectOptionsAction,
  addCustomSelectOptionAction,
  removeCustomSelectOptionAction,
  type CustomSelectOptionItem,
} from "@/app/actions/custom-options.actions";
import { toast } from "sonner";

export interface SelectOptionItem {
  value: string;
  label: string;
}

interface CachedGroupOptions {
  added: SelectOptionItem[];
  hiddenValues: string[];
}

const optionsCache = new Map<string, CachedGroupOptions>();
const ongoingRequests = new Map<string, Promise<CachedGroupOptions | null>>();

async function fetchCachedGroupOptions(groupKey: string): Promise<CachedGroupOptions | null> {
  if (optionsCache.has(groupKey)) {
    return optionsCache.get(groupKey)!;
  }
  if (ongoingRequests.has(groupKey)) {
    return ongoingRequests.get(groupKey)!;
  }
  const promise = (async () => {
    try {
      const res = await getCustomSelectOptionsAction(groupKey);
      if (res.success && res.data) {
        const cached: CachedGroupOptions = {
          added: res.data.added.map((o: CustomSelectOptionItem) => ({
            value: o.value,
            label: o.label,
          })),
          hiddenValues: res.data.hiddenValues.map((v: string) => v.toLowerCase()),
        };
        optionsCache.set(groupKey, cached);
        return cached;
      }
      return null;
    } catch {
      return null;
    } finally {
      ongoingRequests.delete(groupKey);
    }
  })();
  ongoingRequests.set(groupKey, promise);
  return promise;
}

interface EditableSelectProps {
  id?: string;
  groupKey: string;
  value: string;
  onChange: (value: string) => void;
  defaultOptions: Array<string | SelectOptionItem>;
  placeholder?: string;
  addPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}

export function EditableSelect({
  id,
  groupKey,
  value,
  onChange,
  defaultOptions,
  placeholder = "Sélectionner une option...",
  addPlaceholder = "Nouvelle option...",
  className = "",
  disabled = false,
}: EditableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customOptions, setCustomOptions] = useState<SelectOptionItem[]>([]);
  const [hiddenValues, setHiddenValues] = useState<string[]>([]);
  const [newOptionText, setNewOptionText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetchCachedGroupOptions(groupKey).then((cached) => {
      if (!active || !cached) return;
      setCustomOptions(cached.added);
      setHiddenValues(cached.hiddenValues);
    });
    return () => {
      active = false;
    };
  }, [groupKey]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const normalizedDefaults: SelectOptionItem[] = useMemo(() => {
    return defaultOptions.map((opt) =>
      typeof opt === "string" ? { value: opt, label: opt } : opt
    );
  }, [defaultOptions]);

  const mergedOptions: SelectOptionItem[] = useMemo(() => {
    const map = new Map<string, SelectOptionItem>();
    for (const opt of normalizedDefaults) {
      const key = opt.value.toLowerCase();
      if (!hiddenValues.includes(key)) {
        map.set(key, opt);
      }
    }
    for (const opt of customOptions) {
      const key = opt.value.toLowerCase();
      if (!hiddenValues.includes(key)) {
        map.set(key, opt);
      }
    }
    // Si la valeur courante de l'enregistrement n'est pas dans la liste (ex: ancienne option supprimée),
    // on l'affiche quand même pour préserver l'intégrité de l'enregistrement existant.
    if (value && value.trim() !== "") {
      const currentKey = value.trim().toLowerCase();
      if (!map.has(currentKey)) {
        map.set(currentKey, { value: value.trim(), label: value.trim() });
      }
    }
    return Array.from(map.values());
  }, [normalizedDefaults, customOptions, hiddenValues, value]);

  const selectedLabel = useMemo(() => {
    if (!value) return "";
    const found = mergedOptions.find(
      (o) => o.value.toLowerCase() === value.toLowerCase()
    );
    return found ? found.label : value;
  }, [mergedOptions, value]);

  const handleAddOption = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const trimmed = newOptionText.trim();
    if (!trimmed) return;

    setIsAdding(true);
    try {
      const res = await addCustomSelectOptionAction({
        groupKey,
        value: trimmed,
        label: trimmed,
      });
      if (res.success && res.data) {
        optionsCache.delete(groupKey);
        const addedItem = { value: res.data.value, label: res.data.label };
        setCustomOptions((prev) => [
          ...prev.filter((o) => o.value.toLowerCase() !== addedItem.value.toLowerCase()),
          addedItem,
        ]);
        setHiddenValues((prev) =>
          prev.filter((v) => v !== addedItem.value.toLowerCase())
        );
        onChange(addedItem.value);
        setNewOptionText("");
        setIsOpen(false);
        toast.success(`Option « ${addedItem.label} » ajoutée`);
      } else {
        toast.error(res.error || "Impossible d'ajouter l'option");
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveOption = async (
    e: React.MouseEvent,
    optionToRemove: SelectOptionItem
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const res = await removeCustomSelectOptionAction({
      groupKey,
      value: optionToRemove.value,
    });
    if (res.success) {
      optionsCache.delete(groupKey);
      const lower = optionToRemove.value.toLowerCase();
      setHiddenValues((prev) => (prev.includes(lower) ? prev : [...prev, lower]));
      setCustomOptions((prev) =>
        prev.filter((o) => o.value.toLowerCase() !== lower)
      );
      if (value.toLowerCase() === lower) {
        const remaining = mergedOptions.filter(
          (o) => o.value.toLowerCase() !== lower
        );
        onChange(remaining[0]?.value || "");
      }
      toast.success(
        `« ${optionToRemove.label} » retiré de la liste (les éléments existants sont conservés)`
      );
    } else {
      toast.error(res.error || "Erreur lors de la suppression de l'option");
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={`truncate ${selectedLabel ? "text-foreground" : "text-muted-foreground"}`}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground opacity-70" />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 w-full min-w-[230px] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg animate-in fade-in-0 zoom-in-95">
          <div className="max-h-52 overflow-y-auto p-1">
            {mergedOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Aucune option disponible. Ajoutez-en une ci-dessous.
              </div>
            ) : (
              mergedOptions.map((opt) => {
                const isSelected =
                  value.toLowerCase() === opt.value.toLowerCase();
                return (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`group flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                      isSelected
                        ? "bg-primary/10 font-medium text-primary"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <Check
                        className={`h-3.5 w-3.5 shrink-0 ${
                          isSelected ? "opacity-100 text-primary" : "opacity-0"
                        }`}
                      />
                      <span className="truncate">{opt.label}</span>
                    </div>
                    <button
                      type="button"
                      title="Retirer de la liste (n'affecte pas les éléments existants)"
                      onClick={(e) => handleRemoveOption(e, opt)}
                      className="ml-2 rounded p-1 text-muted-foreground/60 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-border bg-muted/30 p-2">
            <div className="flex items-center gap-1.5">
              <Input
                value={newOptionText}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewOptionText(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    handleAddOption();
                  }
                }}
                placeholder={addPlaceholder}
                className="h-8 text-xs bg-background"
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!newOptionText.trim() || isAdding}
                onClick={handleAddOption}
                className="h-8 shrink-0 px-2.5 text-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Ajouter
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
