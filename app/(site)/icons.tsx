const P: Record<string, React.ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  scale: (
    <>
      <path d="M12 3v18M7 21h10M5 7h14" />
      <path d="m5 7-3 7a3 3 0 0 0 6 0L5 7ZM19 7l-3 7a3 3 0 0 0 6 0l-3-7Z" />
    </>
  ),
  cart: (
    <>
      <path d="M3 4h3l2.2 10.2a1 1 0 0 0 1 .8h8.4a1 1 0 0 0 1-.8L20 8H7" />
      <circle cx="10" cy="19.5" r="1.4" />
      <circle cx="17" cy="19.5" r="1.4" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5M12 14.5v2.5" />
    </>
  ),
  box: (
    <>
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  home: <path d="m3 11 9-7.5 9 7.5M5.5 9.5V20h13V9.5M10 20v-5.5h4V20" />,
  key: (
    <>
      <circle cx="8" cy="9" r="4" />
      <path d="M11 11.5 20 20M16 16l2.5-2.5M18.5 18.5 20.5 16.5" />
    </>
  ),
  store: <path d="M4 9 5.5 4h13L20 9M4 9h16M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0A2.7 2.7 0 0 0 20 9M5.5 12v8h13v-8M10 20v-4.5h4V20" />,
  shop: <path d="M3 10h18M5 10v10h14V10M3 10l2-5h14l2 5M9 20v-5h6v5" />,
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 21h4" />,
  chat: <path d="M4 5h16v11H9.5L5 20v-4H4V5Z" />,
  check: <path d="m4.5 12.5 5 5 10-11" />,
};

export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {P[name]}
    </svg>
  );
}
