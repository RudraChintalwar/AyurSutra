import React from 'react';
import { Loader2, Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ayurvedic' | 'minimal';
  className?: string;
  text?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  variant = 'default', 
  className,
  text 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8'
  };

  const renderSpinner = () => {
    switch (variant) {
      case 'ayurvedic':
        return (
          <div className="flex flex-col items-center space-y-3">
            <div className="relative">
              <div className={cn(
                'animate-spin rounded-full border-2 border-primary/20 border-t-primary',
                sizeClasses[size]
              )} />
              <Leaf className={cn(
                'absolute inset-0 m-auto text-primary animate-pulse',
                size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'
              )} />
            </div>
            {text && <p className="text-sm text-muted-foreground animate-pulse">{text}</p>}
          </div>
        );
      case 'minimal':
        return (
          <div className={cn(
            'animate-spin rounded-full border-2 border-current border-t-transparent opacity-60',
            sizeClasses[size],
            className
          )} />
        );
      default:
        return (
          <div className="flex flex-col items-center space-y-2">
            <Loader2 className={cn('animate-spin text-primary', sizeClasses[size], className)} />
            {text && <p className="text-sm text-muted-foreground">{text}</p>}
          </div>
        );
    }
  };

  return renderSpinner();
};

export default LoadingSpinner;