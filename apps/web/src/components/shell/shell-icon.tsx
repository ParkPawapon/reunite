import type { SVGProps } from 'react';

const paths = {
  refresh: 'M20 11a8 8 0 1 0-2 6M20 4v7h-7',
  check: 'm5 12 4 4L19 6',
  alert: 'M12 3 2 21h20L12 3Zm0 6v5m0 3v1',
  edit: 'm15 5 4 4M4 20l4-1L20 7l-4-4L4 15v5Z',
  lock: 'M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4m-3 5v2',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  camera: 'M4 7h4l2-3h4l2 3h4v13H4V7Zm12 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  home: 'm3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7',
  map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M6 18 18 6',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  external: 'M13 4h7v7m0-7L10 14M9 4H4v16h16v-5',
  logout: 'M10 4H4v16h6m4-13 5 5-5 5m-5-5h10',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2m11-14a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  pause: 'M9 5v14m6-14v14',
  play: 'm8 5 11 7-11 7V5Z',
  chevron: 'm7 10 5 5 5-5',
} as const;

export function ShellIcon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
