import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorDisplayProps {
  errorDetails: {
    type: "upload" | "processing" | "general" | "network";
    message: string;
  } | null;
  onReset: () => void;
}

/** ErrorDisplay: Shows error messages with a reset option */
function ErrorDisplay({ errorDetails, onReset }: ErrorDisplayProps) {
  if (!errorDetails) return null;

  const errorIcons = {
    upload: <AlertCircle className="h-5 w-5 text-destructive" />,
    processing: <AlertCircle className="h-5 w-5 text-destructive" />,
    network: <AlertCircle className="h-5 w-5 text-destructive" />,
    general: <AlertCircle className="h-5 w-5 text-destructive" />,
  };

  const errorTitles = {
    upload: "File Upload Error",
    processing: "Processing Error",
    network: "Network Error",
    general: "Error",
  };

  return (
    <Alert variant="destructive" className="mb-8">
      <div className="flex items-start">
        {errorIcons[errorDetails.type]}
        <div className="ml-3">
          <AlertTitle>{errorTitles[errorDetails.type]}</AlertTitle>
          <AlertDescription className="mt-1">
            {errorDetails.message}
          </AlertDescription>
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="mt-3"
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Reset and try again
          </Button>
        </div>
      </div>
    </Alert>
  );
}

export default ErrorDisplay;
