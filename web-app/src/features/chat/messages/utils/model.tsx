import openaiLogo from "@/assets/logos/openai.ico";
import anthropicLogo from "@/assets/logos/anthropic.ico";
import perplexityLogo from "@/assets/logos/perplexity.ico";
import googleLogo from "@/assets/logos/google.svg";
import xaiLogo from "@/assets/logos/xai.svg";
import mistralLogo from "@/assets/logos/mistral.svg";
import groqLogo from "@/assets/logos/meta.svg";
import deepseekLogo from "@/assets/logos/deepseek.ico";
import metaLogo from "@/assets/logos/meta.svg";

export function getModelImage(provider: string) {
  const iconPath = getModelIconPath(provider);
  if (!iconPath) return null;

  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

  return <img src={iconPath} alt={providerName} className="w-5 h-5  rounded" />;
}

export function getModelIconPath(provider: string) {
  switch (provider) {
    case "openai":
      return openaiLogo;
    case "anthropic":
      return anthropicLogo;
    case "perplexity":
      return perplexityLogo;
    case "google":
      return googleLogo;
    case "xai":
      return xaiLogo;
    case "mistral":
      return mistralLogo;
    case "groq":
      return groqLogo;
    case "meta":
      return metaLogo;
    case "deepseek":
      return deepseekLogo;
    default:
      return null;
  }
}
