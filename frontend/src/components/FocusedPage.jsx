export default function FocusedPage({ children, maxWidth = 'max-w-lg' }) {
  return (
    <div className="flex w-full flex-1 flex-col items-center justify-center py-4 sm:py-6">
      <div className={`w-full ${maxWidth}`}>{children}</div>
    </div>
  );
}
