// Minimal stroke icons (currentColor). No emoji — these carry the category identity.

function Svg({ size = 18, children, ...props }) {
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
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

// Appliance — a fridge: tall body, a divider, two short handles.
export function ApplianceIcon(props) {
  return (
    <Svg {...props}>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <line x1="6" y1="10" x2="18" y2="10" />
      <line x1="9" y1="6" x2="9" y2="8" />
      <line x1="9" y1="13" x2="9" y2="16" />
    </Svg>
  );
}

// Furniture — a sofa: backrest, seat, two legs.
export function FurnitureIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" />
      <rect x="3" y="11" width="18" height="6" rx="2" />
      <line x1="6" y1="17" x2="6" y2="20" />
      <line x1="18" y1="17" x2="18" y2="20" />
    </Svg>
  );
}

// Tag — generic marker for uncategorized items.
export function TagIcon(props) {
  return (
    <Svg {...props}>
      <path d="M4 12V5a1 1 0 0 1 1-1h7l8 8-8 8-8-8z" />
      <circle cx="8" cy="8" r="1.2" />
    </Svg>
  );
}

export function CategoryIcon({ category, ...props }) {
  if (category === 'appliance') return <ApplianceIcon {...props} />;
  if (category === 'furniture') return <FurnitureIcon {...props} />;
  return <TagIcon {...props} />;
}
