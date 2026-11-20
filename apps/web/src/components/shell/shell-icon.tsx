import type { SVGProps } from 'react';

const paths = {
  box: 'M3 7l9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4m-9 4v10M7 5l10 4',
  refresh: 'M20 11a8 8 0 1 0-2 6M20 4v7h-7',
  check: 'm5 12 4 4L19 6',
  alert: 'M12 3 2 21h20L12 3Zm0 6v5m0 3v1',
  edit: 'm15 5 4 4M4 20l4-1L20 7l-4-4L4 15v5Z',
  lock: 'M6 10h12v11H6V10Zm3 0V6a3 3 0 0 1 6 0v4m-3 5v2',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  camera: 'M4 7h4l2-3h4l2 3h4v13H4V7Zm12 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  home: 'm3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7',
  map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16',
  target:
    'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM12 2v3m0 14v3M2 12h3m14 0h3',
  pin: 'M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0ZM14.5 10a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5',
  minus: 'M5 12h14',
  plus: 'M12 5v14M5 12h14',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M6 18 18 6',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  external: 'M13 4h7v7m0-7L10 14M9 4H4v16h16v-5',
  logout: 'M10 4H4v16h6m4-13 5 5-5 5m-5-5h10',
  user: 'M20 21v-2a7 7 0 0 0-14 0v2m11-14a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  pause: 'M9 5v14m6-14v14',
  play: 'm8 5 11 7-11 7V5Z',
  chevron: 'm7 10 5 5 5-5',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
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
