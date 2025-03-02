"use client";

import { motion } from "framer-motion";
import { Button } from "./ui/button";
import { useAtom } from "jotai";
import { AUTO_MODEL_CONFIG, initalInputAtom, modelAtom } from "@/atoms/chat";
import { Plug, Search, LucideIcon, Building, Files } from "lucide-react";
import { animatedAtom } from "./AnimatedGreeting";

interface ConversationStartersProps {
  triggerFileInput: () => void;
  triggerTextAreaFocus: () => void;
}

interface StarterButtonProps {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  inputText: string;
  requiresFile?: boolean;
  requiresWebSearch?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void; // Updated type
}

const CONVERSATION_STARTERS: StarterButtonProps[] = [
  {
    icon: Search,
    iconColor: "text-red-500",
    label: "Analyze PDF",
    inputText: "Help me ",
    requiresFile: true,
  },
  {
    icon: Plug,
    iconColor: "text-teal-500",
    label: "Extract Energy Usage",
    inputText:
      "Extract my energy usage from this bill and return it in a table format",
    requiresFile: true,
  },
  //   {
  //     icon: NotebookPen,
  //     iconColor: "text-blue-500",
  //     label: "Write a Report",
  //     inputText: "Help me write a report about ",
  //     requiresFile: false,
  //   },
  {
    icon: Building,
    iconColor: "text-purple-500",
    label: "Generate Basis of Design",
    inputText:
      "Analyze this document and create a comprehensive Basis of Design (BOD) document. First, carefully review the content to extract all relevant engineering requirements, specifications, and project parameters. Then, generate a well-structured markdown BOD document that includes:\n\n1. Project Overview\n2. Design Criteria and Standards\n3. System Descriptions (HVAC, Plumbing, Electrical, etc.)\n4. Load Calculations and Assumptions\n5. Equipment Selections\n6. Control Strategies\n7. Energy Efficiency Measures\n8. Sustainability Considerations\n\nFormat the BOD as a professional markdown document with appropriate headings, tables, and bullet points. This document should serve as a clear reference for all engineering design decisions and requirements. MAKE SURE to return the document as an artifact in markdown format.",
    requiresFile: true,
  },
  {
    icon: Files,
    iconColor: "text-blue-500",
    label: "Generate RFP",
    inputText: `You are an experienced MEP (Mechanical, Electrical, Plumbing) engineer tasked with analyzing project documents and generating fee estimates. Your goal is to extract key information from the provided document and calculate appropriate MEP design fees based on industry standards.

Please follow these steps to analyze the document and generate a fee estimate:

1. Carefully read through the project document.

2. Extract the following key information:
   - Type of building
   - Square footage (sf)
   - Construction budget
   - Brief description of the project

3. Calculate the MEP design fees based on the following guidelines:
   - Use a range of 0.75% to 1% of the construction budget
   - Break down the fees into the following phases:
     a) SD (Schematic Design)
     b) DD (Design Development)
     c) CD (Construction Documents)
     d) CA (Construction Administration)
   - Use industry standards to allocate percentages to each phase

4. Double-check your extracted information and calculations to ensure accuracy.

5. Present your findings in a clear, structured format.

Before providing your final output, wrap your analysis inside <project_analysis> tags. In this analysis:
- Quote relevant parts of the document for each key piece of information you extract.
- Consider different building types and their typical MEP requirements.
- Justify your chosen fee percentage within the 0.75% to 1% range.
- Break down industry standard percentages for each project phase.
This will help ensure a thorough interpretation of the data and accurate fee estimation. It's OK for this section to be quite long.

After your analysis, provide a summary of your findings in the following format:

1. Project Information:
   - Building Type: [Type]
   - Square Footage: [SF]
   - Construction Budget: [Budget]
   - Project Description: [Brief description]

2. MEP Design Fee Estimate:
   - Total Fee Range: [Lower bound] - [Upper bound]
   - Fee Breakdown:
     a) SD (Schematic Design): [Amount] ([Percentage])
     b) DD (Design Development): [Amount] ([Percentage])
     c) CD (Construction Documents): [Amount] ([Percentage])
     d) CA (Construction Administration): [Amount] ([Percentage])

3. Additional Notes: [Any relevant observations or recommendations]

Please proceed with your analysis and summary of the project document.`,
    requiresFile: true,
  },

  //   {
  //     icon: Globe,
  //     iconColor: "text-green-500",
  //     label: "Search the web",
  //     inputText: "Search the web for ",
  //     requiresFile: false,
  //     requiresWebSearch: true,
  //   },
];

function StarterButton({
  icon: Icon,
  iconColor,
  label,
  onClick,
}: StarterButtonProps) {
  return (
    <Button variant="outline" onClick={onClick}>
      <Icon className={iconColor} size={16} />
      {label}
    </Button>
  );
}

export default function ConversationStarters({
  triggerFileInput,
  triggerTextAreaFocus,
}: ConversationStartersProps) {
  const [, setInput] = useAtom(initalInputAtom);
  const [, setModel] = useAtom(modelAtom);
  const [alreadyAnimated] = useAtom(animatedAtom);

  const handleButtonClick = async (starter: StarterButtonProps) => {
    const { requiresFile, inputText } = starter;

    setModel(AUTO_MODEL_CONFIG);

    if (requiresFile) {
      await new Promise((r) => setTimeout(r, 100));

      triggerFileInput();
    }

    setInput(inputText);
    triggerTextAreaFocus();
  };

  return (
    <motion.div
      className="flex flex-wrap gap-2 justify-center items-center max-w-[750px]"
      initial={alreadyAnimated ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={alreadyAnimated ? {} : { delay: 1, duration: 1 }}
    >
      {CONVERSATION_STARTERS.map((starter, index) => (
        <StarterButton
          key={index}
          {...starter}
          onClick={(e) => {
            e?.preventDefault();
            e?.stopPropagation();
            handleButtonClick(starter);
          }}
        />
      ))}
    </motion.div>
  );
}
