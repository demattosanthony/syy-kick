"use client";

import MarkdownViewer from "../MarkdownViewer";
import { Card, CardContent } from "../ui/card";

export function ReadmeSection({ content }: { content: string }) {
  return (
    <Card className="w-full shadow-none">
      <CardContent className="p-6">
        <MarkdownViewer content={content} />
      </CardContent>
    </Card>
  );
}
