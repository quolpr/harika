import './src/loadConfig';

// Update with your config settings.

module.exports = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  pool: {
    min: parseInt(process.env.DB_POOL_MIN, 10),
    max: parseInt(process.env.DB_POOL_MAX, 10),
  },
  migrations: {
    tableName: 'migrations',
  },
};
