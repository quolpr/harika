import { applicationDefault,initializeApp } from 'firebase-admin/app';

initializeApp({
  credential: applicationDefault(),
  databaseURL: 'https://harika-dev.firebaseio.com',
});
