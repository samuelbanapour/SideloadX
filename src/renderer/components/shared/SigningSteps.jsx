import React from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, Circle } from 'lucide-react';

const STEPS = [
  { id: 'extract', label: 'Extracting IPA' },
  { id: 'parse', label: 'Parsing metadata' },
  { id: 'entitlements', label: 'Preparing entitlements' },
  { id: 'clean', label: 'Cleaning signatures' },
  { id: 'profile', label: 'Applying provisioning profile' },
  { id: 'sign', label: 'Signing binary' },
  { id: 'verify', label: 'Verifying signature' },
  { id: 'package', label: 'Packaging IPA' },
  { id: 'complete', label: 'Complete' },
];

export default function SigningSteps({ currentStep, status }) {
  const currentIndex = STEPS.findIndex(s => s.id === currentStep);

  return (
    <div className="flex flex-col gap-2">
      {STEPS.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isPending = index > currentIndex;

        return (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
              isComplete ? 'text-success' :
              isCurrent ? 'text-white bg-surface-800' :
              'text-surface-500'
            }`}
          >
            {isComplete ? (
              <Check size={16} className="text-success" />
            ) : isCurrent ? (
              <Loader2 size={16} className="text-accent animate-spin" />
            ) : (
              <Circle size={16} className="text-surface-600" />
            )}
            <span className="font-medium">{step.label}</span>
            {isComplete && (
              <span className="ml-auto text-xs text-success">Done</span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
