"use client";

import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui";

// `action` is a server action bound to take the record id.
export default function DeleteButton({ action, id, confirmText, iconOnly }) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function onClick() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 4000);
      return;
    }
    startTransition(() => action(id));
  }

  return (
    <Button variant={confirming ? "danger" : "secondary"} onClick={onClick} disabled={pending}>
      {pending
        ? t("common.deleting")
        : confirming
          ? t("common.confirmDelete")
          : t("common.delete")}
    </Button>
  );
}
