'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  XMarkIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  QuestionMarkCircleIcon,
  ArrowDownTrayIcon,
  EyeIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { cn } from '~/lib/utils';

// 模态框类型
export type ModalType = 'info' | 'success' | 'warning' | 'error' | 'question' | 'custom';

// 模态框大小
export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

// 基础模态框属性
interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  type?: ModalType;
  size?: ModalSize;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  preventClose?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// 基础模态框组件
export const Modal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  type = 'info',
  size = 'md',
  closeOnOverlay = true,
  closeOnEscape = true,
  showCloseButton = true,
  preventClose = false,
  className = '',
  children,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // 获取模态框样式
  const getModalStyles = () => {
    const sizeStyles = {
      xs: 'max-w-sm',
      sm: 'max-w-md',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
      xl: 'max-w-4xl',
      full: 'max-w-full mx-4'
    };

    const typeStyles = {
      info: 'border-blue-200 bg-blue-50',
      success: 'border-green-200 bg-green-50',
      warning: 'border-yellow-200 bg-yellow-50',
      error: 'border-red-200 bg-red-50',
      question: 'border-purple-200 bg-purple-50',
      custom: 'border-gray-200 bg-white'
    };

    const iconColors = {
      info: 'text-blue-600',
      success: 'text-green-600',
      warning: 'text-yellow-600',
      error: 'text-red-600',
      question: 'text-purple-600',
      custom: 'text-gray-600'
    };

    return {
      size: sizeStyles[size],
      type: typeStyles[type],
      iconColor: iconColors[type]
    };
  };

  // 获取图标
  const getIcon = () => {
    const { iconColor } = getModalStyles();
    const iconClass = `w-6 h-6 ${iconColor}`;

    switch (type) {
      case 'success':
        return <CheckCircleIcon className={iconClass} />;
      case 'warning':
        return <ExclamationTriangleIcon className={iconClass} />;
      case 'error':
        return <ExclamationTriangleIcon className={iconClass} />;
      case 'question':
        return <QuestionMarkCircleIcon className={iconClass} />;
      case 'info':
      default:
        return <InformationCircleIcon className={iconClass} />;
    }
  };

  // 处��关闭
  const handleClose = useCallback(() => {
    if (!preventClose) {
      onClose();
    }
  }, [onClose, preventClose]);

  // 处理键盘事件
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeOnEscape) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // 保存当前焦点元素
      previousFocusRef.current = document.activeElement as HTMLElement;
      // 防止背景滚动
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
      // 恢复焦点
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, closeOnEscape, handleClose]);

  // 处理焦点管理
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>;

      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* 背景遮罩 */}
        <motion.div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeOnOverlay ? handleClose : undefined}
        />

        {/* 模态框内容 */}
        <motion.div
          ref={modalRef}
          className={cn(
            'relative w-full rounded-xl border-2 shadow-2xl',
            getModalStyles().size,
            getModalStyles().type,
            className
          )}
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
          aria-describedby={description ? 'modal-description' : undefined}
        >
          {/* 模态框头部 */}
          {(title || type !== 'custom') && (
            <div className="flex items-center gap-3 p-6 border-b border-gray-200">
              {type !== 'custom' && getIcon()}
              {title && (
                <h3 id="modal-title" className="text-lg font-semibold text-gray-900">
                  {title}
                </h3>
              )}
              {showCloseButton && !preventClose && (
                <button
                  onClick={handleClose}
                  className="ml-auto p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="关闭模态框"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          )}

          {/* 模态框描述 */}
          {description && (
            <div className="px-6 pt-4 pb-0">
              <p id="modal-description" className="text-gray-600">
                {description}
              </p>
            </div>
          )}

          {/* 模态框内容 */}
          <div className="p-6">
            {children}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

// 确认对话框属性
interface ConfirmModalProps extends Omit<BaseModalProps, 'children'> {
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  confirmButtonVariant?: 'primary' | 'danger' | 'success';
  loading?: boolean;
}

// 确认对话框组件
export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
  confirmButtonVariant = 'primary',
  loading = false,
  ...modalProps
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (isSubmitting || loading) return;

    setIsSubmitting(true);
    try {
      await onConfirm?.();
      modalProps.onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (isSubmitting || loading) return;
    onCancel?.();
    modalProps.onClose();
  };

  const getConfirmButtonClass = () => {
    const baseClass = 'px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50';
    switch (confirmButtonVariant) {
      case 'danger':
        return `${baseClass} bg-red-600 text-white hover:bg-red-700`;
      case 'success':
        return `${baseClass} bg-green-600 text-white hover:bg-green-700`;
      default:
        return `${baseClass} bg-blue-600 text-white hover:bg-blue-700`;
    }
  };

  return (
    <Modal {...modalProps}>
      <div className="space-y-6">
        <p className="text-gray-700 leading-relaxed">{message}</p>

        <div className="flex justify-end gap-3">
          <motion.button
            onClick={handleCancel}
            disabled={isSubmitting || loading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            whileHover={{ scale: (isSubmitting || loading) ? 1 : 1.02 }}
            whileTap={{ scale: (isSubmitting || loading) ? 1 : 0.98 }}
          >
            {cancelText}
          </motion.button>
          <motion.button
            onClick={handleConfirm}
            disabled={isSubmitting || loading}
            className={getConfirmButtonClass()}
            whileHover={{ scale: (isSubmitting || loading) ? 1 : 1.02 }}
            whileTap={{ scale: (isSubmitting || loading) ? 1 : 0.98 }}
          >
            {isSubmitting || loading ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin inline mr-2" />
                处理中...
              </>
            ) : (
              confirmText
            )}
          </motion.button>
        </div>
      </div>
    </Modal>
  );
};

// 图片预览模态框属性
interface ImagePreviewModalProps extends Omit<BaseModalProps, 'children' | 'size'> {
  images: string[];
  initialIndex?: number;
  showThumbnails?: boolean;
  allowDownload?: boolean;
  onImageChange?: (index: number) => void;
}

// 图片预览模态框组件
export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  images,
  initialIndex = 0,
  showThumbnails = true,
  allowDownload = true,
  onImageChange,
  ...modalProps
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [_isLoading, setIsLoading] = useState(false);

  const currentImage = images[currentIndex];

  const goToPrevious = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    setCurrentIndex(newIndex);
    onImageChange?.(newIndex);
  };

  const goToNext = () => {
    const newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    setCurrentIndex(newIndex);
    onImageChange?.(newIndex);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentImage;
    link.download = `image-${currentIndex + 1}.jpg`;
    link.click();
  };

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowLeft':
        goToPrevious();
        break;
      case 'ArrowRight':
        goToNext();
        break;
      case 'Escape':
        modalProps.onClose();
        break;
    }
  }, [currentIndex, modalProps.onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Modal {...modalProps} size="full" closeOnOverlay={true}>
      <div className="relative h-full flex flex-col">
        {/* 工具栏 */}
        <div className="flex items-center justify-between p-4 bg-gray-900 text-white">
          <div className="flex items-center gap-4">
            <span className="text-sm">
              {currentIndex + 1} / {images.length}
            </span>
            {images[currentIndex] && (
              <span className="text-sm text-gray-300 truncate max-w-xs">
                {images[currentIndex].split('/').pop()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {allowDownload && (
              <motion.button
                onClick={handleDownload}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                title="下载图片"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
              </motion.button>
            )}
            <button
              onClick={modalProps.onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 图片展示区域 */}
        <div className="flex-1 relative flex items-center justify-center bg-black">
          {images.length > 1 && (
            <>
              {/* 左箭头 */}
              <motion.button
                onClick={goToPrevious}
                className="absolute left-4 p-3 bg-white/10 backdrop-blur-sm text-white rounded-full hover:bg-white/20 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </motion.button>

              {/* 右箭头 */}
              <motion.button
                onClick={goToNext}
                className="absolute right-4 p-3 bg-white/10 backdrop-blur-sm text-white rounded-full hover:bg-white/20 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </motion.button>
            </>
          )}

          {/* 图片 */}
          <div className="max-w-full max-h-full flex items-center justify-center">
            {currentImage ? (
              <img
                src={currentImage}
                alt={`Preview ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain"
                onLoad={() => setIsLoading(false)}
                onError={() => setIsLoading(false)}
              />
            ) : (
              <div className="text-white text-center">
                <EyeIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>无法加载图片</p>
              </div>
            )}
          </div>
        </div>

        {/* 缩略图 */}
        {showThumbnails && images.length > 1 && (
          <div className="p-4 bg-gray-900 border-t border-gray-800">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((image, index) => (
                <motion.button
                  key={index}
                  onClick={() => {
                    setCurrentIndex(index);
                    onImageChange?.(index);
                  }}
                  className={cn(
                    'flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all',
                    index === currentIndex
                      ? 'border-blue-500 scale-110'
                      : 'border-gray-600 hover:border-gray-400'
                  )}
                  whileHover={{ scale: index === currentIndex ? 1.1 : 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <img
                    src={image}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </motion.button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// 侧边栏抽屉属性
interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  position?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  title?: string;
  overlay?: boolean;
  closeOnOverlay?: boolean;
  className?: string;
  children?: React.ReactNode;
}

// 侧边栏抽屉组件
export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  position = 'right',
  size = 'md',
  title,
  overlay = true,
  closeOnOverlay = true,
  className = '',
  children,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  const getSizeStyles = () => {
    const sizeMap = {
      sm: 'w-80',
      md: 'w-96',
      lg: 'w-[28rem]',
      xl: 'w-[32rem]'
    };
    return sizeMap[size];
  };

  const getPositionStyles = () => {
    return position === 'left' ? 'left-0' : 'right-0';
  };

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const drawerContent = (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
        {/* 背景遮罩 */}
        {overlay && (
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeOnOverlay ? onClose : undefined}
          />
        )}

        {/* 抽屉内容 */}
        <motion.div
          ref={drawerRef}
          className={cn(
            'absolute top-0 h-full bg-white shadow-2xl',
            getSizeStyles(),
            getPositionStyles(),
            className
          )}
          initial={{ x: position === 'left' ? '-100%' : '100%' }}
          animate={{ x: 0 }}
          exit={{ x: position === 'left' ? '-100%' : '100%' }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
          {/* 抽屉头部 */}
          {title && (
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* 抽屉内容 */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return createPortal(drawerContent, document.body);
};

// 模态框管理Hook
export const useModal = () => {
  const [modals, setModals] = useState<Map<string, React.ReactNode>>(new Map());

  const openModal = useCallback((id: string, component: React.ReactNode) => {
    setModals(prev => new Map(prev).set(id, component));
  }, []);

  const closeModal = useCallback((id: string) => {
    setModals(prev => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  const closeAllModals = useCallback(() => {
    setModals(new Map());
  }, []);

  const ModalRenderer = () => (
    <>
      {Array.from(modals.entries()).map(([id, component]) => (
        <React.Fragment key={id}>{component}</React.Fragment>
      ))}
    </>
  );

  return {
    openModal,
    closeModal,
    closeAllModals,
    ModalRenderer,
    hasOpenModals: modals.size > 0
  };
};

export default Modal;