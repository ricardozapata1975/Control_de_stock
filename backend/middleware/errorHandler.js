export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  console.error('[API]', err.message);
  res.status(status).json({
    error: err.message || 'Error interno',
    ...(process.env.NODE_ENV === 'development' && { detail: err.stack }),
  });
}
