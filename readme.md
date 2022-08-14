# Harika [development is paused]

Harika is an offline-first, performance-focused note taking app for organizing your knowledge database.

https://user-images.githubusercontent.com/7958527/184545287-eeae801d-9509-45fd-a02a-adcb7315f5b8.mp4

Right now the project development is paused, but Harika somehow is still ready to use product. This features are ready to use:

1. Synchronization with server. It's done with LWW CRDT per field on top of SQLite. It also stores all changes locally and sends them to server. Server also store all the changes and recalculate snapshots on new received changes and send those snapshots back to the client. Due to we store all the changes at server, it is also planned to add time travel, when CRDT is not what user expect at some cases.
1. Offline mode, with sync when back only
1. Attachment uploading (just paste file into block)
1. Referencing, back-referencing
1. Full text search
1. Mobile support
1. Markdown like styling
1. Daily notes
1. Notes tree and the left bar

It's a good project to discover how to make offline-first synchronization mechanism. You can run Harika locally(just run `docker-compose -f docker-compose.local.yml up --build`), and discover in DevTools logs what SQL queries it makes to store data and changes to send to the server.

## Status of the project

As for the 14.08.22, I managed to pause my work on Harika.

There are multiple reasons why did it happen. The main one is that I don't have enough resources to maintain the project. Finally, it's hard for me to keep working both on a full-time job, and on Harika(which I can say that it is another full-time job). Then, I also joined Remnote. I want to bring all the experience to the company, and make their product better.

But, one day I want to resume work on Harika when I will have enough money to take 1-2 years off. I need a product that will match only my needs, that matches my soul.

## Key features

- Offline first — use it with your mobile or desktop, and see changes on the fly; even when you are offline, it all got synced when you will get online back.
- Scalable — notes are loading on-demand, so it doesn't matter how large your knowledge base will be.
- Instant startup time — no matter how extensive your database is.
- Mobile support — you will have the same experience as with the desktop version.
- Great performance — we did a huge work to achieve smooth U, but there is still a lot of space to work.
- Open source — you can always host Harika on your server, including the sync server too.

### Future features

- Time travel for notes. Right now, I store all the changes at backend, and backend has logic that can return the snapshot state for the certain time by recalculating all the changes by the certain time.

## Demo?

You can create a test account at https://app-dev.harika.io . You will need to specify strong password and a good email(like that end with @gmail.com), otherwise Kratos will not accept registration.

## How can I try it locally?

Clone the repo, and run `docker-compose -f docker-compose.local.yml up --build`. Harika will be available at http://localhost:3000

You will need to specify strong password and existent email, otherwise Kratos will not accept registration.
