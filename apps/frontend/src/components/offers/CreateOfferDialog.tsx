interface CreateOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateOfferDialog({ open, onOpenChange, onCreated }: CreateOfferDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Create New Offer</h2>
        <p className="text-sm text-gray-600 mb-4">
          This is a placeholder for the create offer dialog. The full implementation will include form fields for offer details.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onCreated}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Offer
          </button>
        </div>
      </div>
    </div>
  );
}