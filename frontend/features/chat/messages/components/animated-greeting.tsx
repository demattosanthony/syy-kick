import { atom, useAtom } from "jotai";
import { useEffect } from "react";

interface AnimatedGreetingProps {
  name: string;
}

export const animatedAtom = atom(false);

const AnimatedGreeting = ({ name }: AnimatedGreetingProps) => {
  const [, setIsAnimated] = useAtom(animatedAtom);

  const getGreeting = () => {
    if (!name) return "Welcome to Yo";
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const greetingText = name ? `${getGreeting()}, ${name}` : getGreeting();
  const assistText = "How can I help you today?";

  useEffect(() => {
    setIsAnimated(true);
  }, [setIsAnimated]);

  return (
    <div className="flex flex-col items-center gap-1">
      <h3
        className="scroll-m-20 text-2xl md:text-4xl font-semibold text-center tracking-normal"
        aria-label={greetingText}
      >
        {greetingText}
      </h3>
      <div className="text-lg font-medium text-center tracking-normal">
        {assistText}
      </div>
    </div>
  );
};

export default AnimatedGreeting;
