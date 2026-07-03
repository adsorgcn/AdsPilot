import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import Modal from '~/core/ui/Modal';
import Trans from '~/core/ui/Trans';

import { MultiFactorAuthSetupForm } from './mfa/MultiFactorAuthSetupForm';

interface MultiFactorAuthSetupModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

function MultiFactorAuthSetupModal({
  isOpen,
  setIsOpen,
}: MultiFactorAuthSetupModalProps) {
  const { t } = useTranslation();

  const onEnrollSuccess = useCallback(() => {
    setIsOpen(false);

    return toast.success(t(`profile:multiFactorSetupSuccess`));
  }, [setIsOpen, t]);

  return (
    <Modal
      closeButton={false}
      heading={<Trans i18nKey={'profile:setupMfaButtonLabel'} />}
      isOpen={isOpen}
      setIsOpen={setIsOpen}
    >
      <MultiFactorAuthSetupForm
        onCancel={() => setIsOpen(false)}
        onEnrolled={onEnrollSuccess}
      />
    </Modal>
  );
}

export default MultiFactorAuthSetupModal;
