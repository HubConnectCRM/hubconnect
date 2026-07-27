"use client";

import { useTranslation } from "react-i18next";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export default function NotificationsView() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("notifications.title")} subtitle={t("notifications.subtitle")} />
      <Card className="p-5">
        <EmptyState>{t("notifications.empty")}</EmptyState>
      </Card>
    </div>
  );
}
