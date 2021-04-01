export const authCouchDB = async () => {
  await fetch('http://localhost:5984/_session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'admin', password: 'admin' }),
    credentials: 'include',
  });
};
