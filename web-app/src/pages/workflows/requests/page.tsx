import { Button } from "@/components/ui/button";
import { RequestForm } from "@/features/workflows/features/requests/components";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";

export function RequestWorkflowPage() {
    const navigate = useNavigate();

    return (
        <div>
            <div className="mx-auto px-4 py-4">
                <Button variant="ghost" onClick={() => navigate("/workflows")}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Workflows
                </Button>
            </div>
            <RequestForm />
        </div>
    );
}
