export function getModelImage(provider: string) {
  const iconPath = getModelIconPath(provider);
  if (!iconPath) return null;

  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

  return <img src={iconPath} alt={providerName} className="w-5 h-5  rounded" />;
}

export function getModelIconPath(provider: string) {
  switch (provider) {
    case "openai":
      return "/logos/openai.ico";
    case "anthropic":
      return "/logos/anthropic.ico";
    case "perplexity":
      return "/logos/perplexity.ico";
    case "google":
      return "/logos/google.svg";
    case "xai":
      return "/logos/xai.svg";
    case "mistral":
      return "/logos/mistral.svg";
    case "groq":
      return "/logos/meta.svg";
    case "meta":
      return "/logos/meta.svg";
    case "deepseek":
      return "/logos/deepseek.ico";
    default:
      return null;
  }
}
