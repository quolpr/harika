import './src/loadConfig';

// Update with your config settings.
//
const connection = (() => {
  const base = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  if (process.env.INSTANCE_CONNECTION_NAME) {
    const dbSocketPath = process.env.DB_SOCKET_PATH || '/cloudsql';

    return {
      ...base,
      host: `${dbSocketPath}/${process.env.INSTANCE_CONNECTION_NAME}`,
    };
  } else {
    return {
      ...base,
      host: process.env.DB_HOST,
    };
  }
})();

const config = {
  client: 'pg',
  connection,
  pool: {
    min: parseInt(process.env.DB_POOL_MIN, 10),
    max: parseInt(process.env.DB_POOL_MAX, 10),
  },
  migrations: {
    tableName: 'migrations',
  },
};

export default config;
