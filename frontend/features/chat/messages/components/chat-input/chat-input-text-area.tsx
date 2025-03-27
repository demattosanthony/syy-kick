import { Textarea } from "@/components/ui/textarea";

interface TextInputAreaProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  isGenerating?: boolean;
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  setFocused: (focused: boolean) => void;
}

export function TextInputArea({
  input,
  handleInputChange,
  handleKeyDown,
  placeholder,
  isGenerating,
  textAreaRef,
  setFocused,
}: TextInputAreaProps) {
  return (
    <Textarea
      placeholder={placeholder}
      onChange={handleInputChange}
      ref={textAreaRef}
      onKeyDown={handleKeyDown}
      value={input}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      autoFocus
      disabled={isGenerating}
      style={{
        height: "50px",
        minHeight: "50px",
        maxHeight: "375px",
      }}
      className="resize-none !min-h-[50px] w-full text-base rounded-xl border-none focus:ring-0 shadow-none focus-visible:ring-0 bg-transparent placeholder:font-normal scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent border-0"
    />
  );
}
