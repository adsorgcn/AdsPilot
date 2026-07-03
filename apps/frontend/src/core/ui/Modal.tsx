'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { Close as DialogPrimitiveClose } from '@radix-ui/react-dialog';

import IconButton from '~/core/ui/IconButton';
import If from '~/core/ui/If';
import Button from '~/core/ui/Button';
import Trans from '~/core/ui/Trans';

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '~/core/ui/Dialog';

type ControlledOpenProps = {
  isOpen?: boolean;
  setIsOpen?: (isOpen: boolean) => unknown;
};

type TriggerProps = {
  Trigger?: React.ReactNode;
};

type Props = React.PropsWithChildren<
  {
    heading: string | React.ReactNode;
    closeButton?: boolean;
  } & (ControlledOpenProps & TriggerProps)
>;

const Modal: React.FC<Props> & {
  CancelButton: typeof CancelButton;
} = ({ closeButton, heading, children, ...props }) => {
  const isControlled = 'isOpen' in props;
  const useCloseButton = closeButton ?? true;

  return (
    <Dialog open={props.isOpen} onOpenChange={props.setIsOpen}>
      <If condition={props.Trigger}>
        <DialogTrigger asChild>{props.Trigger}</DialogTrigger>
      </If>

      <DialogContent>
        <div className={'flex flex-col space-y-4'}>
          <div className="flex items-center">
            <DialogTitle className="flex w-full text-xl font-semibold text-current">
              <span className={'max-w-[90%] truncate'}>{heading}</span>
            </DialogTitle>
          </div>

          <div className="relative">{children}</div>

          <If condition={useCloseButton}>
            <DialogPrimitiveClose asChild>
              <IconButton
                className={'absolute top-0 right-4 flex items-center'}
                label={'Close Modal'}
                onClick={() => {
                  if (isControlled && props.setIsOpen) {
                    props.setIsOpen(false);
                  }
                }}
              >
                <XMarkIcon className={'h-6'} />
                <span className="sr-only">Close</span>
              </IconButton>
            </DialogPrimitiveClose>
          </If>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Modal;

function CancelButton<Props extends React.ButtonHTMLAttributes<unknown>>(
  props: Props,
) {
  return (
    <Button
      type={'button'}
      data-cy={'close-modal-button'}
      variant={'ghost'}
      {...props}
    >
      <Trans i18nKey={'common:cancel'} />
    </Button>
  );
}

Modal.CancelButton = CancelButton;

export { CancelButton };
