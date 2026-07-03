import React from 'react';

import Button from '~/core/ui/Button';
import TextField from '~/core/ui/TextField';
import Modal from '~/core/ui/Modal';
import Trans from '~/core/ui/Trans';

interface FactorNameFormProps {
  onSetFactorName: (name: string) => void;
  onCancel: () => void;
}

export function FactorNameForm({
  onSetFactorName,
  onCancel,
}: FactorNameFormProps) {
  const inputName = 'factorName';

  return (
    <form
      className={'w-full'}
      onSubmit={(event) => {
        event.preventDefault();

        const data = new FormData(event.currentTarget);
        const name = data.get(inputName) as string;

        onSetFactorName(name);
      }}
    >
      <div className={'flex flex-col space-y-4'}>
        <TextField.Label>
          <Trans i18nKey={'profile:factorNameLabel'} />

          <TextField.Input autoComplete={'off'} required name={inputName} />

          <TextField.Hint>
            <Trans i18nKey={'profile:factorNameHint'} />
          </TextField.Hint>
        </TextField.Label>

        <div className={'flex justify-end space-x-2'}>
          <Modal.CancelButton onClick={onCancel} />

          <Button type={'submit'}>
            <Trans i18nKey={'profile:factorNameSubmitLabel'} />
          </Button>
        </div>
      </div>
    </form>
  );
}
