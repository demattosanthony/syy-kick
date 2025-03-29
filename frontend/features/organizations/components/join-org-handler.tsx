"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/hooks";
import Image from "next/image";

const JoinOrgHandler = ({
  token,
  initialOrgDetails,
}: {
  token: string;
  initialOrgDetails: any;
}) => {
  const { handleJoinOrg } = useAuth();
  const [, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Use initialOrgDetails instead of fetching
  const orgDetails = initialOrgDetails;

  const handleJoin = async (provider: "google" | "microsoft") => {
    setIsLoading(true);
    setError("");

    try {
      const result = await handleJoinOrg(token);

      if (result.requiresAuth) {
        // Redirect to Google login with invite token as state parameter
        window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/${provider}?state=${token}`;
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

      if (result.error) {
        setError(result.error);
        return;
      }

      window.location.href = "/?orgId=" + orgDetails?.organization.id;
    } catch {
      setError("Failed to join organization");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to render auth buttons
  const renderAuthButtons = (disabled = false) => (
    <div className="flex flex-col gap-4">
      <Button
        className="font-semibold w-[320px] flex justify-start h-[50px]"
        onClick={() => handleJoin("google")}
        variant="outline"
        disabled={disabled}
      >
        <Image
          height={20}
          width={20}
          src="/logos/google.svg"
          alt="google"
          className="h-5 w-5 mr-1"
        />
        Continue with Google
      </Button>
      <Button
        className="font-semibold w-[320px] flex justify-start h-[50px]"
        onClick={() => handleJoin("microsoft")}
        variant="outline"
        disabled={disabled}
      >
        <Image
          height={20}
          width={20}
          src="/logos/msft.svg"
          alt="msft"
          className="h-5 w-5 mr-1"
        />
        Continue with Microsoft
      </Button>
    </div>
  );

  // Helper to render footer
  const renderFooter = () => (
    <div className="absolute bottom-4 flex flex-col items-center gap-2">
      <footer className="text-xs text-gray-500 text-center shrink-0">
        By using our service, you agree to our{" "}
        <a
          href="/policies/terms-of-use"
          className="underline hover:text-gray-700"
        >
          Terms of Service
        </a>{" "}
        and{" "}
        <a
          href="/policies/privacy-policy"
          className="underline hover:text-gray-700"
        >
          Privacy Policy
        </a>
      </footer>
    </div>
  );

  // Helper to render content layout
  const renderLayout = (children: React.ReactNode) => (
    <div className="min-h-screen flex flex-col items-center px-4 py-12 h-full">
      <main className="flex flex-col gap-8 items-center w-full justify-center h-[75%]">
        {children}
      </main>
      {renderFooter()}
    </div>
  );

  if (!orgDetails || !orgDetails.organization) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-red-500">
          We couldn&apos;t find the organization you&apos;re trying to join
        </p>
      </div>
    );
  }

  return renderLayout(
    <>
      {/* Organization logo or eye */}
      {orgDetails?.organization.logoUrl ? (
        <img
          src={orgDetails.organization.logoUrl}
          alt={`${orgDetails.organization.name} logo`}
          className="h-[75px] w-[75px] object-cover rounded-full"
        />
      ) : (
        <div className="mb-4">
          <Image src={"/logo512.png"} width={65} height={65} alt="" />
        </div>
      )}

      {/* Organization info */}
      <div className="flex flex-col items-center w-[400px] gap-2">
        <h3 className="scroll-m-20 text-3xl font-semibold tracking-tight">
          Join {orgDetails?.organization.name || "Organization"}
        </h3>
        <p className="text-base text-muted-foreground text-center">
          You&apos;ve been invited to join {orgDetails?.organization.name}
        </p>
      </div>

      {/* Error message if any */}
      {error && (
        <p className="text-sm text-red-500 mt-1 px-2 max-w-[550px] text-center">
          {error}
        </p>
      )}

      {/* Auth buttons */}
      {renderAuthButtons()}
    </>
  );
};

export default JoinOrgHandler;
