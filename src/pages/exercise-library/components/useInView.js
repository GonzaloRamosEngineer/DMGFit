import { useEffect, useRef, useState } from 'react';

/**
 * Detecta cuándo un elemento entra en el viewport. Lo usamos para reproducir
 * el GIF de un ejercicio solo cuando está visible (en mobile no hay hover),
 * evitando descargar y animar cientos de GIFs a la vez.
 */
export const useInView = ({ rootMargin = '120px', once = false } = {}) => {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting && once) observer.disconnect();
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin, once]);

  return [ref, inView];
};

export default useInView;
