import React from 'react';

/**
 * VerificationBadge Component - Scalloped Seal with Black Checkmark
 * Displays verification badge with prominent spikes based on user subscription tier
 * 
 * Props:
 * - tier: 'basic' | 'premium' | 'premium_pro' (default: 'basic')
 * - size: 'sm' | 'md' | 'lg' (default: 'md')
 * - showLabel: boolean (default: false)
 * - showTooltip: boolean (default: true)
 */

// SVG component for the scalloped seal with prominent spikes
const ScallopedBadge = ({ color, size }) => {
  const numSpikes = 10; // Number of prominent spikes - fewer for more visibility
  const radius = size / 2 - 0.5;
  const spikeLength = size / 3.2; // Balanced spike length - visible but not too long
  const centerRadius = radius * 0.55; // Smaller center for more spike room
  
  // Generate path with prominent spikes
  let pathData = '';
  
  for (let i = 0; i < numSpikes; i++) {
    const angle = (i * 2 * Math.PI) / numSpikes;
    const nextAngle = ((i + 1) * 2 * Math.PI) / numSpikes;
    const midAngle = (angle + nextAngle) / 2;
    
    // Inner point
    const ix = size / 2 + centerRadius * Math.cos(angle);
    const iy = size / 2 + centerRadius * Math.sin(angle);
    
    // Spike point (prominent)
    const sx = size / 2 + spikeLength * Math.cos(midAngle);
    const sy = size / 2 + spikeLength * Math.sin(midAngle);
    
    // Next inner point
    const nix = size / 2 + centerRadius * Math.cos(nextAngle);
    const niy = size / 2 + centerRadius * Math.sin(nextAngle);
    
    if (i === 0) {
      pathData += `M ${ix} ${iy}`;
    } else {
      pathData += `L ${ix} ${iy}`;
    }
    
    pathData += ` L ${sx} ${sy} L ${nix} ${niy}`;
  }
  
  pathData += ' Z';
  
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', overflow: 'visible' }}>
      <path
        d={pathData}
        fill={color}
        stroke={color}
        strokeWidth="0.5"
        strokeLinejoin="miter"
      />
    </svg>
  );
};

const VerificationBadge = ({ 
  tier = 'basic', 
  size = 'md', 
  showLabel = false,
  showTooltip = true 
}) => {
  const sizeStyles = {
    sm: { badgeSize: 14, iconSize: 8 },
    md: { badgeSize: 18, iconSize: 10 },
    lg: { badgeSize: 22, iconSize: 12 }
  };

  const tierStyles = {
    basic: {
      bgColor: 'transparent',
      iconColor: '#8696a0',
      label: 'Basic',
      description: 'Standard user'
    },
    premium: {
      bgColor: '#1DA1F2',
      iconColor: 'white',
      label: 'Premium',
      description: 'Premium member with enhanced features'
    },
    premium_pro: {
      bgColor: '#FFB81C',
      iconColor: 'white',
      label: 'Premium Pro',
      description: 'Premium Pro member with all features'
    }
  };

  const style = sizeStyles[size] || sizeStyles.md;
  const tierStyle = tierStyles[tier] || tierStyles.basic;

  // Don't show badge for basic tier unless explicitly requested
  if (tier === 'basic' && !showLabel) {
    return null;
  }

  // Only show badge for premium and premium_pro
  if (tier === 'basic') {
    return null;
  }

  // Create SVG path for checkmark inside the badge
  const createCheckmarkPath = (iconSize) => {
    if (iconSize === 8) {
      return "M3.5 5L5.5 7L8 4.5"; // Small
    } else if (iconSize === 10) {
      return "M4 6L6 8L9.5 4.5"; // Medium
    } else {
      return "M5 7.5L7.5 10L11.5 5.5"; // Large
    }
  };

  const badgeContent = (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
      title={tierStyle.label}
    >
      {/* Scalloped seal background */}
      <div style={{
        position: 'absolute',
        width: style.badgeSize,
        height: style.badgeSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <ScallopedBadge color={tierStyle.bgColor} size={style.badgeSize} />
      </div>
      
      {/* Checkmark in the center */}
      <svg
        width={style.iconSize}
        height={style.iconSize}
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'block',
        }}
      >
        <path
          d={createCheckmarkPath(style.iconSize)}
          stroke="black"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );

  if (showTooltip && tier !== 'basic') {
    return (
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        {badgeContent}
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 8,
            padding: '6px 10px',
            backgroundColor: '#1a1a1a',
            color: tierStyle.bgColor,
            borderRadius: 4,
            fontSize: 10,
            whiteSpace: 'nowrap',
            border: `1px solid ${tierStyle.bgColor}`,
            pointerEvents: 'none',
            opacity: 0,
            transition: 'opacity 0.2s',
            zIndex: 1000
          }}
          className="tooltip-text"
        >
          {tierStyle.description}
        </div>
      </div>
    );
  }

  return badgeContent;
};

export default VerificationBadge;
