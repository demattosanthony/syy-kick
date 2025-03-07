"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAtom } from "jotai";
import { AUTO_MODEL_CONFIG, initalInputAtom, modelAtom } from "@/atoms/chat";
import {
  Plug,
  Search,
  LucideIcon,
  Building,
  Files,
  FileText,
  ChevronDown,
  ChevronUp,
  BarChart,
  ClipboardList,
  Lightbulb,
  Compass,
  Gauge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { animatedAtom } from "@/features/chat/messages/components/animated-greeting";

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
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  description?: string; // Short description of what the starter does
}

interface CategoryProps {
  id: string;
  name: string;
  icon: LucideIcon;
  iconColor: string;
  starters: StarterButtonProps[];
}

const CATEGORIES: CategoryProps[] = [
  {
    id: "mep-systems",
    name: "MEP Systems",
    icon: Plug,
    iconColor: "text-blue-500",
    starters: [
      {
        icon: Building,
        iconColor: "text-purple-500",
        label: "Generate BOD",
        description: "Create a Basis of Design document",
        inputText:
          "Analyze this document and create a comprehensive Basis of Design (BOD) document. First, carefully review the content to extract all relevant engineering requirements, specifications, and project parameters. Then, generate a well-structured markdown BOD document that includes:\n\n1. Project Overview\n2. Design Criteria and Standards\n3. System Descriptions (HVAC, Plumbing, Electrical, etc.)\n4. Load Calculations and Assumptions\n5. Equipment Selections\n6. Control Strategies\n7. Energy Efficiency Measures\n8. Sustainability Considerations\n\nFormat the BOD as a professional markdown document with appropriate headings, tables, and bullet points. This document should serve as a clear reference for all engineering design decisions and requirements. MAKE SURE to return the document as an artifact in markdown format.",
        requiresFile: true,
      },
      {
        icon: Compass,
        iconColor: "text-orange-500",
        label: "HVAC Load Analysis",
        description: "Calculate heating and cooling loads from plans",
        inputText:
          "Analyze this document and calculate the heating and cooling loads for the building. Extract room dimensions, occupancy, equipment loads, and envelope details to provide a comprehensive load analysis. Present results in a table format.",
        requiresFile: true,
      },
    ],
  },
  {
    id: "energy-sustainability",
    name: "Energy & Sustainability",
    icon: Gauge,
    iconColor: "text-green-500",
    starters: [
      {
        icon: BarChart,
        iconColor: "text-green-500",
        label: "Energy Performance",
        description: "Analyze building energy performance metrics",
        inputText:
          "Analyze the energy performance data in this document. Calculate EUI, identify efficiency opportunities, and compare against industry benchmarks. Present findings in clear, visual format.",
        requiresFile: true,
      },
      {
        icon: Plug,
        iconColor: "text-teal-500",
        label: "Extract Energy Usage",
        description: "Get usage data from energy bills",
        inputText:
          "Extract my energy usage from this bill and return it in a table format. Calculate month-to-month changes and identify consumption patterns.",
        requiresFile: true,
      },
      {
        icon: Lightbulb,
        iconColor: "text-yellow-500",
        label: "LEED Credit Analysis",
        description: "Evaluate project LEED certification potential",
        inputText:
          "Review this document and identify potential LEED credits the project could achieve. Organize by credit category and provide recommendations to maximize certification level.",
        requiresFile: true,
      },
    ],
  },
  {
    id: "structural-construction",
    name: "Structural & Construction",
    icon: Building,
    iconColor: "text-amber-500",
    starters: [
      {
        icon: Files,
        iconColor: "text-blue-500",
        label: "Generate RFP",
        description: "Create a detailed Request for Proposal",
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

Please proceed with your analysis and summary of the project document.

Return the RFP as an artifact in markdown format.`,
        requiresFile: true,
      },
      {
        icon: ClipboardList,
        iconColor: "text-red-500",
        label: "Material Takeoff",
        description: "Calculate material quantities from plans",
        inputText:
          "Create a detailed material takeoff from this document. Extract dimensions, quantities, and specifications for key construction materials. Organize results by CSI division.",
        requiresFile: true,
      },
      {
        icon: Building,
        iconColor: "text-amber-500",
        label: "Construction Schedule",
        description: "Develop project timeline from documents",
        inputText:
          "Generate a construction schedule based on this document. Identify key milestones, critical path activities, and required sequencing. Present as a timeline with durations.",
        requiresFile: true,
      },
    ],
  },
  {
    id: "codes-documentation",
    name: "Codes & Documentation",
    icon: FileText,
    iconColor: "text-purple-500",
    starters: [
      {
        icon: Search,
        iconColor: "text-red-500",
        label: "Code Compliance Check",
        description: "Verify compliance with building codes",
        inputText:
          "Review this document and identify any potential building code compliance issues. Focus on structural, fire, accessibility, and energy code requirements.",
        requiresFile: true,
      },
      {
        icon: ClipboardList,
        iconColor: "text-amber-500",
        label: "Generate Specifications",
        description: "Create technical specifications from plans",
        inputText:
          "Generate detailed technical specifications based on this document. Extract material requirements, performance criteria, and installation standards. Format as a proper specification section.",
        requiresFile: true,
      },
      {
        icon: FileText,
        iconColor: "text-blue-500",
        label: "Permit Documentation",
        description: "Prepare permit submission requirements",
        inputText:
          "Analyze this document and create a list of all required documentation needed for permitting. Include drawings, calculations, forms and other submissions required by typical jurisdictions.",
        requiresFile: true,
      },
    ],
  },
  {
    id: "project-management",
    name: "Project Management",
    icon: ClipboardList,
    iconColor: "text-indigo-500",
    starters: [
      {
        icon: Lightbulb,
        iconColor: "text-yellow-500",
        label: "Risk Assessment",
        description: "Identify project risks and mitigation strategies",
        inputText:
          "Analyze this document and create a comprehensive risk assessment. Identify potential risks, rate their likelihood and impact, and suggest mitigation strategies.",
        requiresFile: true,
      },
      {
        icon: BarChart,
        iconColor: "text-green-500",
        label: "Cost Estimation",
        description: "Generate detailed project cost estimates",
        inputText:
          "Review this document and create a detailed cost estimate. Break down costs by category, identify key assumptions, and provide a confidence range for the estimate.",
        requiresFile: true,
      },
      {
        icon: ClipboardList,
        iconColor: "text-amber-500",
        label: "Quality Control Plan",
        description: "Create QC procedures for engineering projects",
        inputText:
          "Develop a quality control plan based on this document. Include inspection points, testing requirements, acceptance criteria, and documentation needs.",
        requiresFile: true,
      },
    ],
  },
];

function StarterCard({
  icon: Icon,
  iconColor,
  label,
  description,
  onClick,
}: StarterButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="flex flex-col items-start gap-1 h-auto p-4 text-left w-full hover:bg-secondary"
    >
      <div className="flex items-center gap-2 w-full">
        <Icon className={iconColor} size={16} />
        <span className="font-medium">{label}</span>
      </div>
      {description && (
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      )}
    </Button>
  );
}

function CategorySection({
  category,
  handleButtonClick,
}: {
  category: CategoryProps;
  handleButtonClick: (starter: StarterButtonProps) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="w-full border rounded-md overflow-hidden">
      <button
        className="flex items-center justify-between w-full p-3 bg-secondary/20"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <category.icon className={category.iconColor} size={18} />
          <h3 className="font-medium">{category.name}</h3>
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3">
          {category.starters.map((starter, index) => (
            <StarterCard
              key={index}
              {...starter}
              onClick={(e) => {
                e?.preventDefault();
                e?.stopPropagation();
                handleButtonClick(starter);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const ConversationStarters = ({
  triggerFileInput,
  triggerTextAreaFocus,
}: ConversationStartersProps) => {
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
      className="flex flex-col w-full max-w-[750px] gap-4"
      initial={alreadyAnimated ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={alreadyAnimated ? {} : { delay: 1, duration: 1 }}
    >
      {CATEGORIES.map((category, index) => (
        <CategorySection
          key={index}
          category={category}
          handleButtonClick={handleButtonClick}
        />
      ))}
    </motion.div>
  );
};

export default ConversationStarters;
