import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  onConfirm: () => void;
  onCancel?: () => void;
  loading?: boolean;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
  loading = false
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'destructive':
        return {
          icon: <XCircle className="w-6 h-6 text-red-600" />,
          iconBg: 'bg-red-50',
          confirmClass: 'bg-red-600 hover:bg-red-700 text-white'
        };
      case 'success':
        return {
          icon: <CheckCircle className="w-6 h-6 text-green-600" />,
          iconBg: 'bg-green-50',
          confirmClass: 'bg-green-600 hover:bg-green-700 text-white'
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-yellow-600" />,
          iconBg: 'bg-yellow-50',
          confirmClass: 'bg-yellow-600 hover:bg-yellow-700 text-white'
        };
      default:
        return {
          icon: <Info className="w-6 h-6 text-blue-600" />,
          iconBg: 'bg-blue-50',
          confirmClass: 'ayur-button-hero'
        };
    }
  };

  const styles = getVariantStyles();

  const handleCancel = () => {
    onOpenChange(false);
    onCancel?.();
  };

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center space-x-3">
            <div className={cn('p-2 rounded-full', styles.iconBg)}>
              {styles.icon}
            </div>
            <AlertDialogTitle className="font-playfair">
              {title}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="mt-4 text-base">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <AlertDialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
          <AlertDialogCancel onClick={handleCancel} disabled={loading}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            disabled={loading}
            className={cn(styles.confirmClass, loading && 'opacity-50 cursor-not-allowed')}
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Processing...</span>
              </div>
            ) : (
              confirmText
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmationDialog;