"use client";

import { CampaignForm } from "@/components/campaign-form";
import { trpc } from "@/lib/trpc";
import { useRouter } from "next/navigation";

export default function NewCampaignPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const createMutation = trpc.campaign.create.useMutation({
    onSuccess: (created) => {
      utils.campaign.list.invalidate();
      router.push(`/campaigns/${created.id}`);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-medium">New campaign</h1>
      <CampaignForm
        submitLabel="Create campaign"
        pending={createMutation.isPending}
        errorMessage={createMutation.error?.message}
        onSubmit={(values) => createMutation.mutate(values)}
      />
    </div>
  );
}
