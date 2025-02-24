"use client";

import { Card, CardContent } from "../ui/card";
import MarkdownViewer from "../viewers/markdown-viewer";

export function ReadmeSection({ content }: { content: string }) {
  return (
    <Card className="w-full shadow-none">
      <CardContent className="p-6">
        <MarkdownViewer content={content} />
      </CardContent>
    </Card>
  );
}
