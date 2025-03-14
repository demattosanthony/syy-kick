"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DialogFooter } from "../../../components/ui/dialog";
import LocationSearch from "./location-search";

interface ProjectFormData {
  name: string;
  description: string;
  projectNumber: string;
  estimatedStartDate: string;
  estimatedEndDate: string;
  location: {
    address: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    latitude: string;
    longitude: string;
  };
}

interface ProjectFormFieldsProps {
  formData: ProjectFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProjectFormData>>;
  isSubmitting: boolean;
  submitButtonText: string;
}

const ProjectFormFields = ({
  formData,
  setFormData,
  isSubmitting,
  submitButtonText,
}: ProjectFormFieldsProps) => {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="name">
          Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          placeholder="Project name"
          value={formData.name}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, name: e.target.value }))
          }
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location">
          Location <span className="text-red-500">*</span>
        </Label>
        <LocationSearch
          value={formData.location}
          onChange={(locationData) =>
            setFormData((prev) => ({
              ...prev,
              location: {
                address: locationData.address || "",
                city: locationData.city || "",
                state: locationData.state || "",
                country: locationData.country || "",
                postalCode: locationData.postalCode || "",
                latitude: locationData.latitude || "",
                longitude: locationData.longitude || "",
              },
            }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="projectNumber">Project Number</Label>
        <Input
          id="projectNumber"
          placeholder="Project number"
          value={formData.projectNumber}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, projectNumber: e.target.value }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Project description"
          value={formData.description}
          onChange={(e) =>
            setFormData((prev) => ({
              ...prev,
              description: e.target.value,
            }))
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="estimatedStartDate">Estimated Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="estimatedStartDate"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.estimatedStartDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.estimatedStartDate ? (
                  format(new Date(formData.estimatedStartDate), "PPP")
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={
                  formData.estimatedStartDate
                    ? new Date(formData.estimatedStartDate)
                    : undefined
                }
                defaultMonth={
                  formData.estimatedStartDate
                    ? new Date(formData.estimatedStartDate)
                    : undefined
                }
                onSelect={(date) =>
                  setFormData((prev) => ({
                    ...prev,
                    estimatedStartDate: date ? date.toISOString() : "",
                  }))
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="estimatedEndDate">Estimated End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="estimatedEndDate"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !formData.estimatedEndDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {formData.estimatedEndDate ? (
                  format(new Date(formData.estimatedEndDate), "PPP")
                ) : (
                  <span>Pick a date</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={
                  formData.estimatedEndDate
                    ? new Date(formData.estimatedEndDate)
                    : undefined
                }
                defaultMonth={
                  formData.estimatedEndDate
                    ? new Date(formData.estimatedEndDate)
                    : undefined
                }
                onSelect={(date) =>
                  setFormData((prev) => ({
                    ...prev,
                    estimatedEndDate: date ? date.toISOString() : "",
                  }))
                }
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isSubmitting}>
          {submitButtonText}
        </Button>
      </DialogFooter>
    </>
  );
};

export default ProjectFormFields;
