'use client';

import { useState } from 'react';
import { Phone, MessageSquare } from 'lucide-react';
import Trans from '~/core/ui/Trans';
import Button from '~/core/ui/Button';
import { Input } from '~/core/ui/Input';
import Modal from '~/core/ui/Modal';
import { useMutation } from '@tanstack/react-query';
import useSupabase from '~/core/hooks/use-supabase';
import { toast } from 'sonner';

export interface UpdatePhoneNumberFormProps {
  currentPhone: string | null;
  isModalOpen: boolean;
  onModalClose: () => void;
  onSuccess?: () => void;
}

function UpdatePhoneNumberForm({
  currentPhone,
  isModalOpen,
  onModalClose,
  onSuccess,
}: UpdatePhoneNumberFormProps) {
  const [phone, setPhone] = useState(currentPhone || '');
  const [verificationCode, setVerificationCode] = useState('');
  const [isPending, setIsPending] = useState(false);
  const client = useSupabase();
  
  const phoneUpdateMutation = useMutation({
    mutationFn: async (newPhone: string) => {

      const response = await client.auth.updateUser({
        phone: newPhone,
      });

      if (response.error) {
        throw response.error;
      }

      return response.data;
    },
    onSuccess: () => {
      toast.success('Phone number updated successfully.');
      onSuccess?.();
      onModalClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update phone number');
    },
    onSettled: () => {
      setIsPending(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsPending(true);

    try {
      await phoneUpdateMutation.mutateAsync(phone);
    } catch (error) {
      console.error('Phone update error:', error);
    }
  };

  return (
    <Modal
      heading={<Trans i18nKey={'profile:updatePhoneNumberTitle'} />}
      isOpen={isModalOpen}
      setIsOpen={onModalClose}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="phone" className="block text-sm font-medium mb-2">
            <Trans i18nKey={'profile:phoneNumber'} />
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter your phone number"
              className="pl-10"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="verificationCode" className="block text-sm font-medium mb-2">
            <Trans i18nKey={'profile:verificationCode'} />
          </label>
          <div className="relative">
            <MessageSquare className="absolute left-3 top-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="verificationCode"
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="Enter verification code"
              className="pl-10"
              required
            />
          </div>
        </div>

        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={onModalClose}
            disabled={isPending}
          >
            <Trans i18nKey={'common:cancel'} />
          </Button>
          <Button
            type="submit"
            variant="default"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Trans i18nKey={'common:updating'} />
                <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-t-2" />
              </>
            ) : (
              <Trans i18nKey={'profile:updatePhoneNumber'} />
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default UpdatePhoneNumberForm;