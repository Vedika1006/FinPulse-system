import { useEffect, useRef, useState } from "react";

// Accelerates fast, eases out at the end — used for the KPI counters.
export const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

// Symmetric ease-in-out — used for the health score ring/counter.
export const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Counts a number from 0 up to `target` using requestAnimationFrame.
 * Restarts automatically whenever the owning component mounts — pair with a
 * `key` prop on an ancestor to replay the count on a loop.
 *
 * @param {number} target      final value
 * @param {number} duration    ms
 * @param {number} delay       ms before the count starts
 * @param {(t:number)=>number} easing  easing fn, t/return in [0,1]
 * @param {boolean} reduceMotion  when true, jumps straight to `target`
 */
export default function useCountUp(target, duration = 1000, delay = 0, easing = easeOutExpo, reduceMotion = false) {
  const [value, setValue] = useState(reduceMotion ? target : 0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (reduceMotion) {
      setValue(target);
      return undefined;
    }

    setValue(0);
    let start;
    let cancelled = false;

    const tick = (ts) => {
      if (cancelled) return;
      if (start === undefined) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / duration, 1);
      setValue(Math.round(target * easing(progress)));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const timeoutId = setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick);
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay, easing, reduceMotion]);

  return value;
}
