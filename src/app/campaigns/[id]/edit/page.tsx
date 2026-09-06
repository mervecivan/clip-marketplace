"use client";

import { useParams, useRouter } from "next/navigation";
import { CampaignForm } from "@/components/campaign-form";
import { trpc } from "@/lib/trpc";

export default function EditCampaignPage() {
  const params = useParams<{ id: string }>();
  const campaignId = Number(params.id);
  const router = useRouter();
  const utils = trpc.useUtils();
  const campaign = trpc.campaign.get.useQuery(
    { id: campaignId },
    { enabled: Number.isInteger(campaignId) && campaignId > 0 },
  );
  const updateMutation = trpc.campaign.update.useMutation({
    onSuccess: () => {
      utils.campaign.get.invalidate({ id: campaignId });
      utils.campaign.list.invalidate();
      router.push(`/campaigns/${campaignId}`);
    },
  });

  if (!Number.isInteger(campaignId) || campaignId <= 0) {
    return <p>Invalid campaign.</p>;
  }
  if (campaign.isLoading) return <p>Loading…</p>;
  if (campaign.error) return <p className="text-destructive">{campaign.error.message}</p>;
  if (!campaign.data) return <p>Not found.</p>;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-medium">Edit campaign</h1>
      <CampaignForm
        defaultValues={campaign.data}
        submitLabel="Save changes"
        pending={updateMutation.isPending}
        errorMessage={updateMutation.error?.message}
        onSubmit={(values) => updateMutation.mutate({ ...values, id: campaignId })}
      />
    </div>
  );
}
