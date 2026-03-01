const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { migrate } = require('./db/migrate');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// DB 초기화
migrate();

// 라우트
app.use('/api/organizations', require('./routes/departments'));
app.use('/api/org-levels', require('./routes/teams'));
app.use('/api/users', require('./routes/users'));
app.use('/api/periods', require('./routes/periods'));
app.use('/api/objectives', require('./routes/objectives'));
app.use('/api/kpis', require('./routes/kpis'));
app.use('/api/okrs', require('./routes/okrs'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/milestones', require('./routes/milestones'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reviews', require('./routes/reviews'));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});
