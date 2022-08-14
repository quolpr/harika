# Harika [development is paused]

Harika is an offline-first, performance-focused note taking app for organizing your knowledge database.

![image](https://user-images.githubusercontent.com/7958527/138558070-0c811e3f-071a-439a-be91-dee114daf3aa.png)

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

## How can I try it?

You can create a test account at https://app-dev.harika.io .

## How can I try it locally?

Clone the repo, and run `docker-compose -f docker-compose.local.yml up --build`. Harika will be available at http://localhost:3000
