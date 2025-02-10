"use client";

import api from "@/lib/api";

// Hooks
import { useAtom } from "jotai";
import { useMeQuery } from "@/queries/queries";
import { useRouter } from "next/navigation";
import { useRef } from "react";

// Components
import AIOrbScene from "@/components/AiOrbScene";
import ConversationStarters from "@/components/ConversationStarters";
import {
  PricingDialog,
  pricingPlanDialogOpenAtom,
} from "@/components/PricingDialog";
import { AnimatedGreeting } from "@/components/AnimatedGreeting";
import InstallPrompt from "@/components/InstallPrompt";
import { toast } from "sonner";
import ChatInputForm, {
  ChatInputFormRef,
} from "@/components/chat/ChatInputForm";
import { initalInputAtom } from "@/atoms/chat";
import { useWorkspace } from "@/components/sidebar/workspace-context";

export default function Home() {
  const router = useRouter();

  const [initalInput, setInitalInput] = useAtom(initalInputAtom);

  const [showPricingDialog, setShowPricingDialog] = useAtom(
    pricingPlanDialogOpenAtom
  );

  const { data: user } = useMeQuery();
  const { activeWorkspace } = useWorkspace();

  const chatInputRef = useRef<ChatInputFormRef>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInitalInput(e.target.value);
  };

  const handleSubmit = async () => {
    // Require login
    if (!user) {
      router.push("/login");
      return;
    }

    try {
      // Create thread in background
      const { id: threadId } = await api.threads.createThread(
        activeWorkspace?.type === "organization"
          ? activeWorkspace.id
          : undefined
      );
      router.prefetch(`/threads/${threadId}?new=true`);
      router.push(`/threads/${threadId}?new=true`);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "subscription_required") {
        setShowPricingDialog(true);
        toast.error("Pro plan required to create a new thread.");
      } else {
        toast.error("Failed to create thread. Please try again.", {
          action: {
            label: "Retry",
            onClick: () => handleSubmit(),
          },
        });
      }
    }
  };

  return (
    <>
      <InstallPrompt />

      {user &&
        user?.subscriptionStatus !== "active" &&
        showPricingDialog &&
        !(
          activeWorkspace?.type === "organization" &&
          activeWorkspace.subscriptionStatus === "active"
        ) && <PricingDialog />}

      <div className="w-full flex flex-1 items-center justify-center">
        <div className="flex flex-col h-[80%] md:h-[65%] items-center w-full ">
          <div className="mb-6 w-[400px] flex items-center justify-center">
            <AIOrbScene />
          </div>

          <div className="flex flex-col gap-8">
            <AnimatedGreeting name={user?.name?.split(" ")[0] ?? ""} />

            <ConversationStarters
              triggerFileInput={() => chatInputRef.current?.triggerFileInput()}
              triggerTextAreaFocus={() => chatInputRef.current?.focusTextArea()}
            />
          </div>
        </div>
      </div>

      <div className="w-full flex items-center justify-center mx-auto p-6 pb-8 md:pb-4 md:p-2 absolute bottom-0 left-0 right-0">
        <ChatInputForm
          input={initalInput}
          setInput={setInitalInput}
          handleInputChange={handleInputChange}
          ref={chatInputRef}
          onSubmit={handleSubmit}
        />
      </div>
    </>
  );
}
