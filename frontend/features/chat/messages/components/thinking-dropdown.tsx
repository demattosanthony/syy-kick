import { Brain, ChevronDown, ChevronRight, Lightbulb } from "lucide-react";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ThinkingDropdownProps {
  children: React.ReactNode;
}

const ThinkingDropdown = ({ children }: ThinkingDropdownProps) => {
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <div className=" w-fit rounded-lg mb-2 p-3 bg-card border border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-1 rounded-lg text-sm text-muted-foreground hover:text-primary transition-colors duration-200"
        aria-expanded={isOpen}
        aria-controls="thinking-content"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">
            {isOpen ? "Hide thoughts" : "Read my mind"}
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 transition-transform duration-200" />
        ) : (
          <ChevronRight className="h-4 w-4 transition-transform duration-200" />
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
            className="overflow-hidden max-h-[400px] overflow-y-auto mt-3 border-t scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent"
          >
            <div className="text-muted-foreground  pt-3  text-sm leading-relaxed">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ThinkingDropdown;
