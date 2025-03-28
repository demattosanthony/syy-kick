import { atom, useAtom } from "jotai";
import Image from "next/image";
import { useEffect } from "react";

interface AnimatedGreetingProps {
  name: string;
}

export const animatedAtom = atom(false);

const AnimatedGreeting = ({ name }: AnimatedGreetingProps) => {
  const [, setIsAnimated] = useAtom(animatedAtom);

  const getGreeting = () => {
    if (!name) return "Hi, I'm Syykick";
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
    <div className="flex flex-col items-center justify-center gap-1">
      <div className="flex items-center gap-4">
        <Image src={"/logo512.png"} width={32} height={32} alt="logo" />
        <h3
          className="text-3xl md:text-4xl tracking-normal "
          aria-label={greetingText}
        >
          {greetingText}
        </h3>
      </div>
      <p className="text-lg">{assistText}</p>
    </div>
  );
};

export default AnimatedGreeting;
