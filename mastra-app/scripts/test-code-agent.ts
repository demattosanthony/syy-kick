import { RuntimeContext } from "@mastra/core/di";
import { Sandbox } from "@e2b/code-interpreter";
import type { CodeExecutionContext } from "../src/mastra/tools/code-execution.ts";
import { codingAgent } from "../src/mastra/agents/index.ts";
import Bun from "bun";
import { AnthropicProviderOptions } from "@ai-sdk/anthropic";
import path from "path";

const localDir = path.resolve(process.cwd());
const filePath = `${localDir}/customer-templates/Project_BomTracker_05232025.xlsx`;

const file = Bun.file(filePath);
const fileBuffer = await file.arrayBuffer();

const sandbox = await Sandbox.create();

await sandbox.files.write("/project_bom_tracker.xlsx", fileBuffer);

const runtimeContext = new RuntimeContext<CodeExecutionContext>();
runtimeContext.set("sandbox", sandbox);

const { text, toolCalls, toolResults, steps } = await codingAgent.generate(
  [
    {
      role: "user",
      content: `Your job is to fill out an excel file with the proper data. The excel file is a template for tracking the bill of materials for a project. You are given the template and the data to populate it.
      
I have placed the Excel file template in the sandbox at the path /project_bom_tracker.xlsx. 

**TASK**: Use Python code to read the Excel file template and populate it with the specific Bill of Materials data provided below, while preserving ALL original formatting of the template.

**REQUIREMENTS**:
1. **Use Python** with libraries like openpyxl or pandas to manipulate the Excel file
2. **PRESERVE ALL ORIGINAL FORMATTING**: Keep all existing colors, fonts, borders, cell styles, and layout intact
3. **Populate with the provided BOM data** (see data table below)
4. **Manufacturer Formatting**: When adding manufacturer names (the rows that have a part number but no quantity value), format them as:
   - **Bold text**
   - **Yellow background highlight**
5. **Save the file** at the same path: /project_bom_tracker.xlsx

**DATA TO POPULATE** - Use this exact TOTALIZED BILL OF MATERIALS data:

| Part Number | Total Quantity | 
|-------------|----------------|
| ACI |  | 
| LOCKING COVER | 22 | 
| Alp_Dwyer | | 
| A-489 | 2 | 
| Alps_BAPI | | 
| ZPS-ACC01 | 2 | 
| ZPS-ACC10 | 2 | 
| Alps_CBI-electric | | 
| QL-1-13-DM-KM-15 | 1 | 
| Alps_Entretec | | 
| 11511811 | 1 | 
| 11836816 | 2 | 
| 16511417 | 1 | 
| 16841007 | 1 | 
| 320001205 | 1 | 
| BAM4 | 2 | 
| Alps_Functional Devices | | 
| EISK5-100T | 1 | 
| PSH100A100AB10 | 1 | 
| PSH600-UPS | 1 | 
| RIB2401B | 2 | 
| RIBU1C | 1 | 
| Alps_Panduit | | 
| C1.5LG6 | 1 | 
| C1LG6 | 1 | 
| G1.5X3LG6 | 1 | 
| G1X3LG6 | 1 | 
| Alps_Saginaw | | 
| SCE-20N2008LP | 1 | 
| SCE-20N20MP | 1 | 
| SCE-DLKLD8 | 1 | 
| Alps_Veris | | 
| X050CEB | 1 | 
| Broudy | | 
| TBL675US | 1 | 
| Broudy_Belimo | | 
| 01CT-5MLF1-4 | 29 | 
| Broudy_Honeywell | | 
| DEVICE-25 | 1 | 
| NPB-8000-2X-485 | 1 | 
| SMA-8025-1YR-INIT | 1 | 
| SUP-2-SMA-INIT | 1 | 
| TR40 | 20 | 
| TR42 | 4 | 
| TR42-CO2 | 5 | 
| VAA-VA75M24NMC | 29 | 
| WEB-8000-NONWIFI | 1 | 
| WEB-8025 | 1 | 
| WEB-S-2-N4 | 1 | 
| Broudy_L-Com | | 
| RE1903U | 1 | 
| DigiKey_Weidmuller | | 
| 6720005430 | 1 | 
| NDP | | 
| CAT6-10 | 2 | 
| NDP_Dell | | 
| NDP-452-BDUY | 1 | 
| NDP-DELL-E2423HN | 1 | 
| NDP-OptiPlex Micro | 1 | 
| NDP_StarTech | | 
| NDP-DP2HDMI2 | 1 | 
| NDP-HDMM6 | 1 | 
| NDP_Tripplite | | 
| NDP-PS712B | 1 | 
| Purchase locally | | 
| unknown | 4 | 
| Senva | | 
| C-2300 | 3 | 
| CT1O-A3X-HAV | 1 | 
| Stock | | 
| RC610/G | 1 | 
| RC610/L | 1 | 
| RC610/N | 1 |

**DATA STRUCTURE LOGIC**:
- Rows with empty quantities are **manufacturer names** (should be bold + yellow highlight)
- Rows with quantities are **part numbers** under that manufacturer
- Follow this hierarchical structure where manufacturer names are category headers followed by their part numbers

**IMPLEMENTATION STEPS**:
1. Use Python to open the Excel file with openpyxl to preserve formatting
2. Parse the data above to identify manufacturer rows (empty quantity) vs part rows (with quantity)
3. Populate the Excel template with this exact data in the appropriate location
4. Apply bold formatting and yellow background to ALL manufacturer name rows
5. Ensure part number rows maintain clean formatting with quantities
6. Save the file preserving all original template structure and formatting

**CRITICAL**: Use the exact data provided above - do not modify or add to it. Preserve all original template formatting, formulas, and visual styling.`,
    },
  ],
  {
    maxSteps: 10,
    runtimeContext,
    providerOptions: {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: 4000 },
      } satisfies AnthropicProviderOptions,
    },
  }
);

console.log(
  steps.map((step) => ({
    text: step.text,
    file: step.files,
    reasoning: step.reasoning,
    toolCall: JSON.stringify(step.toolCalls),
    toolResult: JSON.stringify(step.toolResults),
  }))
);

const fileContent = await sandbox.files.read("/project_bom_tracker.xlsx", {
  format: "bytes",
});

await Bun.write("project_bom_tracker_output.xlsx", fileContent);

sandbox.kill();
