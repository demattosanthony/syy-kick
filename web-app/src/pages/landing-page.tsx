// Hooks
import { useAtom } from "jotai";
import { useRef } from "react";

// State
import { initalInputAtom } from "@/atoms/chat";

// Components
import ConversationStarters from "@/features/chat/messages/components/conversation-starters";
import {
  AnimatedGreeting,
  ChatInputFormRef,
} from "@/features/chat/messages/components";
import ChatInputForm from "@/features/chat/messages/components/chat-input/chat-input";

import { useNavigate } from "react-router";
import { LoginButtons } from "@/features/auth/components";
import logo from "@/assets/logo192.png";

export function LandingPage() {
  const navigate = useNavigate();
  const [initalInput, setInitalInput] = useAtom(initalInputAtom);
  const chatInputRef = useRef<ChatInputFormRef>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInitalInput(e.target.value);
  };

  const handleSubmit = async () => {
    if (initalInput.trim() === "") return;

    navigate("/login");
  };

  return (
    <div className="flex flex-col h-screen overflow-y-auto w-full">
      <div className="absolute top-4 right-4 z-10">
        <LoginButtons />
      </div>

      <div className="flex flex-col flex-1">
        <div className="flex flex-col items-center w-full gap-6 pb-4">
          <div className="w-[85px] flex items-center justify-center min-h-[85px] mt-[16vh]">
            <img src={logo} width={85} height={85} alt="Logo" />
          </div>

          <div className="flex flex-col gap-6 min-h-[72px]">
            <AnimatedGreeting name={""} />
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
              <ConversationStarters
                triggerFileInput={() =>
                  chatInputRef.current?.triggerFileInput()
                }
                triggerTextAreaFocus={() =>
                  chatInputRef.current?.focusTextArea()
                }
              />
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
}
