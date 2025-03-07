"use client";

import api from "@/lib/api";

// Hooks
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useRef } from "react";

// State
import { initalInputAtom } from "@/atoms/chat";
import { pricingPlanDialogOpenAtom } from "@/components/PricingDialog";

// Components
import ConversationStarters from "@/features/chat/messages/components/conversation-starters";
import InstallPrompt from "@/components/InstallPrompt";
import { toast } from "sonner";
import Syyclops3dEye from "@/features/chat/messages/components/syy-eye";
import {
  AnimatedGreeting,
  ChatInputForm,
  ChatInputFormRef,
} from "@/features/chat/messages/components";
import { useMeQuery } from "@/features/user/api";

export default function Home() {
  const router = useRouter();

  const [initalInput, setInitalInput] = useAtom(initalInputAtom);

  const [, setShowPricingDialog] = useAtom(pricingPlanDialogOpenAtom);

  const { data: user, isFetched: userIsFetched } = useMeQuery();

  const chatInputRef = useRef<ChatInputFormRef>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInitalInput(e.target.value);
  };

  const handleSubmit = async () => {
    if (initalInput.trim() === "") return;

    // Require login
    if (!user) {
      router.push("/login");
      return;
    }

    try {
      // Create thread in background
      const { id: threadId } = await api.threads.createThread();
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

      <div className="w-full flex flex-1 items-center justify-center">
        <div className="flex flex-col h-[65%] md:h-[55%] items-center w-full ">
          <div className="w-[175px] flex items-center justify-center">
            <Syyclops3dEye size={175} />
          </div>

          <div className="flex flex-col gap-6">
            <AnimatedGreeting name={user?.name?.split(" ")[0] ?? ""} />

            <ConversationStarters
              triggerFileInput={() => chatInputRef.current?.triggerFileInput()}
              triggerTextAreaFocus={() => chatInputRef.current?.focusTextArea()}
            />
          </div>
        </div>
      </div>

      <div className="w-full flex items-center justify-center mx-auto p-6 pb-8 md:pb-4 md:p-2 absolute bottom-0 left-0 right-0">
        <div className="flex flex-col w-full max-w-3xl">
          <ChatInputForm
            input={initalInput}
            setInput={setInitalInput}
            handleInputChange={handleInputChange}
            ref={chatInputRef}
            onSubmit={handleSubmit}
          />

          {!user && userIsFetched && (
            <div className="text-xs text-gray-500 text-center mt-2">
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
            </div>
          )}
        </div>
      </div>
    </>
  );
}
