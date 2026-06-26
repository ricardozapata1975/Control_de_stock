export default function FocusedPage({ children, maxWidth = 'max-w-lg' }) {
  return (
    <div className="flex w-full min-w-0 flex-1 flex-col items-stretch py-4 sm:py-6 md:items-center">
      <div className={`w-full min-w-0 ${maxWidth} mx-auto`}>{children}</div>
    </div>
  );
}
