function errorHandler(err, req, res, next) {
  console.error(err.stack || err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || '서버 오류가 발생했습니다' });
}

module.exports = errorHandler;
