import { ChevronDown, ChevronRight } from "lucide-react";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ThinkingDropdownProps {
  children: React.ReactNode;
  autoClose?: boolean;
}

const ThinkingDropdown = ({
  children,
  autoClose = false,
}: ThinkingDropdownProps) => {
  const [isOpen, setIsOpen] = React.useState(true);

  // Auto-close the dropdown when autoClose is true
  React.useEffect(() => {
    if (autoClose) {
      setIsOpen(false);
    }
  }, [autoClose]);

  return (
    <div className="w-fit rounded-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-1 rounded-lg text-sm hover:text-primary transition-colors duration-200 cursor-pointer"
        aria-expanded={isOpen}
        aria-controls="thinking-content"
      >
        <div className="flex items-center gap-2">
          {/* <Lightbulb className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors duration-200" /> */}
          <span className="font-medium">
            {isOpen ? "Hide thoughts" : "Show thoughts"}
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="h-3 w-3 transition-transform duration-200" />
        ) : (
          <ChevronRight className="h-3 w-3 transition-transform duration-200" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="thinking-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="ml-2 overflow-hidden overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent border-l-2 border-border pl-4 mt-2"
          >
            <div className="text-muted-foreground text-sm leading-relaxed">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ThinkingDropdown;
