// PaperSkeleton.jsx - Professional skeleton loading for past papers
import React from 'react';
import { motion } from 'framer-motion';
import { FiFileText } from 'react-icons/fi';

const shimmerAnimation = {
  initial: { backgroundPosition: '200% center' },
  animate: { backgroundPosition: '-200% center' },
  transition: { duration: 1.2, repeat: Infinity, ease: 'linear' }
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.005,
      delayChildren: 0.01
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.1 } }
};

export const PaperSkeleton = () => {
  return (
    <motion.div
      style={{
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        borderRadius: '8px',
        aspectRatio: '9/12',
        overflow: 'hidden',
        minHeight: '240px'
      }}
      {...shimmerAnimation}
    />
  );
};

export const PaperGridSkeleton = ({ count = 24 }) => {
  return (
    <motion.div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
        gap: '20px',
        padding: '20px'
      }}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {Array.from({ length: count }).map((_, i) => (
        <motion.div key={i} variants={itemVariants}>
          <PaperSkeleton />
          {/* Metadata skeleton */}
          <motion.div
            style={{
              marginTop: '12px',
              height: '12px',
              background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
              backgroundSize: '200% 100%',
              borderRadius: '4px',
              marginBottom: '8px'
            }}
            {...shimmerAnimation}
          />
          <motion.div
            style={{
              height: '10px',
              background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
              backgroundSize: '200% 100%',
              borderRadius: '4px',
              width: '80%'
            }}
            {...shimmerAnimation}
          />
        </motion.div>
      ))}
    </motion.div>
  );
};

export const LoadingSpinner = ({ size = 40, color = '#00a884' }) => {
  return (
    <motion.div
      style={{
        width: size,
        height: size,
        border: `4px solid ${color}20`,
        borderTop: `4px solid ${color}`,
        borderRadius: '50%',
        margin: '0 auto'
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    />
  );
};

export const PulseLoader = ({ text = 'Loading papers...' }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '40px 20px',
        minHeight: '300px'
      }}
    >
      <motion.div
        style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: '#00a884',
          boxShadow: '0 0 0 0 rgba(0, 168, 132, 0.7)'
        }}
        animate={{
          scale: [1, 1.2, 1],
          boxShadow: [
            '0 0 0 0 rgba(0, 168, 132, 0.7)',
            '0 0 0 10px rgba(0, 168, 132, 0)',
            '0 0 0 0 rgba(0, 168, 132, 0)'
          ]
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>{text}</p>
    </div>
  );
};

export const ProgressLoader = ({ progress = 50, text = 'Loading...' }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '40px 20px'
      }}
    >
      <motion.div
        style={{
          width: '200px',
          height: '6px',
          backgroundColor: '#e0e0e0',
          borderRadius: '3px',
          overflow: 'hidden'
        }}
      >
        <motion.div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #00a884, #00d9a3)',
            borderRadius: '3px'
          }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </motion.div>
      <p style={{ color: '#666', fontSize: '12px', margin: 0 }}>
        {text} {progress}%
      </p>
    </div>
  );
};

export const InfiniteScrollLoader = () => {
  return (
    <motion.div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '30px 20px',
        gap: '8px'
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#00a884'
          }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.15
          }}
        />
      ))}
    </motion.div>
  );
};

export const EmptyState = ({ icon: Icon = FiFileText, title = 'No papers found', message = 'Try adjusting your filters' }) => {
  return (
    <motion.div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '60px 20px',
        minHeight: '400px',
        color: '#999'
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Icon size={48} style={{ color: '#ddd' }} />
      <h3 style={{ margin: '0 0 8px 0', color: '#666' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: '14px' }}>{message}</p>
    </motion.div>
  );
};
