interface OffersGettingStartedProps {
  onCreate: () => void;
  onConnectAds: () => void;
  onViewDocs: () => void;
}

export function OffersGettingStarted({ onCreate, onConnectAds, onViewDocs }: OffersGettingStartedProps) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="max-w-md">
        <h3 className="text-lg font-semibold mb-4">Welcome to Offers Management</h3>
        <p className="text-muted-foreground mb-8">
          Get started by creating your first offer or connecting your advertising accounts.
        </p>
        <div className="flex flex-col gap-4">
          <button
            onClick={onCreate}
            className="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Your First Offer
          </button>
          <button
            onClick={onConnectAds}
            className="w-full p-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Connect Ad Accounts
          </button>
          <button
            onClick={onViewDocs}
            className="w-full p-3 text-sm text-gray-600 hover:text-gray-800"
          >
            View Documentation
          </button>
        </div>
      </div>
    </div>
  );
}