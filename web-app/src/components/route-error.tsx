import { useRouteError } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { AlertCircle, ChevronLeft, RefreshCcw } from "lucide-react";
import { Button } from "./ui/button";

export const RouteErrorElement = () => {
  const error = useRouteError() as Error;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-background/90 p-4">
      <Card className="w-full max-w-md shadow-lg border-destructive/20">
        <CardHeader className="border-b pb-3">
          <CardTitle className="flex items-center gap-2.5 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="rounded-md bg-destructive/10 p-4 mb-6">
            <p className="font-medium text-destructive/90 text-sm">
              {error?.message || "An unexpected error occurred"}
            </p>
          </div>

          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              We apologize for the inconvenience. Please try refreshing the page
              or contact support if the problem persists.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => window.location.reload()}
                className="sm:flex-1"
              >
                <RefreshCcw className="w-4 h-4" />
                Refresh the page
              </Button>
              <Button
                variant="outline"
                onClick={() => window.history.back()}
                className="sm:flex-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Go to home
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
