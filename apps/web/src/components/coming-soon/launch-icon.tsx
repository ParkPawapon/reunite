type IconName = 'pause' | 'play' | 'left' | 'right' | 'reset' | 'drag';
export function LaunchIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    pause: 'M8 5v14m8-14v14',
    play: 'm8 5 11 7-11 7Z',
    left: 'm14 6-6 6 6 6',
    right: 'm10 6 6 6-6 6',
    reset: 'M4 11a8 8 0 1 1 2 7M4 5v6h6',
    drag: 'M8 12V6a2 2 0 0 1 4 0v6m0-4a2 2 0 0 1 4 0v4m0-1a2 2 0 0 1 4 0v6c0 4-2 5-6 5h-2c-2 0-3-2-4-3l-4-5a2 2 0 0 1 3-2l1 1',
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
