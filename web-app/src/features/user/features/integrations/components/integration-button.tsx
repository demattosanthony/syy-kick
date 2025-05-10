import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
        <div className="group relative flex items-center justify-between border-2 border-dashed border-border rounded-xl p-6 transition-all duration-200 hover:border-primary/50">
            <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                    <img src={logo} alt={name} className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold">{name}</h2>
                        <Badge
                            variant="outline"
                            className={`${isConnected
                                ? "bg-green-100 text-green-800 border-green-200"
                                : "bg-red-100 text-red-800 border-red-200"
                                }`}
                        >
                            {isConnected ? "Connected" : "Disconnected"}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{description}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {isConnected ? (
                    <Button
                        disabled={isLoading}
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={onDisconnect}
                    >
                        {isLoading ? "Disconnecting..." : "Disconnect"}
                    </Button>
                ) : (
                    <Button
                        disabled={isLoading}
                        variant="default"
                        size="sm"
                        onClick={onConnect}
                    >
                        {isLoading ? "Connecting..." : "Connect"}
                    </Button>
                )}
            </div>
        </div>
    );
}
