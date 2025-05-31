import { Textarea } from "@/components/ui/textarea";

interface TextInputAreaProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  isGenerating?: boolean;
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  setFocused: (focused: boolean) => void;
  processFiles: (files: File[]) => void;
}

export function TextInputArea({
  input,
  handleInputChange,
  handleKeyDown,
  placeholder,
  isGenerating,
  textAreaRef,
  setFocused,
  processFiles,
}: TextInputAreaProps) {
  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      event.preventDefault(); // Prevent pasting text representation
      processFiles(files);
    }
  };

  return (
    <Textarea
      placeholder={placeholder}
      onChange={handleInputChange}
      ref={textAreaRef}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      value={input}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      autoFocus
      disabled={isGenerating}
      style={{
        height: "35px",
        minHeight: "35px",
        maxHeight: "350px",
      }}
      className="resize-none !min-h-[35px] w-full text-base rounded-xl border-none focus:ring-0 shadow-none focus-visible:ring-0 bg-transparent placeholder:font-normal dark:placeholder:text-[#A9A9B8] scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent border-0"
    />
  );
}
