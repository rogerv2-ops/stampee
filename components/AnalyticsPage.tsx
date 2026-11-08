import React, { useMemo, useState } from "react";
import { useI18n } from "../lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Customer, IssuedCard, Template, Transaction } from "../types";
import { resolveCardTemplate } from "../lib/templateSerialization";
import {
  Activity,
  BadgeCheck,
  CalendarDays,
  CreditCard,
  Sparkles,
  Users,
  TrendingUp
} from "lucide-react";

interface AnalyticsPageProps {
  customers: Customer[];
  campaigns: Template[];
}

type ActivityBucket = {
  label: string;
  stampAdds: number;
  redemptions: number;
  total: number;
};

type CampaignStatsGroup = {
  id: string;
  name: string;
  totalStamps: number | null;
  issuedCards: IssuedCard[];
  archived: boolean;
};

const DEFAULT_DAY_COUNT = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const formatNumber = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);

const formatPercent = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateInputToTimestamp = (value: string, endOfDay = false) => {
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!year || !month || !day) return null;
  const date = new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0
  );
  return date.getTime();
};

const getDateKey = (date: Date) =>
  `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

const isTimestampInRange = (timestamp: number | undefined, start: number, end: number) =>
  typeof timestamp === "number" && timestamp >= start && timestamp <= end;

const formatDateRangeLabel = (startDate: string, endDate: string, t: (source: string, vars?: Record<string, string | number>) => string, locale: string) => {
  const start = parseDateInputToTimestamp(startDate);
  const end = parseDateInputToTimestamp(endDate);
  if (start === null || end === null) return t("Custom range");
  const startLabel = new Date(start).toLocaleDateString(locale, { month: "short", day: "numeric" });
  const endLabel = new Date(end).toLocaleDateString(locale, { month: "short", day: "numeric" });
  return `${startLabel} - ${endLabel}`;
};

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ customers, campaigns }) => {
  const { t, language, locale } = useI18n();
  const [startDate, setStartDate] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - (DEFAULT_DAY_COUNT - 1));
    return toDateInputValue(start);
  });
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()));

  const { rangeStart, rangeEnd } = useMemo(() => {
    const now = new Date();
    const fallbackEnd = new Date(now);
    fallbackEnd.setHours(23, 59, 59, 999);
    const fallbackStart = new Date(now);
    fallbackStart.setDate(fallbackStart.getDate() - (DEFAULT_DAY_COUNT - 1));
    fallbackStart.setHours(0, 0, 0, 0);

    let nextStart = parseDateInputToTimestamp(startDate) ?? fallbackStart.getTime();
    let nextEnd = parseDateInputToTimestamp(endDate, true) ?? fallbackEnd.getTime();
    if (nextStart > nextEnd) {
      const swap = nextStart;
      nextStart = nextEnd;
      nextEnd = swap;
    }

    return { rangeStart: nextStart, rangeEnd: nextEnd };
  }, [startDate, endDate]);

  const applyPresetRange = (dayCount: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (dayCount - 1));
    setStartDate(toDateInputValue(start));
    setEndDate(toDateInputValue(end));
  };

  const selectedDayCount = useMemo(() => {
    const start = new Date(rangeStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(rangeEnd);
    end.setHours(0, 0, 0, 0);
    return Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1;
  }, [rangeStart, rangeEnd]);

  const rangeLabel = useMemo(() => formatDateRangeLabel(startDate, endDate, t, locale), [startDate, endDate]);
  const allCards = useMemo(() => customers.flatMap((c) => c.cards), [customers]);
  const filteredCards = useMemo(() => {
    return allCards.filter((card) =>
      (card.history || []).some((tx) => isTimestampInRange(tx.timestamp, rangeStart, rangeEnd))
    );
  }, [allCards, rangeStart, rangeEnd]);

  const filteredCustomerCount = useMemo(() => {
    return customers.filter((customer) =>
      customer.cards.some((card) =>
        (card.history || []).some((tx) => isTimestampInRange(tx.timestamp, rangeStart, rangeEnd))
      )
    ).length;
  }, [customers, rangeStart, rangeEnd]);

  const totals = useMemo(() => {
    const issued = filteredCards.length;
    const active = filteredCards.filter((card) => card.status === "Active");
    const redeemed = filteredCards.filter((card) => card.status === "Redeemed");
    const redemptionRate = issued > 0 ? (redeemed.length / issued) * 100 : 0;

    const avgStamps =
      active.length > 0
        ? active.reduce((sum, card) => sum + (card.stamps || 0), 0) / active.length
        : 0;

    const readyToRedeem = active.filter((card) => {
      const template = resolveCardTemplate(card, campaigns);
      if (!template) return false;
      return card.stamps >= template.totalStamps;
    }).length;

    return {
      issued,
      active: active.length,
      redeemed: redeemed.length,
      redemptionRate,
      avgStamps,
      readyToRedeem
    };
  }, [filteredCards, campaigns]);

  const activityBuckets = useMemo(() => {
    const start = new Date(rangeStart);
    start.setHours(0, 0, 0, 0);
    const end = new Date(rangeEnd);
    end.setHours(0, 0, 0, 0);
    const days: ActivityBucket[] = [];

    const daySpan = Math.max(0, Math.floor((end.getTime() - start.getTime()) / DAY_MS));
    for (let i = 0; i <= daySpan; i += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push({
        label: date.toLocaleDateString(locale, { month: "short", day: "numeric" }),
        stampAdds: 0,
        redemptions: 0,
        total: 0
      });
    }

    const bucketByKey = new Map<string, ActivityBucket>();
    days.forEach((bucket, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      bucketByKey.set(getDateKey(date), bucket);
    });

    allCards.forEach((card) => {
      (card.history || []).forEach((tx: Transaction) => {
        if (!isTimestampInRange(tx.timestamp, rangeStart, rangeEnd)) return;
        const txDate = new Date(tx.timestamp);
        const key = getDateKey(txDate);
        const bucket = bucketByKey.get(key);
        if (!bucket) return;
        if (tx.type === "stamp_add") bucket.stampAdds += tx.amount || 1;
        if (tx.type === "redeem") bucket.redemptions += 1;
        bucket.total += 1;
      });
    });

    return days;
  }, [allCards, rangeStart, rangeEnd]);

  const progressDistribution = useMemo(() => {
    const buckets = {
      zero: 0,
      low: 0,
      mid: 0,
      full: 0
    };

    filteredCards
      .filter((card) => card.status === "Active")
      .forEach((card) => {
        const template = resolveCardTemplate(card, campaigns);
        if (!template || template.totalStamps === 0) return;
        const ratio = card.stamps / template.totalStamps;
        if (ratio <= 0) buckets.zero += 1;
        else if (ratio < 0.5) buckets.low += 1;
        else if (ratio < 1) buckets.mid += 1;
        else buckets.full += 1;
      });

    return buckets;
  }, [filteredCards, campaigns]);

  const campaignStats = useMemo(() => {
    const groups = new Map<string, CampaignStatsGroup>();

    campaigns.forEach((campaign) => {
      groups.set(campaign.id, {
        id: campaign.id,
        name: campaign.name,
        totalStamps: campaign.totalStamps,
        issuedCards: [],
        archived: false,
      });
    });

    filteredCards.forEach((card) => {
      const liveCampaign = card.campaignId ? campaigns.find((campaign) => campaign.id === card.campaignId) : undefined;
      const template = resolveCardTemplate(card, campaigns);
      const groupId = liveCampaign
        ? liveCampaign.id
        : `deleted:${card.campaignName}:${template?.totalStamps ?? 'unknown'}`;
      const existingGroup = groups.get(groupId);

      if (existingGroup) {
        existingGroup.issuedCards.push(card);
        if (existingGroup.totalStamps === null && template) {
          existingGroup.totalStamps = template.totalStamps;
        }
        return;
      }

      groups.set(groupId, {
        id: groupId,
        name: card.campaignName || template?.name || "Archived campaign",
        totalStamps: template?.totalStamps ?? null,
        issuedCards: [card],
        archived: true,
      });
    });

    return Array.from(groups.values()).map((campaign) => {
      const cards = campaign.issuedCards;
      const active = cards.filter((card) => card.status === "Active");
      const redeemed = cards.filter((card) => card.status === "Redeemed");
      const avgStamps =
        active.length > 0
          ? active.reduce((sum, card) => sum + card.stamps, 0) / active.length
          : 0;
      const completionRate = cards.length > 0 ? (redeemed.length / cards.length) * 100 : 0;
      const readyToRedeem = active.filter((card) => {
        const template = resolveCardTemplate(card, campaigns);
        return template ? card.stamps >= template.totalStamps : false;
      }).length;

      return {
        id: campaign.id,
        name: campaign.name,
        totalStamps: campaign.totalStamps,
        archived: campaign.archived,
        issued: cards.length,
        active: active.length,
        redeemed: redeemed.length,
        avgStamps,
        completionRate,
        readyToRedeem
      };
    });
  }, [campaigns, filteredCards]);

  const maxActivity = Math.max(
    1,
    ...activityBuckets.map((bucket) => bucket.stampAdds + bucket.redemptions)
  );

  const distributionTotal =
    progressDistribution.zero +
    progressDistribution.low +
    progressDistribution.mid +
    progressDistribution.full;

  const distributionWidth = (value: number) =>
    distributionTotal === 0 ? 0 : (value / distributionTotal) * 100;

  return (
    <div className="h-full overflow-y-auto flex flex-col space-y-8 bg-background p-6 md:p-8 animate-fade-in">
      <div className="flex flex-col gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-4xl font-semibold tracking-tight text-foreground">{t("Analytics")}</h1>
          <p className="text-sm text-muted-foreground md:text-base">
            {t("A quick pulse check on loyalty performance and customer activity.")}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/80 bg-card p-3 shadow-subtle">
          <div className="flex items-center gap-2 pr-1 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
            {t("Date range")}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("From")}</label>
            <Input
              type="date"
              className="h-10 w-[160px]"
              value={startDate}
              onChange={(event) => {
                const value = event.target.value;
                setStartDate(value);
                if (value > endDate) setEndDate(value);
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("To")}</label>
            <Input
              type="date"
              className="h-10 w-[160px]"
              value={endDate}
              onChange={(event) => {
                const value = event.target.value;
                setEndDate(value);
                if (value < startDate) setStartDate(value);
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => applyPresetRange(7)}>
              7D
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => applyPresetRange(14)}>
              14D
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => applyPresetRange(30)}>
              30D
            </Button>
          </div>
          <Badge variant="outline" className="border-border/80 bg-card text-muted-foreground shadow-subtle">
            {rangeLabel}
          </Badge>
          <Badge variant="secondary" className="text-muted-foreground">
            {Math.max(0, selectedDayCount)} {t("days")}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border-border/80 bg-card shadow-subtle">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("Total Customers")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{formatNumber(filteredCustomerCount)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{t("Customers with activity in selected range")}</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card shadow-subtle">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("Cards With Activity")}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{formatNumber(totals.issued)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatNumber(totals.active)} {t("active")} | {formatNumber(totals.redeemed)} {t("redeemed in range")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card shadow-subtle">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("Redemption Rate")}</CardTitle>
            <BadgeCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{formatPercent(totals.redemptionRate)}%</div>
            <p className="mt-1 text-xs text-muted-foreground">{t("Completed cycles in selected range")}</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card shadow-subtle">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("Avg Stamps (Active)")}</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{formatPercent(totals.avgStamps)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{t("Momentum across active cards")}</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card shadow-subtle">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("Ready To Redeem")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{formatNumber(totals.readyToRedeem)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{t("Cards that hit the reward threshold")}</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card shadow-subtle">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("Active Cards")}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tracking-tight">{formatNumber(totals.active)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{t("Currently collecting stamps in selected range")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2 border-border/80 bg-card shadow-subtle">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t("Activity Over Time")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("Stamp adds and redemptions combined.")}</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-56 rounded-lg border border-border/70 bg-muted/30 px-3 pb-3 pt-5">
              <div className="flex h-full items-end gap-2">
                {activityBuckets.map((bucket, index) => {
                  const height = Math.round(((bucket.stampAdds + bucket.redemptions) / maxActivity) * 100);
                  const isLast = index === activityBuckets.length - 1;
                  return (
                    <div key={`${bucket.label}-${index}`} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex h-full w-full items-end">
                        <div
                          className={`w-full rounded-md transition-all duration-200 ${
                            isLast ? "bg-foreground/80" : "bg-foreground/25"
                          }`}
                          style={{ height: `${Math.max(10, height)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{bucket.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-foreground/25" />
                {t("Activity")}
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-foreground/80" />
                {t("Most recent day")}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card shadow-subtle">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t("Progress Distribution")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("Active cards by completion.")}</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/70">
              <div
                className="h-full bg-foreground/15"
                style={{ width: `${distributionWidth(progressDistribution.zero)}%` }}
              />
              <div
                className="h-full bg-foreground/28"
                style={{ width: `${distributionWidth(progressDistribution.low)}%` }}
              />
              <div
                className="h-full bg-foreground/45"
                style={{ width: `${distributionWidth(progressDistribution.mid)}%` }}
              />
              <div
                className="h-full bg-foreground/70"
                style={{ width: `${distributionWidth(progressDistribution.full)}%` }}
              />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">0%</span>
                <span className="font-medium">{formatNumber(progressDistribution.zero)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">1-49%</span>
                <span className="font-medium">{formatNumber(progressDistribution.low)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">50-99%</span>
                <span className="font-medium">{formatNumber(progressDistribution.mid)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t("Completed")}</span>
                <span className="font-medium">{formatNumber(progressDistribution.full)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card shadow-subtle">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{t("Campaign Performance")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("Snapshot of active momentum by campaign.")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {campaignStats.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("No campaigns found.")}</div>
          ) : (
            campaignStats.map((campaign) => (
              <div key={campaign.id} className="rounded-lg border border-border/80 bg-background px-4 py-4 shadow-subtle">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-foreground">{campaign.name}</div>
                      {campaign.archived && <Badge variant="outline">{t("Archived")}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {campaign.issued} {t("issued")} | {campaign.active} {t("active")} | {campaign.redeemed} {t("redeemed")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md border border-border/80 bg-card px-2 py-1">
                      {t("Avg stamps")} {formatPercent(campaign.avgStamps)}
                    </span>
                    <span className="rounded-md border border-border/80 bg-card px-2 py-1">
                      {formatPercent(campaign.completionRate)}% {t("redeemed")}
                    </span>
                  </div>
                </div>
                  <div className="mt-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("Ready to redeem:")} {campaign.readyToRedeem}</span>
                    <span>{campaign.totalStamps === null ? t("Reward threshold unavailable") : `\${campaign.totalStamps} ${t("stamps to reward")}`}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted/70">
                    <div
                      className="h-full bg-foreground/70"
                      style={{ width: `${Math.min(100, campaign.completionRate)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
