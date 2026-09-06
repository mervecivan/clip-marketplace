"use client";

import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { campaignFormSchema, type CampaignFormValues } from "@/shared/campaign-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const PLATFORMS = ["tiktok", "instagram", "youtube"] as const;

function toDateInput(value: Date | string | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function CampaignForm({
  defaultValues,
  submitLabel,
  pending,
  errorMessage,
  onSubmit,
}: {
  defaultValues?: Partial<CampaignFormValues>;
  submitLabel: string;
  pending: boolean;
  errorMessage?: string;
  onSubmit: (values: CampaignFormValues) => void;
}) {
  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema) as Resolver<CampaignFormValues>,
    defaultValues: {
      title: defaultValues?.title ?? "",
      platforms: defaultValues?.platforms ?? [],
      payoutPer1kViews: defaultValues?.payoutPer1kViews ?? 0,
      totalBudget: defaultValues?.totalBudget ?? 0,
      startsAt: defaultValues?.startsAt,
      endsAt: defaultValues?.endsAt,
    },
  });

  const platforms = form.watch("platforms");

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex max-w-lg flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...form.register("title")} />
        {form.formState.errors.title && (
          <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Platforms</legend>
        {PLATFORMS.map((platform) => (
          <div key={platform} className="flex items-center gap-2">
            <Checkbox
              id={platform}
              checked={platforms.includes(platform)}
              onCheckedChange={(checked) => {
                const current = form.getValues("platforms");
                if (checked) {
                  form.setValue("platforms", [...current, platform], { shouldValidate: true });
                } else {
                  form.setValue(
                    "platforms",
                    current.filter((p) => p !== platform),
                    { shouldValidate: true },
                  );
                }
              }}
            />
            <Label htmlFor={platform}>{platform}</Label>
          </div>
        ))}
        {form.formState.errors.platforms && (
          <p className="text-sm text-destructive">{form.formState.errors.platforms.message}</p>
        )}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="payoutPer1kViews">Payout per 1,000 views (cents)</Label>
        <Input id="payoutPer1kViews" type="number" {...form.register("payoutPer1kViews")} />
        {form.formState.errors.payoutPer1kViews && (
          <p className="text-sm text-destructive">{form.formState.errors.payoutPer1kViews.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="totalBudget">Total budget (cents)</Label>
        <Input id="totalBudget" type="number" {...form.register("totalBudget")} />
        {form.formState.errors.totalBudget && (
          <p className="text-sm text-destructive">{form.formState.errors.totalBudget.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="startsAt">Starts at</Label>
        <Input
          id="startsAt"
          type="date"
          defaultValue={toDateInput(defaultValues?.startsAt)}
          {...form.register("startsAt")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="endsAt">Ends at</Label>
        <Input
          id="endsAt"
          type="date"
          defaultValue={toDateInput(defaultValues?.endsAt)}
          {...form.register("endsAt")}
        />
        {form.formState.errors.endsAt && (
          <p className="text-sm text-destructive">{form.formState.errors.endsAt.message}</p>
        )}
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>

      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
    </form>
  );
}
