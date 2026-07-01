import { createApp } from './app.js';
import { createPool } from './db.js';

const pool = createPool();
const app = createApp(pool);
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`honsu-planner listening on :${port}`));
