import React from 'react';
import { UsagePolicy } from './tabs/UsagePolicy';

export default function UsagePage() {
  return (
    <UsagePolicy
      onBack={() => {
        if (typeof window !== 'undefined' && window.history?.length) {
          window.history.back();
        }
      }}
    />
  );
}
