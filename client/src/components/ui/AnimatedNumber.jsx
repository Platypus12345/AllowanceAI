import { useEffect, useRef, useState } from 'react';

export function AnimatedNumber({ value, prefix = '₹', duration = 800, className = '' }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const start = startRef.current;
    const end = Number(value) || 0;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      setDisplay(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        startRef.current = end;
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  return (
    <span className={`font-space ${className}`}>
      {prefix}
      {display.toLocaleString('en-IN')}
    </span>
  );
}
