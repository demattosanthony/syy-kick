"use client";

import { useEffect, useState, Suspense } from "react";
import { Check, Loader2, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import api from "@/lib/api";
import { useNavigate, useSearchParams } from "react-router";

// Animation variants for Framer Motion
const iconAnimation = {
  initial: { scale: 0 },
  animate: { scale: 1 },
  transition: { type: "spring", duration: 0.6 },
};

type Status = "processing" | "success" | "error";

const ProcessingState = () => (
  <div className="w-full max-w-md">
    <div className="text-center space-y-4">
      <div className="flex justify-center">
        <Loader2 className="animate-spin h-14 w-14" />
      </div>
      <p className="text-muted-foreground">Processing your payment...</p>
    </div>
  </div>
);

const SuccessState = () => (
  <div className="w-full max-w-md">
    <div className="text-center space-y-4">
      <motion.div {...iconAnimation} className="flex justify-center">
        <Check className="w-16 h-16 text-green-500" />
      </motion.div>
      <p className="text-muted-foreground">Payment successful!</p>
    </div>
  </div>
);

const ErrorState = () => (
  <div className="w-full max-w-md">
    <div className="text-center space-y-4">
      <motion.div {...iconAnimation} className="flex justify-center">
        <XCircle className="w-16 h-16 text-red-500" />
      </motion.div>
      <p className="text-muted-foreground">
        Something went wrong with your payment
      </p>
    </div>
  </div>
);

const SuccessPageContent = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session_id = searchParams.get("session_id");
  const organization_id = searchParams.get("organization_id");

  const [status, setStatus] = useState<Status>("processing");

  useEffect(() => {
    const syncData = async () => {
      if (!session_id) {
        setStatus("error");
        setTimeout(() => navigate("/"), 2000);
        return;
      }

      try {
        await api.payments.syncAfterSuccess(
          session_id,
          organization_id || undefined
        );

        setStatus("success");
        const redirectUrl = organization_id
          ? `settings?tab=organization&orgId=${organization_id}`
          : "/";
        setTimeout(() => navigate(redirectUrl), 1500);
      } catch (error) {
        console.error("Error syncing data:", error);
        setStatus("error");
        setTimeout(() => navigate("/"), 2000);
      }
    };

    syncData();
  }, [session_id, navigate, organization_id]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {status === "processing" && <ProcessingState />}
      {status === "success" && <SuccessState />}
      {status === "error" && <ErrorState />}
    </div>
  );
};

export const PaymentSuccessPage = () => {
  return (
    <Suspense fallback={<ProcessingState />}>
      <SuccessPageContent />
    </Suspense>
  );
};
