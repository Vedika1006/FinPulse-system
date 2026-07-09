import { useEffect, useState } from "react";

/**
 * Reveals `text` one character at a time. Restarts automatically whenever
 * the owning component mounts — pair with a `key` prop on an ancestor to
 * replay the effect on a loop.
 *
 * @param {string} text
 * @param {number} speed          ms per character
 * @param {number} delay          ms before typing starts
 * @param {boolean} reduceMotion  when true, shows the full text immediately
 * @returns {{ displayed: string, done: boolean }}
 */
export default function useTypewriter(text, speed = 40, delay = 0, reduceMotion = false) {
  const [displayed, setDisplayed] = useState(reduceMotion ? text : "");
  const [done, setDone] = useState(reduceMotion ? true : false);

  useEffect(() => {
    if (reduceMotion) {
      setDisplayed(text);
      setDone(true);
      return undefined;
    }

    setDisplayed("");
    setDone(false);
    let i = 0;
    let intervalId;

    const startTimeout = setTimeout(() => {
      intervalId = setInterval(() => {
        i += 1;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(intervalId);
          setDone(true);
        }
      }, speed);
    }, delay);

    return () => {
      clearTimeout(startTimeout);
      clearInterval(intervalId);
    };
  }, [text, speed, delay, reduceMotion]);

  return { displayed, done };
}
