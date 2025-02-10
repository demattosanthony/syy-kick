"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Camera, Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/api";
import AIOrbScene from "@/components/AiOrbScene";
import { Label } from "../ui/label";
import { PRICING_PLANS } from "@/lib/pricing";

interface CreateOrgFormProps {
  onComplete?: (org: { id: string; seats: number }) => void;

  onBack?: () => void;
  showBackButton?: boolean;
  includeSamlSetup?: boolean;
}

export function CreateOrgForm({
  onComplete,
  onBack,
  showBackButton = true,
  includeSamlSetup = true,
}: CreateOrgFormProps) {
  const [step, setStep] = React.useState<"org" | "saml">("org");

  // Org details
  const [name, setName] = React.useState("");
  const [domain] = React.useState("");
  const [org, setOrg] = React.useState<{
    id: string;
    slug: string;
  } | null>(null);
  const [logo, setLogo] = React.useState<File | null>(null);
  const [seats, setSeats] = React.useState(5);

  // SAML config
  const [entryPoint, setEntryPoint] = React.useState("");
  const [issuer, setIssuer] = React.useState("");
  const [cert, setCert] = React.useState("");

  const handleCreateOrg = async () => {
    try {
      let fileKey = undefined;
      if (logo) {
        const { url, file_metadata } = await api.uploads.getPresignedUrl(
          logo.name,
          logo.type,
          logo.size
        );

        const res = await fetch(url, {
          method: "PUT",
          body: logo,
        });

        if (!res.ok) {
          throw new Error("Failed to upload logo");
        }

        fileKey = file_metadata.file_key;
      }

      const org = await api.organizations.createOrganization({
        name,
        domain,
        logo: fileKey,
        seats,
      });
      setOrg(org);
      if (includeSamlSetup) {
        setStep("saml");
      } else if (onComplete) {
        onComplete(org);
      }
      return org;
    } catch (error) {
      console.error(error);
    }
  };

  const handleConfigureSaml = async () => {
    try {
      if (!org) return;

      const res = await api.organizations.updateOrganization(org.id, {
        saml: {
          entryPoint,
          issuer,
          cert,
        },
      });

      if (res && onComplete) {
        onComplete({
          ...org,
          seats,
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleBack = () => {
    if (step === "saml") {
      setStep("org");
    } else if (onBack) {
      onBack();
    }
  };

  return (
    <main className="flex flex-col gap-6 items-center w-full">
      {showBackButton && (
        <div className="self-start">
          <Button onClick={handleBack} size={"icon"} variant={"ghost"}>
            <ArrowLeft size={24} />
          </Button>
        </div>
      )}

      <div className="flex flex-col items-center">
        <AIOrbScene height="75px" width="75px" isAnimating />

        <div className="flex flex-col items-center w-[400px] gap-2 mt-4">
          <h3 className="scroll-m-20 text-3xl font-semibold tracking-tight">
            {step === "org" ? "Create Organization" : "Configure SSO"}
          </h3>
          <p className="text-base text-muted-foreground text-center">
            {step === "org"
              ? "Set up your organization for team collaboration"
              : "Configure SAML single sign-on for your organization"}
          </p>
        </div>
      </div>

      {step === "org" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateOrg();
          }}
          className="flex flex-col gap-6 w-[320px]"
        >
          <div className="flex items-center justify-center">
            <label className="relative w-14 h-14 rounded-full bg-accent flex items-center justify-center cursor-pointer overflow-hidden hover:bg-gray-200 transition-colors">
              {logo ? (
                <Image
                  src={URL.createObjectURL(logo)}
                  alt="Organization logo"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="text-gray-400">
                  <Camera size={24} />
                </div>
              )}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setLogo(file);
                  }
                }}
              />
            </label>
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              // Prevent any default handling that might be blocking spaces
              if (e.key === " ") {
                e.stopPropagation();
              }
            }}
            placeholder="Organization name"
            className="h-[50px]"
            autoFocus
            required
          />

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm text-muted-foreground pl-1">
                Number of Seats
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-7"
                  onClick={() => setSeats((prev) => Math.max(1, prev - 1))}
                >
                  <Minus className="h-3 w-3" />
                </Button>

                <Input
                  value={seats}
                  onChange={(e) =>
                    setSeats(Math.max(0, parseInt(e.target.value) || 0))
                  }
                  className="w-8 h-7 text-center p-0"
                />

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 w-7"
                  onClick={() => setSeats((prev) => prev + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex justify-end text-sm text-muted-foreground pr-1">
              ${seats * PRICING_PLANS.TEAMS.cost}/month
            </div>
          </div>

          <Button
            type="submit"
            className="font-semibold w-full flex justify-center h-[50px]"
            disabled={!name || !seats || seats < 1}
          >
            Create Organization
            <ArrowRight size={24} className="ml-1" />
          </Button>
        </form>
      ) : (
        <form
          className="flex flex-col gap-4 w-[320px]"
          onSubmit={(e) => {
            e.preventDefault();
            handleConfigureSaml();
          }}
        >
          <Input
            value={entryPoint}
            onChange={(e) => setEntryPoint(e.target.value)}
            placeholder="SAML Entry Point URL"
            className="h-[50px]"
            autoFocus
            required
          />
          <Input
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            placeholder="Issuer"
            className="h-[50px]"
            required
          />
          <Textarea
            value={cert}
            onChange={(e) => setCert(e.target.value)}
            placeholder="Paste SAML Certificate"
            className="h-[100px] resize-none"
            required
          />
          <Button
            type="submit"
            className="font-semibold w-full flex justify-center h-[50px]"
            disabled={!entryPoint || !issuer || !cert}
          >
            Configure SSO
            <ArrowRight size={24} className="ml-1" />
          </Button>
        </form>
      )}

      {step === "saml" && (
        <div className="text-sm text-muted-foreground text-center">
          Your callback URL will be:
          <br />
          <code className="text-xs">
            {api.baseUrl}/auth/saml/
            {name.toLowerCase().replace(/[^a-z0-9]/g, "-")}/callback
          </code>
        </div>
      )}
    </main>
  );
}
