"use client";

import { motion } from "framer-motion";
import { useAtom } from "jotai";
import { AUTO_MODEL_CONFIG, initalInputAtom, modelAtom } from "@/atoms/chat";
import {
  Plug,
  Search,
  LucideIcon,
  Building,
  Files,
  Shield,
  BarChart2,
  DollarSign,
  ClipboardCheck,
} from "lucide-react";
import { animatedAtom } from "./animated-greeting";

interface ConversationStartersProps {
  triggerFileInput: () => void;
  triggerTextAreaFocus: () => void;
}

interface StarterCardProps {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  description: string;
  inputText: string;
  requiresFile?: boolean;
  requiresWebSearch?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const CONVERSATION_STARTERS: StarterCardProps[] = [
  {
    icon: Search,
    iconColor: "text-red-500",
    label: "Mechanical Room Layout Review",
    description:
      "Evaluate mechanical room designs for optimization and serviceability",
    inputText:
      "Please analyze this mechanical room drawing/documentation and provide a detailed assessment focused on:\n\n1. Space utilization efficiency (equipment clearances, service access, pipe/duct routing)\n2. Code compliance specific to mechanical rooms (ventilation, emergency access, fire separations)\n3. Equipment arrangement optimization for:\n   - Maintenance accessibility (filter replacement, coil cleaning, valve access)\n   - Future equipment replacement pathways\n   - Noise/vibration isolation between critical components\n4. Pipe and duct routing efficiency evaluation\n5. Safety considerations (relief valve discharge, combustion air, emergency ventilation)\n6. Specific recommendations for layout improvements with sketched annotations if possible\n\nIdentify any critical spatial conflicts, maintenance accessibility concerns, or code violations that should be addressed during design development. Format your analysis as a professional review document with clear sections for each evaluation category.",
    requiresFile: true,
  },
  {
    icon: Plug,
    iconColor: "text-teal-500",
    label: "Extract Energy Usage",
    description: "Get usage data from your energy bill in table format",
    inputText:
      "Extract my energy usage from this bill and return it in a table format",
    requiresFile: true,
  },
  {
    icon: Building,
    iconColor: "text-purple-500",
    label: "Generate Basis of Design",
    description:
      "Create a comprehensive BOD document from project specifications",
    inputText:
      "Analyze this document and create a comprehensive Basis of Design (BOD) document. First, carefully review the content to extract all relevant engineering requirements, specifications, and project parameters. Then, generate a well-structured markdown BOD document that includes:\n\n1. Project Overview\n2. Design Criteria and Standards\n3. System Descriptions (HVAC, Plumbing, Electrical, etc.)\n4. Load Calculations and Assumptions\n5. Equipment Selections\n6. Control Strategies\n7. Energy Efficiency Measures\n8. Sustainability Considerations\n\nFormat the BOD as a professional markdown document with appropriate headings, tables, and bullet points. This document should serve as a clear reference for all engineering design decisions and requirements. MAKE SURE to return the document as an artifact in markdown format.",
    requiresFile: true,
  },
  {
    icon: Files,
    iconColor: "text-blue-500",
    label: "Draft Request for Proposal",
    description: "Create a professional MEP fee estimate and RFP document",
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
    icon: Shield,
    iconColor: "text-amber-500",
    label: "Code Compliance Review",
    description:
      "Analyze designs for compliance with building codes and standards",
    inputText:
      "Please review this document for code compliance issues and provide a comprehensive analysis that includes:\n\n1. Applicable codes and standards identified\n2. Areas of potential non-compliance\n3. Life safety considerations\n4. Accessibility requirements\n5. Energy code provisions\n6. Recommendations to address compliance gaps\n\nOrganize your findings by system type (architectural, structural, mechanical, electrical, plumbing) with specific code references where possible. Highlight critical issues that require immediate attention and suggest practical solutions for resolving them.",
    requiresFile: true,
  },
  {
    icon: BarChart2,
    iconColor: "text-green-500",
    label: "Energy Model Analysis",
    description:
      "Interpret energy simulation results and recommend optimizations",
    inputText:
      "Please analyze this energy modeling report and provide:\n\n1. A summary of key performance metrics (EUI, peak loads, energy consumption by end use)\n2. Comparison to industry benchmarks (ASHRAE 90.1, CBECS, etc.)\n3. Analysis of the proposed mechanical/electrical systems' efficiency\n4. Identification of high-impact optimization opportunities\n5. Potential energy cost savings for each recommendation\n6. Carbon reduction potential\n\nPresent your findings with visual aids where appropriate and provide actionable recommendations prioritized by impact and implementation complexity.",
    requiresFile: true,
  },
  {
    icon: DollarSign,
    iconColor: "text-yellow-500",
    label: "Value Engineering",
    description:
      "Identify cost-saving opportunities while maintaining performance",
    inputText:
      "Review this project documentation and develop a value engineering analysis that:\n\n1. Identifies high-cost items or systems with potential for cost reduction\n2. Suggests alternative materials, equipment, or design approaches\n3. Evaluates each alternative for initial cost savings, life-cycle cost impact, and performance implications\n4. Considers construction schedule implications\n5. Highlights any code compliance or warranty implications\n\nPresent your recommendations in a table format that includes estimated cost savings, pros/cons of each alternative, and implementation considerations. Focus on solutions that maintain or improve functionality while reducing costs.",
    requiresFile: true,
  },
  {
    icon: ClipboardCheck,
    iconColor: "text-indigo-500",
    label: "Commissioning Plan",
    description: "Generate a comprehensive building systems commissioning plan",
    inputText:
      "Based on this project documentation, develop a comprehensive building commissioning plan that includes:\n\n1. Systems to be commissioned (HVAC, lighting, plumbing, specialty systems, etc.)\n2. Commissioning scope and process for each system\n3. Testing requirements and acceptance criteria\n4. Required documentation and deliverables\n5. Roles and responsibilities of team members\n6. Commissioning schedule aligned with construction milestones\n7. Training requirements for facility staff\n\nFormat the plan as a detailed document with appropriate sections, tables, and checklists that can be used throughout the construction process. Include recommendations for specific testing procedures that address critical performance aspects of each system.",
    requiresFile: true,
  },
];

function StarterCard({
  icon: Icon,
  iconColor,
  label,
  description,
  requiresFile,
  onClick,
}: StarterCardProps) {
  return (
    <motion.div
      className="bg-card text-card-foreground rounded-lg shadow-sm border border-border px-3 py-2.5 cursor-pointer w-[220px] h-[100px] flex flex-col"
      initial={{ y: 0, boxShadow: "var(--shadow-sm)" }}
      whileHover={{
        y: -2,
        boxShadow: "var(--shadow-md)",
      }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={`${iconColor}`} size={16} />
        <h3 className="font-medium text-sm">{label}</h3>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">
        {description}
      </p>
    </motion.div>
  );
}

const ConversationStarters = ({
  triggerFileInput,
  triggerTextAreaFocus,
}: ConversationStartersProps) => {
  const [, setInput] = useAtom(initalInputAtom);
  const [, setModel] = useAtom(modelAtom);
  const [alreadyAnimated] = useAtom(animatedAtom);

  const handleCardClick = async (starter: StarterCardProps) => {
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
      className="w-full max-w-[950px] mx-auto"
      initial={alreadyAnimated ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={alreadyAnimated ? {} : { delay: 1, duration: 1 }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 justify-items-center">
        {CONVERSATION_STARTERS.map((starter, index) => (
          <StarterCard
            key={index}
            {...starter}
            onClick={(e) => {
              e?.preventDefault();
              e?.stopPropagation();
              handleCardClick(starter);
            }}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default ConversationStarters;
