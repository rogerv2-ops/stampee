import React from "react";
import { Crown, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { TIER_LIMITS } from "../types";
import { SALES_EMAIL } from "../lib/siteConfig";
import { useI18n } from "../lib/i18n";

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: "campaign" | "card" | "staff";
  currentUsage?: { campaigns: number; cards: number; staff?: number };
}

const buildSubject = (reason?: UpgradePromptProps["reason"]) => {
  switch (reason) {
    case "campaign":
      return "Stampee beta campaign limits";
    case "card":
      return "Stampee beta issued card limits";
    case "staff":
      return "Stampee beta staff limits";
    default:
      return "Stampee beta access";
  }
};

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  open,
  onOpenChange,
  reason,
  currentUsage,
}) => {
  const { t } = useI18n();
  const limits = TIER_LIMITS.free;
  const subject = encodeURIComponent(t(buildSubject(reason)));
  const mailtoHref = `mailto:${SALES_EMAIL}?subject=${subject}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md">
              <Crown className="h-5 w-5 text-white" />
            </div>
            <DialogTitle className="text-xl">{t("Beta access limit reached")}</DialogTitle>
          </div>
          <DialogDescription>
            {reason === "campaign"
              ? t("You have reached the current beta limit of {count} campaigns.", { count: limits.campaigns })
              : reason === "card"
                ? t("You have reached the current beta limit of {count} issued cards.", { count: limits.issuedCards })
                : reason === "staff"
                  ? t("You have reached the current beta limit of {count} staff account.", { count: limits.staff })
                  : t("This beta account has reached its current usage limit.")}
          </DialogDescription>
        </DialogHeader>

        {currentUsage && (
          <div className={`mt-2 grid gap-3 ${currentUsage.staff !== undefined ? "grid-cols-3" : "grid-cols-2"}`}>
            <div className="rounded-xl border bg-muted/30 p-3 text-center">
              <div className="text-2xl font-bold">
                {currentUsage.campaigns}
                <span className="text-sm font-normal text-muted-foreground">/{limits.campaigns}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{t("Campaigns")}</div>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3 text-center">
              <div className="text-2xl font-bold">
                {currentUsage.cards}
                <span className="text-sm font-normal text-muted-foreground">/{limits.issuedCards}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">{t("Issued Cards")}</div>
            </div>
            {currentUsage.staff !== undefined && (
              <div className="rounded-xl border bg-muted/30 p-3 text-center">
                <div className="text-2xl font-bold">
                  {currentUsage.staff}
                  <span className="text-sm font-normal text-muted-foreground">/{limits.staff}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t("Staff")}</div>
              </div>
            )}
          </div>
        )}

        <div className="mt-2 space-y-4 rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-orange-50 p-5">
          <div>
            <div className="text-lg font-bold text-foreground">{t("Founder-assisted beta")}</div>
            <div className="text-sm text-muted-foreground">
              {t("Need higher limits for your business? Reach out and we can expand your beta access manually.")}
            </div>
          </div>
          <ul className="space-y-2 text-sm text-foreground">
            <li>{t("Manual review for higher campaign, card, or staff limits")}</li>
            <li>{t("Priority onboarding for local SMB beta users")}</li>
            <li>{t("Direct contact with the founder during the beta")}</li>
          </ul>
        </div>

        <DialogFooter className="mt-2 flex-col gap-2 sm:flex-col">
          <Button asChild className="h-12 w-full rounded-full text-base font-semibold">
            <a href={mailtoHref}>
              <Mail className="mr-2 h-4 w-4" />
              {t("Contact hello@stampee.co")}
            </a>
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >{t("Close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradePrompt;
