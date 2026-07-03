import Image from 'next/image';
import React, { useEffect, useState } from 'react';

import Alert from '~/core/ui/Alert';
import Modal from '~/core/ui/Modal';
import Trans from '~/core/ui/Trans';

import { useEnrollFactor } from './useMfaSetup';
import { FactorNameForm } from './FactorNameForm';

interface FactorQrCodeProps {
  onCancel: () => void;
  onSetFactorId: React.Dispatch<React.SetStateAction<string | undefined>>;
}

export function FactorQrCode({ onSetFactorId, onCancel }: FactorQrCodeProps) {
  const { mutateAsync: enrollFactor } = useEnrollFactor();
  const [error, setError] = useState(false);

  const [factor, setFactor] = useState({
    name: '',
    qrCode: '',
  });

  const factorName = factor.name;

  useEffect(() => {
    if (!factorName) {
      return;
    }

    (async () => {
      try {
        const data = await enrollFactor(factorName);

        if (!data) {
          return setError(true);
        }

        // set image
        setFactor((factor) => {
          return {
            ...factor,
            qrCode: data.totp.qr_code,
          };
        });

        // dispatch event to set factor ID
        onSetFactorId(data.id);
      } catch (e) {
        setError(true);
      }
    })();
  }, [onSetFactorId, factorName, enrollFactor]);

  if (error) {
    return (
      <div className={'flex w-full flex-col space-y-2'}>
        <Alert type={'error'}>
          <Trans i18nKey={'profile:qrCodeError'} />
        </Alert>

        <Modal.CancelButton onClick={onCancel} />
      </div>
    );
  }

  if (!factorName) {
    return (
      <FactorNameForm
        onCancel={onCancel}
        onSetFactorName={(name) => {
          setFactor((factor) => ({ ...factor, name }));
        }}
      />
    );
  }

  return (
    <div className={'flex flex-col space-y-4'}>
      <p>
        <span className={'text-base'}>
          <Trans i18nKey={'profile:multiFactorModalHeading'} />
        </span>
      </p>

      <div className={'flex justify-center'}>
        <Image
          alt={'QR Code'}
          src={factor.qrCode}
          width={160}
          height={160}
        />
      </div>
    </div>
  );
}
