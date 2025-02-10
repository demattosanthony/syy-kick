"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, ArrowRight, Key } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AIOrbScene from "@/components/AiOrbScene";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const { handleGoogleLogin, handleSSOLogin } = useAuth();

  const [ssoSelected, setSsoSelected] = React.useState(false);
  const [workEmail, setWorkEmail] = React.useState("");

  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleSSOSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const domain = workEmail.split("@")[1].split(".")[0];

    try {
      // Check if org exists first
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/saml/check/${domain}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Organization not found");
      }

      // If org exists, proceed with SSO
      handleSSOLogin(domain);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-12 h-full">
      <div className="absolute top-1 left-1">
        <Button
          onClick={() => {
            if (ssoSelected) {
              setSsoSelected(false);
            } else {
              router.back();
            }
          }}
          size={"icon"}
          variant={"ghost"}
        >
          <ArrowLeft size={24} />
        </Button>
      </div>

      <main className="flex flex-col gap-8 items-center w-full justify-center h-[75%]">
        <AIOrbScene height="75px" width="75px" isAnimating={true} />

        {/** Title and description */}
        <div className="flex flex-col items-center w-[400px] gap-2">
          <h3 className="scroll-m-20 text-3xl font-semibold tracking-tight">
            Yo! Let&apos;s get started
          </h3>
          {/* <p className="text-base text-muted-foreground text-center">
            What's up?
          </p> */}
        </div>

        {/** Oauth buttons */}
        {!ssoSelected && (
          <div className="flex flex-col gap-4">
            <Button
              className="font-semibold w-[320px] flex justify-start h-[50px]"
              onClick={handleGoogleLogin}
              variant={"outline"}
            >
              <Image
                src="/logos/google.svg"
                alt="google"
                width={20}
                height={20}
                className="mr-1"
              />
              Continue with Google
            </Button>
            <Button
              className="font-semibold w-[320px] flex justify-start h-[50px]"
              onClick={() => setSsoSelected(true)}
              variant={"outline"}
            >
              <Key className="mr-1 h-5 w-5" />
              Continue with Organization
            </Button>
          </div>
        )}

        {ssoSelected && (
          <form className="flex flex-col" onSubmit={handleSSOSubmit}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col">
                <Input
                  type="email"
                  value={workEmail}
                  onChange={(e) => {
                    setWorkEmail(e.target.value);
                    setError("");
                  }}
                  placeholder="Enter your work email"
                  className="w-[320px] h-[50px]"
                  autoFocus
                  required
                />
                {error && (
                  <p className="text-sm text-red-500 mt-1 px-2">{error}</p>
                )}
              </div>

              <Button
                type="submit"
                className="font-semibold w-[320px] flex justify-center h-[50px]"
                disabled={!workEmail || isLoading}
              >
                {isLoading ? "Checking..." : "Continue"}
                {!isLoading && <ArrowRight size={24} className="ml-1" />}
              </Button>
            </div>
          </form>
        )}
      </main>

      <div className="absolute bottom-2">
        <Link href={"https://syyclops.com"} target="_blank">
          <Button variant={"link"}>By Syyclops</Button>
        </Link>
      </div>
    </div>
  );
}
