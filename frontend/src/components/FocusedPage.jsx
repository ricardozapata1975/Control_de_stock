const ALIGN_CLASS = {
  center: 'justify-center',
  start: 'justify-start',
};

export default function FocusedPage({
  children,
  maxWidth = 'max-w-lg',
  align = 'center',
}) {
  return (
    <div
      className={`flex w-full flex-1 flex-col items-center py-4 sm:py-6 ${ALIGN_CLASS[align] ?? ALIGN_CLASS.center}`}
    >
      <div className={`w-full ${maxWidth}`}>{children}</div>
    </div>
  );
}
