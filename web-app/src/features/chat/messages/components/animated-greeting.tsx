import { atom, useAtom } from "jotai";
import { useEffect } from "react";
import { motion } from "framer-motion";

interface AnimatedGreetingProps {
  name: string;
}

export const animatedAtom = atom(false);

const AnimatedGreeting = ({ name }: AnimatedGreetingProps) => {
  const [isAnimated, setIsAnimated] = useAtom(animatedAtom);

  const getGreeting = () => {
    if (!name) return "Hi, I'm Syykick";
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const greeting = getGreeting();
  const greetingText = name ? `${greeting}, ${name}` : greeting;

  useEffect(() => {
    setIsAnimated(true);
  }, [setIsAnimated]);

  return (
    <div className="flex flex-col items-center gap-1">
      <motion.h3
        initial={isAnimated ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="scroll-m-20 text-2xl md:text-4xl font-normal text-center tracking-normal"
        aria-label={greetingText}
      >
        {greetingText}
      </motion.h3>
      {/* <motion.div
        initial={isAnimated ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
        className="text-lg font-normal text-center tracking-normal"
      >
        {assistText}
      </motion.div> */}
    </div>
  );
};

export default AnimatedGreeting;
