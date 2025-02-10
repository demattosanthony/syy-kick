"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useMeQuery } from "@/queries/queries";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { useAtom } from "jotai";
import { instructionsAtom, temperatureAtom } from "@/atoms/chat";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AdminSettings from "@/components/settings/admin-settings";
import { useSearchParams, useRouter } from "next/navigation";
import { useWorkspace } from "@/components/sidebar/workspace-context";
import { OrganizationSettings } from "@/components/organizations/org-settings";

export default function UserSettings() {
  const { data: user } = useMeQuery();
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeWorkspace } = useWorkspace();

  const isSuperAdmin = user?.systemRole === "super_admin";
  const isOrgOwner = useMemo(() => {
    if (activeWorkspace?.type !== "organization") return false;
    return user?.organizationMembers?.some(
      (member) =>
        member.role === "owner" && member.organization.id === activeWorkspace.id
    );
  }, [user, activeWorkspace]);

  const [temperature, setTemperature] = useAtom(temperatureAtom);
  const [, setInputValue] = useState(temperature.toFixed(2));
  const [instructions, setInstructions] = useAtom(instructionsAtom);

  const tab = searchParams.get("tab") || "account";

  const handleTemperatureChange = (value: number[]) => {
    const newTemp = value[0];
    setTemperature(newTemp);
  };

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "account") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    router.push(`/settings?${params.toString()}`);
  };

  useEffect(() => {
    setInputValue(temperature.toFixed(1));
  }, [temperature]);

  // Add useEffect for client-side mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="max-w-3xl mx-auto pt-[58px] md:pt-20 px-6 w-full h-screen flex flex-col">
      <Tabs
        value={tab}
        onValueChange={handleTabChange}
        className="w-full h-full flex flex-col"
      >
        <div className="flex items-center justify-between mb-8 flex-shrink-0">
          <h1 className="text-xl font-semibold">Settings</h1>
          <TabsList className="bg-transparent p-0 h-9 gap-6">
            <TabsTrigger
              value="account"
              className="bg-transparent px-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-9"
            >
              Account
            </TabsTrigger>
            {/* {isSuperAdmin && (
              <TabsTrigger
                value="admin"
                className="bg-transparent px-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-9"
              >
                Admin
              </TabsTrigger>
            )} */}

            {isOrgOwner && (
              <TabsTrigger
                value="organization"
                className="bg-transparent px-0 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-9"
              >
                Organization
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* Profile Picture Section */}
        <TabsContent
          value="account"
          className="h-full overflow-y-auto overflow-visible"
        >
          <div className="space-y-6 h-full">
            <section>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-base font-medium">Profile Picture</h2>
                  <p className="text-sm text-muted-foreground">
                    You look good today!
                  </p>
                </div>
                <Avatar>
                  <AvatarImage src={user?.profilePicture ?? ""} />
                  <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
              </div>
            </section>

            <div className="h-px bg-border" />

            {/* Interface Theme Section */}
            <section>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-base font-medium">Interface theme</h2>
                  <p className="text-sm text-muted-foreground">
                    Select your interface color scheme.
                  </p>
                </div>
                {mounted && (
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger className="w-48">
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          {theme === "light" && <Sun className="w-4 h-4" />}
                          {theme === "dark" && <Moon className="w-4 h-4" />}
                          {theme === "system" && (
                            <Monitor className="w-4 h-4" />
                          )}
                          <span className="capitalize">{theme}</span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">
                        <div className="flex items-center gap-2">
                          <Monitor className="w-4 h-4" />
                          <span>System</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="light">
                        <div className="flex items-center gap-2">
                          <Sun className="w-4 h-4" />
                          <span>Light</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="dark">
                        <div className="flex items-center gap-2">
                          <Moon className="w-4 h-4" />
                          <span>Dark</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </section>

            <div className="h-px bg-border" />

            {/* Model Settings Section */}
            <section className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-base font-medium">Model Settings</h2>
                <p className="text-sm text-muted-foreground">
                  Customize how the AI model responds to your prompts.
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-normal">Creativity</h3>
                    <span className="text-sm text-muted-foreground">
                      {temperature.toFixed(1)}
                    </span>
                  </div>
                  <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    value={[temperature]}
                    onValueChange={handleTemperatureChange}
                  />
                </div>

                <div className="space-y-2">
                  <h3 className="text-base font-normal">Custom Instructions</h3>
                  <Textarea
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Add personal details or preferences to customize Yo's responses (e.g. 'I'm a beginner programmer' or 'Explain things simply'). You can also add specific instructions like 'Always include code examples' or 'Be more detailed'"
                    className="min-h-[160px] resize-none"
                  />
                </div>
              </div>
            </section>
          </div>
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="admin">
            <AdminSettings />
          </TabsContent>
        )}

        <TabsContent value="organization" className="h-full overflow-y-auto">
          {activeWorkspace && activeWorkspace.type === "organization" && (
            <OrganizationSettings orgId={activeWorkspace?.id} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
