'use client';

import type { FormEvent, MouseEventHandler } from 'react';

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import Image from 'next/image';
import { CloudArrowUpIcon, XMarkIcon } from '@heroicons/react/24/outline';

import Label from '~/core/ui/Label';
import If from '~/core/ui/If';
import IconButton from '~/core/ui/IconButton';
import classNames from 'clsx';

type Props = Omit<React.InputHTMLAttributes<unknown>, 'value'> & {
  image?: string | null;
  onClear?: () => void;
  onValueChange?: (props: { image: string; file: File }) => void;
  visible?: boolean;
};

const IMAGE_SIZE = 22;

const ImageUploadInput = forwardRef<React.ElementRef<'input'>, Props>(
  function ImageUploadInputComponent(
    {
      children,
      image,
      onClear,
      onInput,
      onValueChange,
      visible = true,
      ...props
    },
    forwardedRef,
  ) {
    const localRef = useRef<HTMLInputElement>();

    const [state, setState] = useState({
      image,
      fileName: '',
    });

    const onInputChange = useCallback(
      (e: FormEvent<HTMLInputElement>) => {
        e.preventDefault();

        const files = e.currentTarget.files;

        if (files?.length) {
          const file = files[0];
          const data = URL.createObjectURL(file);

          setState({
            image: data,
            fileName: file.name,
          });

          if (onValueChange) {
            onValueChange({
              image: data,
              file,
            });
          }
        }

        if (onInput) {
          onInput(e);
        }
      },
      [onInput, onValueChange],
    );

    const onRemove = useCallback(() => {
      setState({
        image: '',
        fileName: '',
      });

      if (localRef.current) {
        localRef.current.value = '';
      }

      if (onClear) {
        onClear();
      }
    }, [onClear]);

    const imageRemoved: MouseEventHandler = useCallback(
      (e) => {
        e.preventDefault();

        onRemove();
      },
      [onRemove],
    );

    const setRef = useCallback(
      (input: HTMLInputElement) => {
        localRef.current = input;

        if (typeof forwardedRef === 'function') {
          forwardedRef(localRef.current);
        }
      },
      [forwardedRef],
    );

    useEffect(() => {
      setState((state) => ({ ...state, image }));
    }, [image]);

    useEffect(() => {
      if (!image) {
        onRemove();
      }
    }, [image, onRemove]);

    const Input = () => (
      <input
        {...props}
        className={classNames('hidden', props.className)}
        ref={setRef}
        type={'file'}
        onInput={onInputChange}
        accept="image/*"
        aria-labelledby={'image-upload-input'}
      />
    );

    if (!visible) {
      return <Input />;
    }

    return (
      <label
        id={'image-upload-input'}
        tabIndex={0}
        className={`relative cursor-pointer border-dashed outline-none ring-offset-2 transition-all focus:ring-2 ring-primary ring-offset-background
         flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <Input />

        <div className={'flex items-center space-x-4'}>
          <div className={'flex'}>
            <If condition={!state.image}>
              <CloudArrowUpIcon
                className={'h-5 text-gray-500 dark:text-dark-500'}
              />
            </If>

            <If condition={state.image}>
              <Image
                loading={'lazy'}
                style={{
                  width: IMAGE_SIZE,
                  height: IMAGE_SIZE,
                }}
                className={'object-contain'}
                width={IMAGE_SIZE}
                height={IMAGE_SIZE}
                src={state.image as string}
                alt={props.alt ?? 'Uploaded image'}
                unoptimized
              />
            </If>
          </div>

          <If condition={!state.image}>
            <div className={'flex flex-auto'}>
              <Label as={'span'} className={'cursor-pointer text-xs'}>
                {children}
              </Label>
            </div>
          </If>

          <If condition={state.image as string}>
            <div className={'flex flex-auto'}>
              <If
                condition={state.fileName}
                fallback={
                  <Label
                    as={'span'}
                    className={'cursor-pointer truncate text-xs'}
                  >
                    {children}
                  </Label>
                }
              >
                <Label as="span" className={'truncate text-xs'}>
                  {state.fileName}
                </Label>
              </If>
            </div>
          </If>

          <If condition={state.image}>
            <IconButton className={'!h-5 !w-5'} onClick={imageRemoved}>
              <XMarkIcon className="h-4" />
            </IconButton>
          </If>
        </div>
      </label>
    );
  },
);
export default ImageUploadInput;
