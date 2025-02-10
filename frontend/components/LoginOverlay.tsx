"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "@/components/ui/button";
import { useMeQuery } from "@/queries/queries";
import { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AIOrbScene from "./AiOrbScene";

export function LoginOverlay() {
  const [isDismissed, setIsDismissed] = useState(false);

  const { handleGoogleLogin } = useAuth();

  const { data: user, isLoading } = useMeQuery();

  if (isLoading || user || isDismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 z-50">
      <Card className="w-full max-w-[400px] shadow-2xl border-0 bg-background backdrop-blur">
        <div className="absolute top-2 right-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardHeader className="text-center">
          <div className="relative mx-auto w-20 h-20 mb-2">
            <AIOrbScene height="80px" width="80px" isAnimating={true} />
          </div>

          <CardTitle className="text-3xl font-bold">Yo..ur AI</CardTitle>
          <CardDescription className="text-base">
            Chat with multiple AI models in one seamless experience
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center">
          <Button className="font-semibold w-full" onClick={handleGoogleLogin}>
            <img
              src="/logos/google.svg"
              alt="google"
              className="h-5 w-5 mr-1"
            />
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
