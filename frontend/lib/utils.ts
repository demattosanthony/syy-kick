import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("FileReader result is not a string"));
      }
    };

    reader.onerror = () => {
      reject(new Error("FileReader encountered an error"));
    };

    reader.readAsDataURL(file);
  });
};

export function getRelativeTimeString(date: string | Date): string {
  const now = new Date();
  const past = new Date(date);
  const diffInMs = now.getTime() - past.getTime();

  const diffInSecs = Math.floor(diffInMs / 1000);
  const diffInMins = Math.floor(diffInSecs / 60);
  const diffInHours = Math.floor(diffInMins / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const diffInWeeks = Math.floor(diffInDays / 7);
  const diffInMonths = Math.floor(diffInDays / 30);
  const diffInYears = Math.floor(diffInDays / 365);

  if (diffInSecs < 60)
    return `${diffInSecs} ${diffInSecs === 1 ? "second" : "seconds"} ago`;
  if (diffInMins < 60)
    return `${diffInMins} ${diffInMins === 1 ? "minute" : "minutes"} ago`;
  if (diffInHours < 24)
    return `${diffInHours} ${diffInHours === 1 ? "hour" : "hours"} ago`;
  if (diffInDays < 7)
    return `${diffInDays} ${diffInDays === 1 ? "day" : "days"} ago`;
  if (diffInWeeks < 4)
    return `${diffInWeeks} ${diffInWeeks === 1 ? "week" : "weeks"} ago`;
  if (diffInMonths < 12)
    return `${diffInMonths} ${diffInMonths === 1 ? "month" : "months"} ago`;
  return `${diffInYears} ${diffInYears === 1 ? "year" : "years"} ago`;
}
