import api from "@/lib/api";

// Hooks
import { useAtom } from "jotai";
import { useRef } from "react";

// State
import { initalInputAtom } from "@/atoms/chat";
import { pricingPlanDialogOpenAtom } from "@/components/PricingDialog";

// Components
import ConversationStarters from "@/features/chat/messages/components/conversation-starters";
import { toast } from "sonner";
import {
  AnimatedGreeting,
  ChatInputFormRef,
} from "@/features/chat/messages/components";
import ChatInputForm from "@/features/chat/messages/components/chat-input/chat-input";
import { useMeQuery } from "@/features/user/api";
import { useNavigate } from "react-router";

// Images
import logo from "@/assets/logo192.png";

export function HomePage() {
  const { data: user, isFetched: userFetched } = useMeQuery();

  const navigate = useNavigate();
  const [initalInput, setInitalInput] = useAtom(initalInputAtom);
  const [, setShowPricingDialog] = useAtom(pricingPlanDialogOpenAtom);
  const chatInputRef = useRef<ChatInputFormRef>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInitalInput(e.target.value);
  };

  const handleSubmit = async () => {
    if (initalInput.trim() === "") return;

    // Require login
    if (!user) {
      navigate("/login");
      return;
    }

    setInitalInput(initalInput.trim());

    try {
      // Create thread in background
      const { id: threadId } = await api.threads.createThread({});
      navigate(`/threads/${threadId}?isNew=true`);
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
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex flex-col flex-1">
        <div className="flex flex-col items-center w-full gap-6 pb-4">
          <div className="w-[75px] flex items-center justify-center min-h-[75px] mt-[16vh]">
            <img src={logo} width={75} height={75} alt="Logo" />
          </div>

          <div className="flex flex-col gap-6 min-h-[72px]">
            {userFetched && (
              <AnimatedGreeting name={user?.name?.split(" ")[0] ?? ""} />
            )}
          </div>

          <div className="flex flex-col w-full px-6 mt-4 md:px-2">
            <ChatInputForm
              input={initalInput}
              setInput={setInitalInput}
              handleInputChange={handleInputChange}
              ref={chatInputRef}
              onSubmit={handleSubmit}
            />
          </div>

          <div className="max-w-5xl w-full flex flex-col items-center">
            <div className="flex flex-col items-center max-w-[800px] w-full">
              {!user && (
                <ConversationStarters
                  triggerFileInput={() =>
                    chatInputRef.current?.triggerFileInput()
                  }
                  triggerTextAreaFocus={() =>
                    chatInputRef.current?.focusTextArea()
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {!user && userFetched && (
        <footer className="text-xs text-gray-500 text-center p-4 shrink-0">
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
      )}
    </div>
  );
}
