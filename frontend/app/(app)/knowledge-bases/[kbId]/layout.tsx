import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import api from "@/lib/api";
import { Slash } from "lucide-react";
import Link from "next/link";

export default async function KnowledgeBaseHeader({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ kbId: string }>;
}) {
  const { kbId } = await params;
  const kb = await api.knowledgeBases.getKnowledgeBase(kbId).catch(() => null);

  return (
    <div className="min-h-screen bg-background flex items-center flex-col relative">
      <div className="h-14 flex items-center justify-between w-full px-4">
        <div>
          <Breadcrumb>
            <BreadcrumbList className="flex items-center w-full overflow-x-auto whitespace-nowrap scrollbar-hide">
              <BreadcrumbItem>
                <Link
                  href={"/knowledge-bases"}
                  className={`hover:text-blue-500 hover:underline truncate`}
                >
                  Knowledge Bases
                </Link>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="flex-shrink-0 w-5">
                <Slash className="w-4 h-4" />
              </BreadcrumbSeparator>

              <BreadcrumbItem>
                <Link
                  href={"/knowledge-bases/" + kb?.id}
                  className={`hover:text-blue-500 hover:underline truncate font-bold`}
                >
                  {kb?.name}
                </Link>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      {children}
    </div>
  );
}
