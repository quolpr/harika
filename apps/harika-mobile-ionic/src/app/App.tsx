import React, { useEffect, useState } from 'react';
import { Redirect, Route } from 'react-router-dom';
import {
  IonApp,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { ellipse, square, triangle } from 'ionicons/icons';
import Tab1 from './pages/Tab1';
import Tab2 from './pages/Tab2';
import Tab3 from './pages/Tab3';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { HarikaVaults } from '@harika/harika-core';
import {
  CurrentFocusedBlockContext,
  CurrentNoteContext,
  CurrentVaultContext,
  ICurrentFocusedBlockState,
  ICurrentNoteState,
  useFocusedBlock,
  useCurrentVault,
} from '@harika/harika-utils';
import { Header } from '@harika/harika-ui';

/* Core CSS required for Ionic components to work properly */
// import '@ionic/react/css/core.css';

// /* Basic CSS for apps built with Ionic */
// import '@ionic/react/css/normalize.css';
// import '@ionic/react/css/structure.css';
// import '@ionic/react/css/typography.css';
//
// /* Optional CSS utils that can be commented out */
// import '@ionic/react/css/padding.css';
// import '@ionic/react/css/float-elements.css';
// import '@ionic/react/css/text-alignment.css';
// import '@ionic/react/css/text-transformation.css';
// import '@ionic/react/css/flex-utils.css';
// import '@ionic/react/css/display.css';
//
// /* Theme variables */
// import './theme/variables.css';

import NotePage from './pages/NotePage';

const vaults = new HarikaVaults(
  ({ schema, dbName }) =>
    new LokiJSAdapter({
      schema,
      dbName, // optional db name
      // migrations, // optional migrations
      useWebWorker: false, // recommended for new projects. tends to improve performance and reduce glitches in most cases, but also has downsides - test with and without it
      useIncrementalIndexedDB: true, // recommended for new projects. improves performance (but incompatible with early Watermelon databases)
      // It's recommended you implement this method:
      // onIndexedDBVersionChange: () => {
      //   // database was deleted in another browser tab (user logged out), so we must make sure we delete
      //   // it in this tab as well
      //   if (checkIfUserIsLoggedIn()) {
      //     window.location.reload()
      //   }
      // },
      // Optional:
      // onQuotaExceededError: (error) => { /* do something when user runs out of disk space */ },
    } as any)
);

const vault = vaults.getVault('123');

const Syncher: React.FC = ({ children }) => {
  const vault = useCurrentVault();
  const [wasSynched, setWasSynched] = useState(false);

  useEffect(() => {
    const callback = async () => {
      await vault.sync();

      setWasSynched(true);
    };

    callback();
  }, [vault]);

  return <>{wasSynched && children}</>;
};

const App: React.FC = () => {
  const stateActions = useState<ICurrentFocusedBlockState>();
  const currentNoteActions = useState<ICurrentNoteState>();

  return (
    <IonApp>
      <IonReactRouter>
        <CurrentVaultContext.Provider value={vault}>
          <CurrentNoteContext.Provider value={currentNoteActions}>
            <Syncher>
              <Header />

              <section className="main">
                <IonRouterOutlet>
                  <Route path="/" component={NotePage} exact={true} />
                  <Route path="/notes/:id" component={Tab2} exact={true} />
                </IonRouterOutlet>
              </section>
            </Syncher>
          </CurrentNoteContext.Provider>
        </CurrentVaultContext.Provider>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
