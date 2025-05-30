import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface IntegrationButtonProps {
  name: string;
  description: string;
  logo: string;
  isConnected: boolean;
  isLoading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function IntegrationButton({
  name,
  description,
  logo,
  isConnected,
  isLoading,
  onConnect,
  onDisconnect,
}: IntegrationButtonProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-200",
        "hover:shadow-lg hover:scale-[1.01]",
        "border-gray-200"
      )}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          {/* Left side - Logo and Info */}
          <div className="flex items-start gap-4 flex-1">
            {/* Logo Container */}
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-xl",
                "bg-white shadow-sm border",
                isConnected ? "border-green-200" : "border-gray-200"
              )}
            >
              <img src={logo} alt={name} className="w-8 h-8 object-contain" />
            </div>

            {/* Info Section */}
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
                {isConnected && (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                {description}
              </p>

              {/* Status Badge */}
              <div className="flex items-center gap-2 mt-2">
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                    isConnected
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-600"
                  )}
                >
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isConnected ? "bg-green-600" : "bg-gray-400"
                    )}
                  />
                  {isConnected ? "Connected" : "Not connected"}
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Action Button */}
          <div className="flex items-center">
            {isConnected ? (
              <Button
                disabled={isLoading}
                variant="ghost"
                size="sm"
                onClick={onDisconnect}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Disconnecting
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    Disconnect
                  </>
                )}
              </Button>
            ) : (
              <Button disabled={isLoading} size="sm" onClick={onConnect}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4" />
                    Connect
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
