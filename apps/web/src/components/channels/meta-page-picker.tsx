"use client";

import { Facebook, Instagram, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MetaOAuthPage } from "@/hooks/use-meta-oauth";

interface MetaPagePickerProps {
  open: boolean;
  pages: MetaOAuthPage[];
  oauthState: string | null;
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  isConnecting: boolean;
  error?: string | null;
}

export function MetaPagePicker({
  open,
  pages,
  oauthState,
  selectedPageId,
  onSelectPage,
  onConfirm,
  onClose,
  isConnecting,
  error,
}: MetaPagePickerProps) {
  const selectedPage = pages.find((page) => page.id === selectedPageId);
  const canConnect = !!selectedPage && !!oauthState;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select a Facebook Page</DialogTitle>
          <DialogDescription>
            Choose the Page you want to connect. Messenger and Instagram DMs will use this Page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {pages.map((page) => {
            const selected = page.id === selectedPageId;
            return (
              <button
                key={page.id}
                type="button"
                onClick={() => onSelectPage(page.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                  selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "hover:bg-muted/40",
                )}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                  <Facebook className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{page.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Page ID: {page.id}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-xs">
                    <Instagram className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />
                    {page.instagramUsername ? (
                      <span className="text-muted-foreground">@{page.instagramUsername}</span>
                    ) : page.instagramAccountId ? (
                      <span className="text-muted-foreground">Instagram linked (ID: {page.instagramAccountId})</span>
                    ) : (
                      <span className="text-muted-foreground">No Instagram account linked</span>
                    )}
                  </div>
                  {!oauthState && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      OAuth session expired — reconnect Facebook to continue.
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isConnecting}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!canConnect || isConnecting}>
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect Page"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
