

export const ProcessVisual = () => (
  <svg viewBox="0 0 200 100" className="w-full h-32 text-blue-400">
    <defs>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    <rect x="20" y="30" width="40" height="40" rx="4" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="2" />
    <rect x="140" y="30" width="40" height="40" rx="4" fill="currentColor" opacity="0.2" stroke="currentColor" strokeWidth="2" />
    <circle cx="100" cy="50" r="15" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2">
      <animateTransform attributeName="transform" type="rotate" from="0 100 50" to="360 100 50" dur="3s" repeatCount="indefinite" />
    </circle>
    <circle cx="100" cy="50" r="8" fill="currentColor" opacity="0.5" />
    <path d="M 65 50 L 80 50" stroke="currentColor" strokeWidth="2" markerEnd="url(#arrow)" />
    <path d="M 120 50 L 135 50" stroke="currentColor" strokeWidth="2" markerEnd="url(#arrow)" />
    
    <circle cx="40" cy="50" r="4" fill="white">
      <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
    </circle>
    <circle cx="160" cy="50" r="4" fill="white">
      <animate attributeName="opacity" values="0;1;0" dur="2s" begin="1s" repeatCount="indefinite" />
    </circle>
  </svg>
);

export const DatabaseVisual = () => (
  <svg viewBox="0 0 200 100" className="w-full h-32 text-green-400">
    <ellipse cx="100" cy="25" rx="30" ry="10" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="2" />
    <path d="M 70 25 V 75 A 30 10 0 0 0 130 75 V 25" fill="none" stroke="currentColor" strokeWidth="2" />
    <ellipse cx="100" cy="75" rx="30" ry="10" fill="currentColor" opacity="0.1" />
    
    <path d="M 70 50 A 30 10 0 0 0 130 50" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5" />
    
    <rect x="85" y="0" width="30" height="10" fill="white" opacity="0.8">
      <animate attributeName="y" values="0;40;80;40;0" dur="3s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0;0.8;0" dur="3s" repeatCount="indefinite" />
    </rect>
  </svg>
);

export const UIVisual = () => (
  <svg viewBox="0 0 200 100" className="w-full h-32 text-purple-400">
    <rect x="40" y="10" width="120" height="80" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
    <rect x="40" y="10" width="120" height="15" rx="4" fill="currentColor" opacity="0.2" />
    
    <rect x="50" y="35" width="40" height="20" rx="2" fill="currentColor" opacity="0.1" />
    <rect x="100" y="35" width="50" height="20" rx="2" fill="currentColor" opacity="0.1" />
    
    <rect x="50" y="65" width="100" height="15" rx="2" fill="currentColor" opacity="0.3">
        <animate attributeName="width" values="100;90;100" dur="4s" repeatCount="indefinite" />
    </rect>
    
    <circle cx="150" cy="80" r="5" fill="white" opacity="0">
       <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" />
       <animate attributeName="cx" values="50;150" dur="1.5s" repeatCount="indefinite" />
       <animate attributeName="cy" values="45;80" dur="1.5s" repeatCount="indefinite" />
    </circle>
  </svg>
);

export const ApiVisual = () => (
  <svg viewBox="0 0 200 100" className="w-full h-32 text-orange-400">
    <circle cx="40" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
    <circle cx="160" cy="50" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
    
    <path d="M 65 40 L 135 40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4">
       <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1s" repeatCount="indefinite" />
    </path>
    <path d="M 135 60 L 65 60" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4">
       <animate attributeName="stroke-dashoffset" from="0" to="100" dur="1s" repeatCount="indefinite" />
    </path>
    
    <text x="32" y="54" fontSize="12" fill="currentColor" className="font-mono">C</text>
    <text x="152" y="54" fontSize="12" fill="currentColor" className="font-mono">S</text>
  </svg>
);

export const LogicVisual = () => (
  <svg viewBox="0 0 200 100" className="w-full h-32 text-yellow-400">
    <path d="M 50 50 L 80 20 L 110 50 L 80 80 Z" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M 20 50 L 50 50" stroke="currentColor" strokeWidth="2" />
    
    <path d="M 110 50 L 140 20" stroke="currentColor" strokeWidth="2" />
    <path d="M 110 50 L 140 80" stroke="currentColor" strokeWidth="2" />
    
    <circle cx="80" cy="50" r="5" fill="currentColor">
       <animate attributeName="fill" values="#facc15;#ffffff;#facc15" dur="1s" repeatCount="indefinite" />
    </circle>
  </svg>
);
