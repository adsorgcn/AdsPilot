const DraftBadge: React.FCC = ({ children }) => {
  return (
    <span className="rounded-md bg-yellow-200 py-2 px-4 font-semibold dark:text-dark-800">
      {children}
    </span>
  );
};

export default DraftBadge;
