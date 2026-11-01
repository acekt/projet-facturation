"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card";
import { Button } from "@workspace/ui/components/button";
import { 
  DownloadCloud, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Laptop, 
  HardDrive 
} from "lucide-react";
import type { IUpdateStatusPayload, IUpdateProgressPayload } from "@/types/electron";
import { getErrorMessage } from "@/lib/utils/action-error";
import { toast } from "sonner";

export function UpdateManager() {
  const [appVersion, setAppVersion] = React.useState<string>("1.0.0");
  const [userDataPath, setUserDataPath] = React.useState<string>("");
  const [isElectron, setIsElectron] = React.useState<boolean>(false);
  const [status, setStatus] = React.useState<
    'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  >('idle');
  const [updateInfo, setUpdateInfo] = React.useState<{ version?: string; releaseNotes?: string | null } | null>(null);
  const [progress, setProgress] = React.useState<number>(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.electron) {
      setIsElectron(true);
      window.electron.getVersion().then(setAppVersion).catch(() => {});
      window.electron.getUserDataPath().then(setUserDataPath).catch(() => {});

      if (window.electron.updater) {
        const unsubStatus = window.electron.updater.onStatus((data: IUpdateStatusPayload) => {
          if (data.status === 'checking') {
            setStatus('checking');
            setErrorMessage(null);
          } else if (data.status === 'available') {
            setStatus('available');
            setUpdateInfo({ version: data.version, releaseNotes: data.releaseNotes });
          } else if (data.status === 'not-available') {
            setStatus('not-available');
          } else if (data.status === 'downloaded') {
            setStatus('downloaded');
            setProgress(100);
          } else if (data.status === 'error') {
            setStatus('error');
            setErrorMessage(data.error || "Une erreur est survenue lors de la vérification");
          }
        });

        const unsubProgress = window.electron.updater.onProgress((data: IUpdateProgressPayload) => {
          setStatus('downloading');
          setProgress(Math.round(data.percent));
        });

        return () => {
          unsubStatus();
          unsubProgress();
        };
      }
    }
  }, []);

  const handleCheckForUpdates = async () => {
    if (!window.electron?.updater) {
      setStatus('not-available');
      return;
    }

    setStatus('checking');
    setErrorMessage(null);
    try {
      const res = await window.electron.updater.check();
      if (!res.success && res.error) {
        setStatus('error');
        setErrorMessage(res.error);
      } else if (res.isDev) {
        setStatus('not-available');
      }
    } catch (e: unknown) {
      setStatus('error');
      setErrorMessage(getErrorMessage(e, "Échec de connexion au serveur de mises à jour"));
    }
  };

  const handleDownload = async () => {
    if (!window.electron?.updater) return;
    setStatus('downloading');
    setProgress(0);
    try {
      await window.electron.updater.download();
    } catch (e: unknown) {
      setStatus('error');
      setErrorMessage(getErrorMessage(e, "Échec du téléchargement"));
    }
  };

  const handleInstall = async () => {
    if (!window.electron?.updater) return;
    try {
      await window.electron.updater.install();
    } catch (e: unknown) {
      setStatus('error');
      const msg = getErrorMessage(e, "Impossible de relancer l'application");
      setErrorMessage(msg);
      toast.error(`Erreur d'installation : ${msg}`);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center gap-2">
          <DownloadCloud className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Mises à jour & Maintenance</CardTitle>
        </div>
        <CardDescription>
          Canal de distribution certifié et gestion du cycle de vie du logiciel
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Informations système */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-secondary border border-border">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Laptop className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Version installée</p>
              <p className="text-sm font-bold text-foreground">v{appVersion}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-secondary border border-border">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <HardDrive className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground font-medium">Stockage local (SQLite)</p>
              <p className="text-xs font-mono text-foreground truncate" title={userDataPath || "AppData"}>
                {userDataPath || "AppData/Roaming/Facturier"}
              </p>
            </div>
          </div>
        </div>

        {/* État de la mise à jour */}
        <div className="p-4 rounded-xl border border-border bg-card space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Canal de mise à jour officiel</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                  Stable
                </span>
              </h4>
              <p className="text-xs text-muted-foreground">
                Distribution sécurisée signée avec installateur NSIS pour Windows x64.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCheckForUpdates}
              disabled={status === 'checking' || status === 'downloading'}
              className="gap-2 shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${status === 'checking' ? 'animate-spin' : ''}`} />
              <span>{status === 'checking' ? 'Vérification...' : 'Vérifier maintenant'}</span>
            </Button>
          </div>

          {/* Feedback dynamique selon le statut */}
          {status === 'not-available' && (
            <div className="flex items-center gap-2 text-xs font-medium text-foreground bg-secondary/80 p-3 rounded-lg border border-border">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>Vous disposez de la version la plus récente de Facturier (v{appVersion}).</span>
            </div>
          )}

          {status === 'available' && updateInfo && (
            <div className="space-y-3 p-3.5 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    Nouvelle version disponible : v{updateInfo.version}
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={handleDownload}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-8 text-xs cursor-pointer"
                >
                  <DownloadCloud className="w-3.5 h-3.5" />
                  <span>Télécharger</span>
                </Button>
              </div>
              {updateInfo.releaseNotes && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {updateInfo.releaseNotes}
                </p>
              )}
            </div>
          )}

          {status === 'downloading' && (
            <div className="space-y-2 p-3.5 rounded-lg bg-secondary border border-border">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-foreground">Téléchargement de la mise à jour...</span>
                <span className="text-primary font-bold">{progress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary h-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {status === 'downloaded' && (
            <div className="flex items-center justify-between gap-4 p-3.5 rounded-lg bg-primary/10 border border-primary/30">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span>Mise à jour prête. Redémarrez l'application pour finaliser l'installation.</span>
              </div>
              <Button
                size="sm"
                onClick={handleInstall}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-8 text-xs shrink-0 cursor-pointer"
              >
                <span>Redémarrer et Installer</span>
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage || "Impossible de contacter le serveur de mise à jour."}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
