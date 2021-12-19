import { initializeApp } from 'firebase/app';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyDZt4OuDIOV9my9z4p63B3ZYoingqshyrU',
  authDomain: 'harika-dev.firebaseapp.com',
  projectId: 'harika-dev',
  storageBucket: 'harika-dev.appspot.com',
  messagingSenderId: '287987197713',
  appId: '1:287987197713:web:9aae8ce04acba3de98ceb0',
};

// Initialize Firebase
export const firebaseApp = initializeApp(firebaseConfig);
