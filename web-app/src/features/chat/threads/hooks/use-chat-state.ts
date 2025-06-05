import { useEffect, useState, useCallback } from "react";
import { useAtom } from "jotai";
import { useParams } from "react-router";
import {
  alreadyAutoSelectedArtifactAtom,
  selectedArtifactAtom,
  chatStatusAtom,
  userClosedArtifactsAtom,
} from "@/atoms/chat";
import { ChatMessage } from "@/types/chat";

export const useChatState = (initialMessages: ChatMessage[]) => {
  const params = useParams<{ threadId: string }>();
  const { threadId } = params;

  const [selectedArtifact, setSelectedArtifact] = useAtom(selectedArtifactAtom);
  const [, setAlreadyOpenedArtifact] = useAtom(alreadyAutoSelectedArtifactAtom);
  const [chatStatus, setChatStatus] = useAtom(chatStatusAtom);
  const [, setUserClosedArtifacts] = useAtom(userClosedArtifactsAtom);

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [, setError] = useState<string | null>(null);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  // Update messages when initialMessages change
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      setSelectedArtifact(null);
      setAlreadyOpenedArtifact(null);
      setChatStatus("ready");
      setUserClosedArtifacts(new Set<string>());
    };
  }, [
    threadId,
    setChatStatus,
    setSelectedArtifact,
    setAlreadyOpenedArtifact,
    setUserClosedArtifacts,
  ]);

  return {
    threadId,
    selectedArtifact,
    chatStatus,
    messages,
    setMessages,
    input,
    setInput,
    setError,
    handleInputChange,
  };
};
