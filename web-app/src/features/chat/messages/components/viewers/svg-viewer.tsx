import React from "react";

export const SvgViewer: React.FC<{ content: string }> = ({ content }) => {
  return (
    <div className="flex justify-center w-full">
      <div
        className="max-w-full"
        style={{ width: "100%", maxHeight: "80vh" }}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
};
