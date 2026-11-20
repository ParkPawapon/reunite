'use client';

import { useEffect } from 'react';

export function LegacyMapRedirect() {
  useEffect(() => {
    const { hash } = window.location;
    const parameters = new URLSearchParams(hash.slice(1));
    if (parameters.get('place') || parameters.get('to')) {
      window.location.replace(`/map${hash}`);
    }
  }, []);

  return null;
}
