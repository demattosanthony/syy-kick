"use client";

import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import AIOrbScene from "@/components/AiOrbScene";
import { useOrgFromInviteToken } from "@/queries/queries";

export default function JoinOrgHandler({ token }: { token: string }) {
  const { handleJoinOrg } = useAuth();
  const router = useRouter();
  const [, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Query to fetch org details from the invite token
  const {
    data: orgDetails,
    isLoading: isLoadingOrg,
    error: fetchOrgError,
  } = useOrgFromInviteToken(token);

  const handleJoin = async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await handleJoinOrg(token);
      if (result.requiresAuth) {
        // Redirect to Google login with invite token as state parameter
        window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google?state=${token}`;
        return;
      }
      if (result.insufficientSeats) {
        setError(
          "This organization has reached its seat limit. Please contact your organization administrator to increase the number of seats."
        );
        return;
      }
      if (result.inactiveSubscription) {
        setError(
          "This organization's subscription is not active. Please contact your organization administrator."
        );
        return;
      }

      router.push("/?orgId=" + orgDetails?.organization.id);
    } catch {
      setError("Failed to join organization");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingOrg) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg">Loading organization details...</p>
      </div>
    );
  }

  if (fetchOrgError || !orgDetails || !orgDetails.organization) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-red-500">
          We couldn&apos;t find the organization you&apos;re trying to join
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-12 h-full">
      <main className="flex flex-col gap-8 items-center w-full justify-center h-[75%]">
        {orgDetails?.organization.logoUrl ? (
          <img
            src={orgDetails.organization.logoUrl}
            alt={`${orgDetails.organization.name} logo`}
            className="h-[75px] w-[75px] object-contain"
          />
        ) : (
          <AIOrbScene height="75px" width="75px" isAnimating={true} />
        )}

        <div className="flex flex-col items-center w-[400px] gap-2">
          <h3 className="scroll-m-20 text-3xl font-semibold tracking-tight">
            Join {orgDetails?.organization.name || "Organization"}
          </h3>
          <p className="text-base text-muted-foreground text-center">
            You&apos;ve been invited to join {orgDetails?.organization.name}
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-500 mt-1 px-2 max-w-[550px] text-center">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-4">
          <Button
            className="font-semibold w-[320px] flex justify-start h-[50px]"
            onClick={handleJoin}
            variant="outline"
          >
            <img
              src="/logos/google.svg"
              alt="google"
              className="h-5 w-5 mr-1"
            />
            Continue with Google
          </Button>
        </div>
      </main>

      <div className="absolute bottom-2">
        <Link href="https://syyclops.com" target="_blank">
          <Button variant="link">By Syyclops</Button>
        </Link>
      </div>
    </div>
  );
}
