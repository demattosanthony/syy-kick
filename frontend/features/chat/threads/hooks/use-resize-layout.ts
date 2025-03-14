import { useEffect, useState } from "react";

export default function useResizeLayout() {
  // Add state for managing the split width
  const [splitPosition, setSplitPosition] = useState(35);
  const [isResizing, setIsResizing] = useState(false);

  // Handle mouse down on the resizer
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const container = document.getElementById("chat-container");
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newPosition =
        ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Limit the resize range (10% to 90%)
      const limitedPosition = Math.min(Math.max(newPosition, 10), 90);

      // Since we've swapped the panels, we need to adjust how splitPosition works
      // Now splitPosition controls the width of the right panel (chat)
      setSplitPosition(100 - limitedPosition);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  return { splitPosition, isResizing, handleMouseDown };
}
