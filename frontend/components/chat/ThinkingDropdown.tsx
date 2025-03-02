import { Brain, ChevronDown } from "lucide-react";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ThinkingDropdownProps {
  children: React.ReactNode;
}

export function ThinkingDropdown({ children }: ThinkingDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="w-fit rounded-lg mb-2 border border-border p-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-1 rounded-lg text-sm text-muted-foreground hover:text-primary transition-colors duration-200"
        aria-expanded={isOpen}
        aria-controls="thinking-content"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4" />
          <span className="font-medium">
            {isOpen ? "Hide thoughts" : "Read my mind"}
          </span>
        </div>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="thinking-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="text-muted-foreground mt-3 pt-3 border-t text-sm leading-relaxed">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
