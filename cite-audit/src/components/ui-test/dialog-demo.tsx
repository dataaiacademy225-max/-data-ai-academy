"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Démonstration de la fenêtre de dialogue : ouverture, fermeture et action confirmée. */
export function DialogDemo() {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="accent">Ouvrir la fenêtre</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fenêtre de test</DialogTitle>
            <DialogDescription>
              Elle se ferme avec Échap, la croix, le bouton Annuler ou un clic en dehors.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button onClick={() => setConfirmed(true)}>Confirmer</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <p className="flex items-center gap-2 text-sm" role="status">
        {confirmed ? (
          <>
            <CheckCircle2Icon className="size-4 text-green-700" aria-hidden="true" />
            Action confirmée depuis la fenêtre.
          </>
        ) : (
          <span className="text-muted-foreground">Aucune action confirmée pour l&apos;instant.</span>
        )}
      </p>
    </div>
  );
}
