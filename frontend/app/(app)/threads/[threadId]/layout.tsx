import api from "@/lib/api";
import { Metadata } from "next";

type Props = {
  params: Promise<{ threadId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { threadId } = await params;

  const thread = await api.threads.getThread(threadId);
  const lastMessage = thread.messages[thread.messages.length - 1];

  if (!thread || !thread.title) {
    return {
      title: "Syykick",
      description: "Syykick",
      openGraph: {
        title: "Syykick",
        description: "Syykick",
      },
    };
  }

  return {
    title: thread.title + " - Syykick",
    description: lastMessage?.text.slice(0, 250),
    openGraph: {
      title: thread.title + " - Syykick",
      description: lastMessage?.text.slice(0, 250),
    },
  };
}

export default function ThreadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
