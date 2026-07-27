"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { generateConversationInsights } from "@/app/(app)/calls/actions";
import { addJournalTask } from "@/app/(app)/journal/actions";

const localeByLanguage = { en: "en-GB", it: "it-IT", tr: "tr-TR" };

// Merges both sides' independently-recorded speech turns (see
// CallRoomView.js's mergeFinalResultsIntoTurns / HubConnect iOS's
// CallTranscriptionManager.buildTurns) into one time-ordered conversation —
// each side only ever transcribes its own voice, never live audio, so this
// reads purely from what's already saved in Supabase.
export default function CallConversationView({ roomId, segments, insights, withNames }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const locale = localeByLanguage[i18n.language] || "tr-TR";
  const [pending, startTransition] = useTransition();
  const [genError, setGenError] = useState("");

  const speakerName = (segment) => segment.speaker?.full_name || segment.speaker?.email || t("calls.unknownAuthor");

  const mergedTranscript = useMemo(
    () => segments.map((segment) => `${speakerName(segment)}: ${segment.text}`).join("\n"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segments]
  );

  function generate() {
    setGenError("");
    startTransition(async () => {
      const result = await generateConversationInsights(roomId, mergedTranscript);
      if (result?.error === "no_api_key") setGenError(t("calls.insightsNoKey"));
      else if (result?.error) setGenError(t("calls.insightsFailed"));
      router.refresh();
    });
  }

  function addActionItemToJournal(item) {
    const formData = new FormData();
    formData.append("title", item);
    formData.append("note", withNames);
    void addJournalTask(null, formData);
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={withNames || t("calls.title")} subtitle={t("calls.conversationSubtitle")}>
        <Button href="/calls/notes" variant="secondary">{t("common.back")}</Button>
      </PageHeader>

      {segments.length === 0 ? (
        <EmptyState>{t("calls.noConversationYet")}</EmptyState>
      ) : (
        <Card className="mb-6 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{t("calls.conversation")}</h2>
          <div className="space-y-3">
            {segments.map((segment) => (
              <div key={segment.id}>
                <p className="text-xs font-semibold text-[var(--brand)]">{speakerName(segment)}</p>
                <p className="text-sm leading-6 text-zinc-200">{segment.text}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{t("calls.aiSummary")}</h2>
          {insights && <Badge color={insights.generated_platform === "ios" ? "brand" : "blue"}>{insights.generated_platform === "ios" ? "iPhone" : "OpenAI"}</Badge>}
        </div>

        {insights ? (
          <>
            {insights.summary && <p className="text-sm leading-6 text-zinc-200">{insights.summary}</p>}
            {insights.key_points?.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t("calls.keyPoints")}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
                  {insights.key_points.map((point, index) => <li key={index}>{point}</li>)}
                </ul>
              </div>
            )}
            {insights.action_items?.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-[var(--muted)]">{t("calls.actionItems")}</p>
                <ul className="space-y-2">
                  {insights.action_items.map((item, index) => (
                    <li key={index} className="flex items-center justify-between gap-3 text-sm text-zinc-200">
                      <span>{item}</span>
                      <button type="button" onClick={() => addActionItemToJournal(item)} className="shrink-0 text-xs font-semibold text-[var(--brand)] hover:underline">
                        {t("calls.addToJournal")}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : segments.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t("calls.noConversationYet")}</p>
        ) : (
          <div>
            <p className="mb-3 text-sm text-[var(--muted)]">{t("calls.insightsHint")}</p>
            <Button type="button" onClick={generate} disabled={pending}>
              {pending ? t("common.saving") : t("calls.generateInsights")}
            </Button>
            {genError && <p className="mt-2 text-sm text-red-400">{genError}</p>}
          </div>
        )}
      </Card>
    </div>
  );
}
